import type { FSWatcher } from 'node:fs';
export declare class RepoWatcher {
    repos: Map<string, {
        token: number;
        handles: FSWatcher[];
        timer: ReturnType<typeof setTimeout> | null;
        first: number;
    }>;
    seed: number;
    constructor();
    token(root: string): Promise<number>;
    close(): void;
}
//# sourceMappingURL=watcher.d.ts.map