/**
 * DSH Host plugin. Register a feature endpoint on Connection's already-authenticated
 * /api transport, NOT a new webServer route. Connection's own host context does
 * not inject webServer and ctx.connection.rpc.handle() can trigger Cordis's
 * "cannot get property webServer without inject" on that shadow context.
 *
 * Browser/desktop clients use the public connection.rpc.call('/api', 'git-commit', ...)
 * protocol. Other host plugins use the in-process ctx.gitCommit service.
 */
import { GitCommitService } from './core/service.js';

export const name = 'dsh-git-commit';
export const inject = ['connection', 'llm'];
export const ROUTE = '/api/git-commit';
const ENDPOINT = 'git-commit';
const COMMANDS = new Set(['status', 'changeToken', 'settings', 'saveSettings', 'models', 'commit']);
const MAX_REQUEST_CHARS = 262_144;
const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function response(rpcId, result) {
  return Response.json({ type: 'server-response', rpcId, result }, { headers: HEADERS });
}

function failure(code, error) {
  return { ok: false, error: { code, message: error instanceof Error ? error.message : String(error), details: {} } };
}

/**
 * The DSH Connection bridge has already authenticated the caller and enforces
 * an owner principal for exact Fetch routes. We only validate application input
 * and return the standard Connection RPC response envelope here.
 */
export function createHandler(service) {
  return async function serve(request) {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: HEADERS });
    if (contentType !== 'application/json') return new Response('JSON required', { status: 415, headers: HEADERS });
    let input;
    try {
      const text = await request.text();
      if (text.length > MAX_REQUEST_CHARS) return new Response('Request too large', { status: 413, headers: HEADERS });
      input = JSON.parse(text);
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: HEADERS });
    }
    if (!record(input) || input.type !== 'client-request' || input.method !== ENDPOINT
      || typeof input.rpcId !== 'string' || input.rpcId.length === 0 || input.rpcId.length > 256
      || !record(input.payload) || typeof input.payload.method !== 'string') {
      return new Response('Invalid Connection request', { status: 400, headers: HEADERS });
    }
    const { method, payload } = input.payload;
    if (!COMMANDS.has(method)) return response(input.rpcId, failure('NOT_FOUND', 'Unknown method'));
    const args = record(payload) ? payload : {};
    try {
      const value = await service[method](method === 'commit' ? { ...args, signal: request.signal } : args);
      return response(input.rpcId, { ok: true, value });
    } catch (error) {
      return response(input.rpcId, failure('GIT_COMMIT_ERROR', error));
    }
  };
}

export function apply(ctx) {
  const service = new GitCommitService(ctx);
  // Cordis-native, injected by other Host plugins via inject: ['gitCommit'].
  const release = ctx.reflect.provide('gitCommit', service);
  ctx.effect(() => () => { service.close(); return release(); }, 'dsh-git-commit: service cleanup');
  // Connection handles authentication, Origin trust, and DSH Web/Desktop transport.
  // Use the same exact Fetch-route seam as DSH's /api/file and /api/present.
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: createHandler(service),
  }), 'dsh-git-commit: authenticated API route');
}
