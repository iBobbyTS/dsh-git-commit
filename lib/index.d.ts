/** Public host-facing API for DSH plugins. */
export interface GitCommitRequest {
  /** Working directory inside the repository. Prefer an explicit cwd from another plugin. */
  cwd?: string;
  repositoryPath?: string;
  /** Requesting Session id; also forwarded as model routing metadata, so Session-keyed provider routes keep working. */
  sessionId?: string;
  /** Optional caller-supplied message; skips AI generation but preserves scope/snapshot validation. */
  message?: string;
  signal?: AbortSignal;
}
/** Provider usage totals and local monotonic timings across at most two LLM calls. */
export interface GitCommitLlmMetrics {
  calls: number;
  /** Total input including uncached, cache-read, and cache-write tokens. Null if usage unavailable. */
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  /** Earliest content token across calls, relative to first request's start. */
  latencyMs: number | null;
  /** LLM phase elapsed wall-clock time. */
  durationMs: number;
  /** Total output tokens / sum of per-call decoding times. Null if data incomplete. */
  outputSpeedTps: number | null;
}
export interface GitCommitResult {
  success: boolean;
  status: 'success' | 'failure';
  scope: 'staged' | 'all' | null;
  additions: number;
  deletions: number;
  message: string;
  /** Exactly the first seven characters of the resulting commit OID, or null upon failure. */
  hash: string | null;
  fullHash?: string;
  /** Present when an LLM was invoked; caller-supplied messages omit this. */
  llm?: GitCommitLlmMetrics;
  totalDurationMs?: number;
  error?: string;
}
export interface GitCommitSettings {
  globalInstruction: string;
  repositoryInstruction: string;
  inheritGlobal: boolean;
  /** Global preference, defaults to false; affects floating panel only. */
  autoHideNonGit: boolean;
  /** Global setting; defaults to false. */
  showTokenDetails: boolean;
  /** Progress bar color in #rrggbb form; defaults to orange (#f59e0b). */
  countdownColor: string;
  /** Null means default lower-right anchor. Otherwise saved top/right coordinates in CSS pixels. */
  floatingPosition: {right:number;top:number} | null;
  /** Global model selection, null means use the DSH default. */
  model: { provider: string; model: string } | null;
  /** Repository-only override; null means inherit the global model selection (fixed UI option value). */
  repositoryModel: { provider: string; model: string } | null;
  /** True for a Git working tree; false for global-only settings in ordinary directories. */
  isRepository: boolean;
  /** Canonical Git root, or null outside a repository. */
  root: string | null;
}
export interface GitActionResult {
  success: boolean;
  status: 'success' | 'failure';
  error?: string;
  message?: string;
  branch?: string;
  /** Successful push where every reported remote ref was already current. */
  upToDate?: boolean;
  source?: string | null;
  target?: string | null;
  stage?: 'preflight' | 'switch' | 'merge' | 'delete' | 'done';
  merged?: boolean;
  deleted?: boolean;
}
export interface GitCommitApi {
  /** Normal push; a new branch establishes origin/<same-name> as upstream. Never force pushes. */
  push(request: GitCommitRequest): Promise<GitActionResult>;
  /** Switch to the local origin/HEAD default, merge, then safely delete the local source. */
  mergeAndDelete(request: GitCommitRequest): Promise<GitActionResult>;
  commit(request: GitCommitRequest): Promise<GitCommitResult>;
  status(request: GitCommitRequest): Promise<
    | { isRepository: false; root: null }
    | { isRepository: true; root: string; repo: string; branch: string; head: string; defaultBranch: string | null; canMergeAndDelete: boolean;
        additions: number; deletions: number; binary: number;
        untracked: number; unknownUntrackedLines: number; stagedFiles: number }
  >;
  changeToken(request: GitCommitRequest): Promise<{ token: number | null; commitState: { id: number; working: boolean; result: GitCommitResult | null } | null }>;
  settings(request?: GitCommitRequest): Promise<GitCommitSettings>;
  saveSettings(request: GitCommitRequest & { patch: Partial<Pick<GitCommitSettings, 'globalInstruction' | 'repositoryInstruction' | 'inheritGlobal' | 'model' | 'repositoryModel' | 'autoHideNonGit' | 'showTokenDetails' | 'countdownColor' | 'floatingPosition'>> }): Promise<GitCommitSettings>;
  models(): Promise<{ models: Array<{provider:string;providerName:string;model:string;name:string}>; defaultModel: {provider:string;model:string}|null }>;
}
declare module '@deepseek-ai/cordis' {
  interface Context { gitCommit: GitCommitApi; }
}
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Commit notice injected into the requesting Session's inbox; never user speech. */
    'git-commit': { kind: 'git-commit'; form: 'notice'; summary: string };
  }
}
export const name: string;
export const inject: string[];
/** `notifyModel: false` disables the model-visible commit notice. */
export function apply(ctx: import('@deepseek-ai/cordis').Context, config?: { notifyModel?: boolean }): void;
