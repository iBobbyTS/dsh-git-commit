import type { GitCommitSettings } from '../protocol.js';
type Stored = {
    version: number;
    global: Record<string, unknown>;
    repositories: Record<string, Record<string, unknown>>;
};
/** Stable fallback for existing v1 settings files without presentation preferences. */
export declare const DEFAULT_COUNTDOWN_COLOR = "#f59e0b";
export declare class InstructionStore {
    path: string;
    writes: Promise<unknown>;
    constructor(path?: string);
    read(): Promise<Stored>;
    get(root: string | null): Promise<Omit<GitCommitSettings, 'isRepository' | 'root'>>;
    save(root: string | null, patch: unknown): Promise<Omit<GitCommitSettings, "isRepository" | "root">>;
}
export {};
//# sourceMappingURL=store.d.ts.map