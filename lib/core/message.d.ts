import type { GitSnapshot } from './git.js';
import type { GitCommitSettings } from '../protocol.js';
import type { LlmResolvedModelInfo, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
export interface ModelPrompt {
    system: string;
    prompt: string;
    maxTokens: number;
    reasoningEffort?: ReasoningEffortId;
    purpose?: string;
    sessionId?: string;
}
export type ModelCaller = (request: ModelPrompt) => Promise<string>;
export interface GenerationOptions {
    redact?: (text: string) => string;
    largeFileChangedLines?: number;
    history?: string[];
    decisionReasoningEffort?: ReasoningEffortId;
    generationReasoningEffort?: ReasoningEffortId;
    contextWindow?: number;
}
/** DSH adapters expose reasoning efforts in ascending capability order. */
export declare function reasoningSelection(info: LlmResolvedModelInfo | undefined, purpose?: string): any;
export declare function activeInstructions(settings: Pick<GitCommitSettings, 'inheritGlobal' | 'globalInstruction' | 'repositoryInstruction'>): string;
export declare function cleanMessage(raw: unknown): string;
/** Split a normal --no-ext-diff Git patch at real file headers, not at hunk content.
 * Match the Git-generated -z name-only ordering to the patch ordering; a
 * mismatch is a hard error rather than silently assigning content to a wrong path.
 */
export declare function splitFileDiffs(snapshot: GitSnapshot): {
    id: number;
    path: string;
    diff: string;
    lines: string[];
    changedLines: number;
    additions: number;
    deletions: number;
}[];
/** Only the first 200 physical Git patch lines are included for skipped large files. */
export declare function previewFileDiff(file: FileDiff, limit?: number): string;
/** Untrusted model decisions never cause a file to be silently omitted.
 * Missing, duplicated, invalid, or unparseable decisions default to full Diff.
 */
export declare function parseReadDecisions(text: unknown, largeFiles: FileDiff[]): Set<number>;
export declare function generateMessage(snapshot: GitSnapshot, settings: Pick<GitCommitSettings, 'inheritGlobal' | 'globalInstruction' | 'repositoryInstruction'>, callModel: ModelCaller, options?: GenerationOptions): Promise<string>;
export type FileDiff = ReturnType<typeof splitFileDiffs>[number];
//# sourceMappingURL=message.d.ts.map