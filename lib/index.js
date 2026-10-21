/** DSH Host half; uses the authenticated, cross-carrier Connection RPC channel. */
import { GitCommitService } from './core/service.js';

export const name = 'dsh-git-commit';
// The RPC registrar installs a WebServer route through the caller's Cordis context.
// webServer must be explicitly injected even though requests use Connection auth.
export const inject = ['connection', 'llm', 'webServer'];
const CHANNEL = '/git-commit';
const COMMANDS = new Set(['status', 'changeToken', 'settings', 'saveSettings', 'models', 'commit']);

export function apply(ctx) {
  const service = new GitCommitService(ctx);
  // Native Host service: other DSH plugins inject ['gitCommit'] and call ctx.gitCommit.commit({cwd}).
  const release = ctx.reflect.provide('gitCommit', service);
  ctx.effect(() => () => { service.close(); return release(); }, 'dsh-git-commit: service cleanup');
  ctx.connection.rpc.handle(CHANNEL, async (endpoint, payload, signal, peer) => {
    if (peer.principal.kind !== 'owner') return { ok: false, error: { code: 'FORBIDDEN', message: 'Owner access required', details: {} } };
    if (!COMMANDS.has(endpoint)) return { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown method', details: {} } };
    try {
      const args = typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : {};
      const result = await service[endpoint](endpoint === 'commit' ? { ...args, signal } : args);
      return { ok: true, value: result };
    } catch (error) {
      return { ok: false, error: { code: 'GIT_COMMIT_ERROR', message: error instanceof Error ? error.message : String(error), details: {} } };
    }
  });
}
