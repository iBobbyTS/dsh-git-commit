import type { HostContext } from '../host-contract.js'
import type {
  GitCommitRequest,
  GitCommitResult,
  GitActionResult,
  GitCommitSettings,
} from '../protocol.js'
import type { ModelPrompt } from './message.js'
import type { CallRecord } from './metrics.js'
import type { ReasoningEffortId, TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
type Selection = {
  provider: string
  model: string
  reasoningEffort?: ReasoningEffortId
  decisionReasoningEffort?: ReasoningEffortId
  contextWindow?: number
}
type Request = GitCommitRequest & { patch?: Partial<GitCommitSettings> }
interface ServiceOptions {
  store?: InstructionStore
  watcher?: RepoWatcher
  callModel?: (
    options: ModelPrompt & { selection: Selection; signal?: AbortSignal },
  ) => Promise<
    string | { text: string; firstTokenMs?: number; usage?: TokenUsage }
  >
  generator?: typeof generateMessage
  notifier?: CommitNotifier | null
}
/** Shared, in-process Git commit service for browser actions and other DSH plugins. */
import {
  repoRoot,
  repoRootOrNull,
  visibleStatus,
  plannedMode,
  preparedSnapshot,
  commitPrepared,
  git,
} from './git.js'
import { InstructionStore } from './store.js'
import { RepoWatcher } from './watcher.js'
import { generateMessage, reasoningSelection, cleanMessage } from './message.js'
import { summarizeLlmCalls } from './metrics.js'
import { CommitNotifier } from './notice.js'
import { pushBranch, mergeAndDeleteBranch } from './actions.js'

const failure = (
  error: unknown,
  scope: GitCommitResult['scope'] = null,
): GitCommitResult => ({
  success: false,
  status: 'failure',
  scope,
  additions: 0,
  deletions: 0,
  message: '',
  hash: null,
  error: error instanceof Error ? error.message : String(error),
})

/** Requesting Session id for Session-keyed routes; absent when no Session asked for the commit. */
function sessionRoutingId(sessionId: unknown) {
  if (typeof sessionId !== 'string') return undefined
  const trimmed = sessionId.trim()
  return trimmed.length ? trimmed : undefined
}

export class GitCommitService {
  declare ctx: HostContext
  declare store: InstructionStore
  declare watcher: RepoWatcher
  declare callModel: ServiceOptions['callModel']
  declare generator: typeof generateMessage
  declare notifier: CommitNotifier | null
  declare inflight: Map<string, Promise<GitCommitResult | GitActionResult>>
  declare operationKinds: Map<string, string>
  declare commitStates: Map<
    string,
    { id: number; working: boolean; result: GitCommitResult | null }
  >
  declare commitSequence: number

  constructor(ctx: HostContext, options: ServiceOptions = {}) {
    this.ctx = ctx
    this.store = options.store ?? new InstructionStore()
    this.watcher = options.watcher ?? new RepoWatcher()
    this.callModel = options.callModel
    this.generator = options.generator ?? generateMessage
    // `null` opts out of model notices; an omitted notifier keeps the default.
    this.notifier =
      options.notifier === undefined
        ? new CommitNotifier(ctx)
        : options.notifier
    this.inflight = new Map()
    this.operationKinds = new Map()
    this.commitStates = new Map()
    this.commitSequence = 0
  }
  resolveCwd(request?: Request) {
    const cwd =
      request?.cwd ??
      request?.repositoryPath ??
      (typeof request?.sessionId === 'string'
        ? this.ctx.get('sessions')?.get(request.sessionId as SessionId)?.header
            ?.cwd
        : undefined)
    if (typeof cwd !== 'string' || !cwd.trim())
      throw new Error(
        'Missing cwd, repositoryPath, or a session with a working directory',
      )
    return cwd
  }
  // Settings remain available without a repository (and without an active Session).
  // Global edits are scoped to the Host settings file; no synthetic repo is created.
  async settingsRoot(request?: Request) {
    const cwd =
      request?.cwd ??
      request?.repositoryPath ??
      (typeof request?.sessionId === 'string'
        ? this.ctx.get('sessions')?.get(request.sessionId as SessionId)?.header
            ?.cwd
        : undefined)
    return repoRootOrNull(cwd)
  }
  async status(request?: Request) {
    const root = await repoRootOrNull(this.resolveCwd(request))
    if (root === null) return { isRepository: false, root: null }
    return { isRepository: true, ...(await visibleStatus(root)) }
  }
  async changeToken(request?: Request) {
    const root = await repoRootOrNull(this.resolveCwd(request))
    return {
      token: root === null ? null : await this.watcher.token(root),
      commitState: root === null ? null : (this.commitStates.get(root) ?? null),
    }
  }
  async settings(request?: Request) {
    const root = await this.settingsRoot(request)
    return {
      ...(await this.store.get(root)),
      isRepository: root !== null,
      root,
    }
  }
  async saveSettings(request?: Request) {
    const root = await this.settingsRoot(request)
    // Both selectors use the same DSH model catalog, with independent scopes.
    for (const key of ['model', 'repositoryModel'] as const) {
      if (request?.patch?.[key]) {
        await this.ctx.llm.resolveModelInfo(
          request.patch[key]!.provider,
          request.patch[key]!.model,
        )
      }
    }
    return {
      ...(await this.store.save(root, request?.patch)),
      isRepository: root !== null,
      root,
    }
  }
  async models() {
    const providers = this.ctx.llm.listProviders()
    const models = []
    for (const provider of providers) {
      try {
        for (const model of await this.ctx.llm.listModels(provider.id))
          models.push({
            provider: provider.id,
            providerName: provider.name,
            model: model.id,
            name: model.name,
          })
      } catch {
        /* A temporarily disconnected adapter need not hide healthy providers. */
      }
    }
    let defaultModel = null
    try {
      const selection = this.ctx.get('agentDefaultModel')?.currentSelection()
      if (selection?.provider && selection?.model)
        defaultModel = { provider: selection.provider, model: selection.model }
    } catch {
      /* The configured default is optional. */
    }
    return { models, defaultModel }
  }
  async chosenModel(settings: Awaited<ReturnType<InstructionStore['get']>>) {
    const selected =
      settings.repositoryModel ??
      settings.model ??
      (await this.models()).defaultModel ??
      (await this.models()).models[0]
    if (!selected) throw new Error('No configured DSH model is available')
    const provider = selected.provider,
      model = selected.model
    const info = await this.ctx.llm.resolveModelInfo(provider, model)
    return {
      provider,
      model,
      reasoningEffort: reasoningSelection(info, 'generate'),
      decisionReasoningEffort: reasoningSelection(info, 'decide'),
      contextWindow: info?.context?.contextWindow,
    }
  }
  async ask(
    {
      system,
      prompt,
      maxTokens,
      reasoningEffort,
      purpose,
      sessionId,
    }: ModelPrompt,
    selection: Selection,
    signal?: AbortSignal,
    callRecords?: CallRecord[],
  ) {
    // The test hook can return a bare string (the original contract) or an
    // annotated response. Production always measures the actual DSH stream.
    const effectiveSelection = {
      ...selection,
      reasoningEffort: reasoningEffort ?? selection.reasoningEffort,
    }
    if (this.callModel) {
      const startedAt = performance.now()
      const response = await this.callModel({
        system,
        prompt,
        maxTokens,
        selection: effectiveSelection,
        signal,
        purpose,
        sessionId,
      })
      const endedAt = performance.now()
      const annotation =
        response !== null && typeof response === 'object' ? response : null
      callRecords?.push({
        startedAt,
        endedAt,
        firstTokenAt: Number.isFinite(annotation?.firstTokenMs)
          ? startedAt + annotation!.firstTokenMs!
          : null,
        usage: annotation?.usage ?? null,
      })
      return (annotation?.text ?? response) as string
    }
    const { createUserMessage, BlockAssembler } = await import(
      '@deepseek-ai/dsh-llm'
    )
    const messages = [
      createUserMessage({
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'plugin', plugin: 'dsh-git-commit' },
      }),
    ]
    const assembler = new BlockAssembler()
    const startedAt = performance.now()
    let firstTokenAt = null
    try {
      for await (const chunk of this.ctx.llm.stream({
        provider: effectiveSelection.provider,
        model: effectiveSelection.model,
        ...(effectiveSelection.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: effectiveSelection.reasoningEffort }),
        messages,
        system,
        maxTokens,
        ...(signal ? { signal } : {}),
        ...(purpose
          ? {
              purpose: `git-commit.${purpose}` as
                | 'git-commit.classify'
                | 'git-commit.generate',
            }
          : {}),
        // Session-keyed routes (OpenCode's required x-opencode-session header)
        // can only route a request that names the Session it belongs to.
        ...(sessionId ? { sessionId: sessionId as SessionId } : {}),
      })) {
        if (
          firstTokenAt === null &&
          (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') &&
          chunk.text.length > 0
        )
          firstTokenAt = performance.now()
        assembler.push(chunk)
      }
    } finally {
      callRecords?.push({
        startedAt,
        endedAt: performance.now(),
        firstTokenAt,
        usage: assembler.usage ?? null,
      })
    }
    if (
      assembler.finish?.kind === 'error' ||
      assembler.finish?.kind === 'aborted'
    ) {
      throw new Error(
        assembler.finish.failure?.message ?? `LLM ${assembler.finish.kind}`,
      )
    }
    return assembler
      .blocks()
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }
  async commit(request: Request = {}) {
    let root
    try {
      root = await repoRoot(this.resolveCwd(request))
    } catch (error) {
      return failure(error)
    }
    // Concurrent GUI / plugin requests join the same operation, never queue a second commit.
    const current = this.inflight.get(root)
    if (current)
      return this.operationKinds.get(root) === 'commit'
        ? current
        : failure('Another Git operation is in progress')
    this.operationKinds.set(root, 'commit')
    const id = ++this.commitSequence
    this.commitStates.set(root, { id, working: true, result: null })
    const execute = Promise.resolve()
      .then(() => this.commitOnce(root, request))
      .catch((error) => failure(error))
      .then((result) => {
        this.commitStates.set(root, { id, working: false, result })
        return result
      })
      .finally(() => {
        if (this.inflight.get(root) === execute) {
          this.inflight.delete(root)
          this.operationKinds.delete(root)
        }
      })
    this.inflight.set(root, execute)
    return execute
  }
  async followUp(
    kind: string,
    request: Request,
    operation: (root: string) => Promise<GitActionResult>,
  ) {
    let root
    try {
      root = await repoRoot(this.resolveCwd(request))
    } catch (error) {
      return failure(error)
    }
    const current = this.inflight.get(root)
    if (current)
      return this.operationKinds.get(root) === kind
        ? current
        : failure('Another Git operation is in progress')
    this.operationKinds.set(root, kind)
    const execute = Promise.resolve()
      .then(() => operation(root))
      .catch((error) => failure(error))
      .finally(() => {
        if (this.inflight.get(root) === execute) {
          this.inflight.delete(root)
          this.operationKinds.delete(root)
        }
      })
    this.inflight.set(root, execute)
    return execute
  }
  push(request: Request = {}) {
    return this.followUp('push', request, pushBranch)
  }
  mergeAndDelete(request: Request = {}) {
    return this.followUp('mergeAndDelete', request, mergeAndDeleteBranch)
  }
  async commitOnce(root: string, request: Request): Promise<GitCommitResult> {
    const operationStartedAt = performance.now()
    const llmCalls: CallRecord[] = []
    const sessionId = sessionRoutingId(request?.sessionId)
    let scope: GitCommitResult['scope'] = null
    try {
      scope = await plannedMode(root)
      // Only when the real index has no staged changes: stage the entire working
      // tree BEFORE any model calls. A later generation failure leaves the index
      // staged so the user can inspect or retry the same exact selection.
      if (scope === 'all')
        await git(root, ['add', '-A', '--', '.'], { timeout: 180000 })
      const snapshot = await preparedSnapshot(root, 'staged')
      if (!snapshot.paths.length) return failure('Nothing to commit', scope)
      let message
      if (request.message !== undefined) message = cleanMessage(request.message)
      else {
        const settings = await this.store.get(root)
        const selection = await this.chosenModel(settings)
        const recent = await git(root, [
          'log',
          '-5',
          '--pretty=format:%s',
        ]).catch(() => '')
        message = await this.generator(
          snapshot,
          settings,
          (values) =>
            this.ask(
              { ...values, sessionId },
              selection,
              request.signal,
              llmCalls,
            ),
          {
            history: recent.split('\n').filter(Boolean),
            decisionReasoningEffort: selection.decisionReasoningEffort,
            generationReasoningEffort: selection.reasoningEffort,
            contextWindow: selection.contextWindow,
          },
        )
      }
      const result = await commitPrepared(snapshot, message)
      // Advisory only: a notice failure must never turn a completed commit into a reported failure.
      if (this.notifier) {
        await this.notifier
          .announce(request.sessionId, {
            hash: result.hash,
            message: result.message,
            cwd: root,
          })
          .catch(() => {})
      }
      return {
        ...result,
        scope,
        ...(llmCalls.length ? { llm: summarizeLlmCalls(llmCalls)! } : {}),
        totalDurationMs: Math.max(0, performance.now() - operationStartedAt),
      }
    } catch (error) {
      return failure(error, scope)
    }
  }
  close() {
    this.watcher.close()
  }
}
