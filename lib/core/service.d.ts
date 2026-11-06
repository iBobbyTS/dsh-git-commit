import type { HostContext } from '../host-contract.js';
import type { GitCommitRequest, GitCommitResult, GitActionResult, GitCommitSettings } from '../protocol.js';
import type { ModelPrompt } from './message.js';
import type { CallRecord } from './metrics.js';
import type { ReasoningEffortId, TokenUsage } from '@deepseek-ai/dsh-llm';
type Selection = {
    provider: string;
    model: string;
    reasoningEffort?: ReasoningEffortId;
    decisionReasoningEffort?: ReasoningEffortId;
    contextWindow?: number;
};
type Request = GitCommitRequest & {
    patch?: Partial<GitCommitSettings>;
};
interface ServiceOptions {
    store?: InstructionStore;
    watcher?: RepoWatcher;
    callModel?: (options: ModelPrompt & {
        selection: Selection;
        signal?: AbortSignal;
    }) => Promise<string | {
        text: string;
        firstTokenMs?: number;
        usage?: TokenUsage;
    }>;
    generator?: typeof generateMessage;
    notifier?: CommitNotifier | null;
}
import { InstructionStore } from './store.js';
import { RepoWatcher } from './watcher.js';
import { generateMessage } from './message.js';
import { CommitNotifier } from './notice.js';
export declare class GitCommitService {
    ctx: HostContext;
    store: InstructionStore;
    watcher: RepoWatcher;
    callModel: ServiceOptions['callModel'];
    generator: typeof generateMessage;
    notifier: CommitNotifier | null;
    inflight: Map<string, Promise<GitCommitResult | GitActionResult>>;
    operationKinds: Map<string, string>;
    commitStates: Map<string, {
        id: number;
        working: boolean;
        result: GitCommitResult | null;
    }>;
    commitSequence: number;
    constructor(ctx: HostContext, options?: ServiceOptions);
    resolveCwd(request?: Request): string;
    settingsRoot(request?: Request): Promise<string | null>;
    status(request?: Request): Promise<{
        isRepository: boolean;
        root: null;
    } | {
        root: string;
        repo: string;
        branch: string;
        head: string;
        defaultBranch: string | null;
        canMergeAndDelete: boolean;
        additions: number;
        deletions: number;
        binary: number;
        untracked: number;
        unknownUntrackedLines: number;
        stagedFiles: number;
        isRepository: boolean;
    }>;
    changeToken(request?: Request): Promise<{
        token: number | null;
        commitState: {
            id: number;
            working: boolean;
            result: GitCommitResult | null;
        } | null;
    }>;
    settings(request?: Request): Promise<{
        isRepository: boolean;
        root: string | null;
        globalInstruction: string;
        repositoryInstruction: string;
        inheritGlobal: boolean;
        model: {
            provider: string;
            model: string;
        } | null;
        repositoryModel: {
            provider: string;
            model: string;
        } | null;
        autoHideNonGit: boolean;
        showTokenDetails: boolean;
        countdownColor: string;
        floatingPosition: {
            right: number;
            top: number;
        } | null;
    }>;
    saveSettings(request?: Request): Promise<{
        isRepository: boolean;
        root: string | null;
        globalInstruction: string;
        repositoryInstruction: string;
        inheritGlobal: boolean;
        model: {
            provider: string;
            model: string;
        } | null;
        repositoryModel: {
            provider: string;
            model: string;
        } | null;
        autoHideNonGit: boolean;
        showTokenDetails: boolean;
        countdownColor: string;
        floatingPosition: {
            right: number;
            top: number;
        } | null;
    }>;
    models(): Promise<{
        models: {
            provider: string;
            providerName: string;
            model: string;
            name: string;
        }[];
        defaultModel: {
            provider: string;
            model: string;
        } | null;
    }>;
    chosenModel(settings: Awaited<ReturnType<InstructionStore['get']>>): Promise<{
        provider: string;
        model: string;
        reasoningEffort: any;
        decisionReasoningEffort: any;
        contextWindow: number | undefined;
    }>;
    ask({ system, prompt, maxTokens, reasoningEffort, purpose, sessionId, }: ModelPrompt, selection: Selection, signal?: AbortSignal, callRecords?: CallRecord[]): Promise<string>;
    commit(request?: Request): Promise<GitCommitResult | GitActionResult>;
    followUp(kind: string, request: Request, operation: (root: string) => Promise<GitActionResult>): Promise<GitCommitResult | GitActionResult>;
    push(request?: Request): Promise<GitCommitResult | GitActionResult>;
    mergeAndDelete(request?: Request): Promise<GitCommitResult | GitActionResult>;
    commitOnce(root: string, request: Request): Promise<GitCommitResult>;
    close(): void;
}
export {};
//# sourceMappingURL=service.d.ts.map