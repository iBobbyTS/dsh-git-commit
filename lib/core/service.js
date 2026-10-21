/** Shared, in-process Git commit service for browser actions and other DSH plugins. */
import { repoRoot, visibleStatus, plannedMode, preparedSnapshot, commitPrepared, git } from './git.js';
import { InstructionStore } from './store.js';
import { RepoWatcher } from './watcher.js';
import { generateMessage, reasoningSelection, cleanMessage } from './message.js';

const failure = (error, scope = null) => ({ success: false, status: 'failure', scope, additions: 0, deletions: 0, message: '', hash: null, error: error instanceof Error ? error.message : String(error) });

export class GitCommitService {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.store = options.store ?? new InstructionStore();
    this.watcher = options.watcher ?? new RepoWatcher();
    this.callModel = options.callModel;
    this.generator = options.generator ?? generateMessage;
    this.inflight = new Map();
  }
  resolveCwd(request) {
    const cwd = request?.cwd ?? request?.repositoryPath ??
      (typeof request?.sessionId === 'string' ? this.ctx.get('sessions')?.get(request.sessionId)?.header?.cwd : undefined);
    if (typeof cwd !== 'string' || !cwd.trim()) throw new Error('Missing cwd, repositoryPath, or a session with a working directory');
    return cwd;
  }
  async status(request) { return visibleStatus(this.resolveCwd(request)); }
  async changeToken(request) { return { token: await this.watcher.token(await repoRoot(this.resolveCwd(request))) }; }
  async settings(request) { return this.store.get(await repoRoot(this.resolveCwd(request))); }
  async saveSettings(request) {
    const root = await repoRoot(this.resolveCwd(request));
    if (request?.patch?.model) {
      await this.ctx.llm.resolveModelInfo(request.patch.model.provider, request.patch.model.model);
    }
    return this.store.save(root, request.patch);
  }
  async models() {
    const providers = this.ctx.llm.listProviders();
    const models = [];
    for (const provider of providers) {
      try {
        for (const model of await this.ctx.llm.listModels(provider.id)) models.push({ provider: provider.id, providerName: provider.name, model: model.id, name: model.name });
      } catch { /* A temporarily disconnected adapter need not hide healthy providers. */ }
    }
    let defaultModel = null;
    try {
      const selection = this.ctx.get('agentDefaultModel')?.currentSelection();
      if (selection?.provider && selection?.model) defaultModel = { provider: selection.provider, model: selection.model };
    } catch { /* The configured default is optional. */ }
    return { models, defaultModel };
  }
  async chosenModel(settings) {
    const selected = settings.model ?? (await this.models()).defaultModel ?? (await this.models()).models[0];
    if (!selected) throw new Error('No configured DSH model is available');
    const provider = selected.provider, model = selected.model;
    const info = await this.ctx.llm.resolveModelInfo(provider, model);
    return { provider, model, reasoningEffort: reasoningSelection(info) };
  }
  async ask({ system, prompt, maxTokens }, selection, signal) {
    if (this.callModel) return this.callModel({ system, prompt, maxTokens, selection, signal });
    const { createUserMessage, BlockAssembler } = await import('@deepseek-ai/dsh-llm');
    const messages = [createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: 'dsh-git-commit' },
    })];
    const assembler = new BlockAssembler();
    for await (const chunk of this.ctx.llm.stream({
      provider: selection.provider, model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      messages, system, maxTokens, ...(signal ? { signal } : {}),
    })) assembler.push(chunk);
    if (assembler.finish?.kind === 'error' || assembler.finish?.kind === 'aborted') {
      throw new Error(assembler.finish.failure?.message ?? `LLM ${assembler.finish.kind}`);
    }
    return assembler.blocks().filter(block => block.type === 'text').map(block => block.text).join('');
  }
  async commit(request = {}) {
    let root;
    try { root = await repoRoot(this.resolveCwd(request)); }
    catch (error) { return failure(error); }
    const previous = this.inflight.get(root) ?? Promise.resolve();
    const execute = previous.catch(() => {}).then(() => this.commitOnce(root, request));
    const tail = execute.catch(() => {});
    this.inflight.set(root, tail);
    try { return await execute; }
    finally { if (this.inflight.get(root) === tail) this.inflight.delete(root); }
  }
  async commitOnce(root, request) {
    let scope = null;
    try {
      scope = await plannedMode(root);
      const snapshot = await preparedSnapshot(root, scope);
      if (!snapshot.paths.length) return failure('Nothing to commit', scope);
      let message;
      if (request.message !== undefined) message = cleanMessage(request.message);
      else {
        const settings = await this.store.get(root);
        const selection = await this.chosenModel(settings);
        const recent = await git(root, ['log', '-5', '--pretty=format:%s']).catch(() => '');
        message = await this.generator(snapshot, settings, values => this.ask(values, selection, request.signal), {
          history: recent.split('\n').filter(Boolean),
        });
      }
      const result = await commitPrepared(snapshot, message);
      return result;
    } catch (error) { return failure(error, scope); }
  }
  close() { this.watcher.close(); }
}
