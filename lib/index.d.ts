/** Public host-facing API for DSH plugins. */
export interface GitCommitRequest {
  /** Working directory inside the repository. Prefer an explicit cwd from another plugin. */
  cwd?: string;
  repositoryPath?: string;
  sessionId?: string;
  /** Optional caller-supplied message; skips AI generation but preserves scope/snapshot validation. */
  message?: string;
  signal?: AbortSignal;
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
  error?: string;
}
export interface GitCommitSettings {
  globalInstruction: string;
  repositoryInstruction: string;
  inheritGlobal: boolean;
  model: { provider: string; model: string } | null;
}
export interface GitCommitApi {
  commit(request: GitCommitRequest): Promise<GitCommitResult>;
  status(request: GitCommitRequest): Promise<{
    root: string; repo: string; branch: string; head: string;
    additions: number; deletions: number; binary: number;
    untracked: number; unknownUntrackedLines: number; stagedFiles: number;
  }>;
  changeToken(request: GitCommitRequest): Promise<{ token: number }>;
  settings(request: GitCommitRequest): Promise<GitCommitSettings>;
  saveSettings(request: GitCommitRequest & { patch: Partial<GitCommitSettings> }): Promise<GitCommitSettings>;
  models(): Promise<{ models: Array<{provider:string;providerName:string;model:string;name:string}>; defaultModel: {provider:string;model:string}|null }>;
}
declare module '@deepseek-ai/cordis' {
  interface Context { gitCommit: GitCommitApi; }
}
export const name: string;
export const inject: string[];
export function apply(ctx: import('@deepseek-ai/cordis').Context): void;
