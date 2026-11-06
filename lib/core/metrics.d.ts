import type { GitCommitLlmMetrics } from '../protocol.js';
import type { TokenUsage } from '@deepseek-ai/dsh-llm';
export interface CallRecord {
    startedAt: number;
    endedAt: number;
    firstTokenAt: number | null;
    usage: TokenUsage | null;
}
export declare function summarizeLlmCalls(calls: CallRecord[]): GitCommitLlmMetrics | null;
//# sourceMappingURL=metrics.d.ts.map