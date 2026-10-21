/** Aggregate provider-reported TokenUsage and monotonic client-side timing.
 *
 * Every per-call usage sample represents one request. Missing usage is null rather
 * than an invented zero; optional cache buckets default to zero only when a
 * provider emitted an authoritative usage event for that call. For concurrent
 * map tasks, decoding speed divides total output by the SUM of each call's
 * decoding time, not by the smaller wall-clock interval of overlapping calls.
 */
const safeNonnegative = value => Number.isFinite(value) && value >= 0;
export function summarizeLlmCalls(calls) {
  if (!Array.isArray(calls) || calls.length === 0) return null;
  const begin = Math.min(...calls.map(call => call.startedAt));
  const end = Math.max(...calls.map(call => call.endedAt));
  const usageComplete = calls.every(call => call.usage
    && safeNonnegative(call.usage.inputTokens) && safeNonnegative(call.usage.outputTokens));
  const sum = key => calls.reduce((acc, call) => acc + (call.usage[key] ?? 0), 0);
  const outputTokens = usageComplete ? sum('outputTokens') : null;
  const inputTokens = usageComplete
    ? sum('inputTokens') + sum('cacheReadTokens') + sum('cacheWriteTokens') : null;
  const firstTimes = calls.map(call => call.firstTokenAt).filter(safeNonnegative);
  const latencyMs = firstTimes.length ? Math.max(0, Math.min(...firstTimes) - begin) : null;
  const completeDecode = usageComplete && calls.every(call => safeNonnegative(call.firstTokenAt)
    && safeNonnegative(call.endedAt) && call.endedAt > call.firstTokenAt);
  const decodeMs = completeDecode
    ? calls.reduce((ms, call) => ms + call.endedAt - call.firstTokenAt, 0) : 0;
  return {
    calls: calls.length,
    inputTokens,
    outputTokens,
    cacheReadTokens: usageComplete ? sum('cacheReadTokens') : null,
    cacheWriteTokens: usageComplete ? sum('cacheWriteTokens') : null,
    reasoningTokens: usageComplete && calls.some(call => call.usage.reasoningTokens !== undefined)
      ? sum('reasoningTokens') : null,
    latencyMs,
    durationMs: Math.max(0, end - begin),
    outputSpeedTps: completeDecode && decodeMs > 0
      ? Math.round((outputTokens * 1000 / decodeMs) * 10) / 10 : null,
  };
}
