declare const EMPTY = "UNBORN";
export declare function git(cwd: string, args: string[], options?: {
    env?: NodeJS.ProcessEnv;
    maxBuffer?: number;
    timeout?: number;
}): Promise<string>;
export declare function repoRoot(cwd: unknown): Promise<string>;
/** Return null for an existing directory outside a Git working tree. Other errors are real failures. */
export declare function repoRootOrNull(cwd: unknown): Promise<string | null>;
export declare function headSha(root: string): Promise<string>;
export declare function branchName(root: string): Promise<string>;
export declare function parseNumstat(raw: string): {
    additions: number;
    deletions: number;
    binary: number;
};
export declare function defaultBranch(root: string): Promise<string | null>;
export declare function visibleStatus(cwd: string): Promise<{
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
}>;
/** The existing real index is never modified by building a preview. */
export declare function preparedSnapshot(root: string, mode: 'all' | 'staged'): Promise<{
    mode: "staged" | "all";
    additions: number;
    deletions: number;
    binary: number;
    root: string;
    head: string;
    tree: string;
    paths: string[];
    diff: string;
    clipped: boolean;
}>;
export declare function plannedMode(root: string): Promise<"staged" | "all">;
export declare function commitPrepared(snapshot: GitSnapshot, message: string): Promise<{
    success: boolean;
    status: "success";
    scope: "staged" | "all";
    additions: number;
    deletions: number;
    message: string;
    hash: string;
    fullHash: string;
}>;
export { EMPTY as UNBORN_HEAD };
export type GitSnapshot = Awaited<ReturnType<typeof preparedSnapshot>>;
//# sourceMappingURL=git.d.ts.map