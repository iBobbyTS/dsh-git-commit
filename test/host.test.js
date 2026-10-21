import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, inject } from '../lib/index.js';
import { generateMessage } from '../lib/core/message.js';

// Regression for the actual DSH failure: the Connection service's own context
// does not inject webServer. A new Connection RPC channel accessed that property
// and threw even when the caller listed webServer in its own inject array.
// The standard /api Fetch seam must not access ctx.webServer or rpc.handle().
test('Host mounts on the authenticated /api Fetch seam without webServer', async () => {
  const services = [];
  const effects = [];
  const routes = [];
  const ctx = {
    reflect: { provide: (name, service) => { services.push({ name, service }); return () => {}; } },
    effect: (factory) => { effects.push(factory); return () => {}; },
    get webServer() { throw new Error('cannot get property "webServer" without inject'); },
    connection: {
      rpc: { handle: () => { throw new Error('RPC handle is not suitable for an external DSH plugin'); } },
      fetch: { register: (route) => { routes.push(route); return async () => {}; } },
    },
    get: () => undefined,
    llm: { listProviders: () => [], listModels: async () => [] },
  };
  assert.deepEqual(inject, ['connection', 'llm']);
  apply(ctx);
  // Real Cordis effects execute their factories as part of registration.
  const cleanups = effects.map(factory => factory());
  assert.equal(services[0].name, 'gitCommit');
  assert.equal(routes.length, 1);
  const route = routes[0];
  assert.deepEqual({ path: route.path, methods: route.methods, requestBody: route.requestBody },
    { path: '/api/git-commit', methods: ['POST'], requestBody: 'buffered' });

  const call = async (method, payload = {}, overrides = {}) => {
    const rpcId = overrides.rpcId ?? 'test-rpc-id';
    const request = new Request('http://localhost/api/git-commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method: 'git-commit', payload: { method, payload } }),
    });
    const response = await route.fetch(request);
    const data = await response.json();
    return { response, data };
  };

  const ok = await call('models');
  assert.equal(ok.response.status, 200);
  assert.equal(ok.response.headers.get('cache-control'), 'no-store');
  assert.equal(ok.data.type, 'server-response');
  assert.equal(ok.data.rpcId, 'test-rpc-id');
  assert.equal(ok.data.result.ok, true);
  assert.deepEqual(ok.data.result.value.models, []);
  const missing = await call('invalid-method');
  assert.equal(missing.data.result.ok, false);
  assert.equal(missing.data.result.error.code, 'NOT_FOUND');
  const fail = await call('status', { cwd: '/this/path/does/not/exist' });
  assert.equal(fail.data.result.ok, false);
  assert.equal(fail.data.result.error.code, 'GIT_COMMIT_ERROR');

  const malformed = await route.fetch(new Request('http://localhost/api/git-commit', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not JSON}',
  }));
  assert.equal(malformed.status, 400);
  const unacceptable = await route.fetch(new Request('http://localhost/api/git-commit', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x',
  }));
  assert.equal(unacceptable.status, 415);
  const wrongEndpoint = await route.fetch(new Request('http://localhost/api/git-commit', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'id', method: 'nope', payload: { method: 'models' } }),
  }));
  assert.equal(wrongEndpoint.status, 400);

  await Promise.all(cleanups.map(async cleanup => { if (typeof cleanup === 'function') await cleanup(); }));
});

test('large Diff routes through exactly one classification call and one final generation call', async () => {
  const snapshot = {
    mode: 'staged',
    paths: ['drizzle/meta/0000_snapshot.json', 'drizzle/0001_add_columns.sql'],
    additions: 2110, deletions: 0, binary: 0,
    diff: [
      'diff --git a/drizzle/meta/0000_snapshot.json b/drizzle/meta/0000_snapshot.json',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/drizzle/meta/0000_snapshot.json',
      '@@ -0,0 +1,2102 @@',
      ...Array.from({ length: 2102 }, (_, i) => '+const credential=secret-for-redaction; // ' + i),
      'diff --git a/drizzle/0001_add_columns.sql b/drizzle/0001_add_columns.sql',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/drizzle/0001_add_columns.sql',
      '@@ -0,0 +1,8 @@',
      ...Array.from({ length: 8 }, (_, i) => '+ALTER TABLE db ADD column' + i + ' TEXT;'),
    ].join('\n') + '\n',
  };
  const calls = [];
  const output = await generateMessage(snapshot,
    { globalInstruction: 'English', repositoryInstruction: 'Scope: database', inheritGlobal: true },
    async payload => {
      calls.push(payload);
      if (payload.purpose === 'classify') return '{"decisions":[{"id":1,"readFullDiff":false}]}';
      return 'feat(db): add schema columns';
    },
    {
      redact: text => text.replaceAll('secret-for-redaction', '[REDACTED]'),
      contextWindow: 1000000,
      decisionReasoningEffort: 'low',
      generationReasoningEffort: 'off',
    });
  assert.equal(output, 'feat(db): add schema columns');
  assert.equal(calls.length, 2, 'one classifier plus one generator, no old Map-Reduce');
  assert.equal(calls[0].purpose, 'classify');
  assert.equal(calls[0].reasoningEffort, 'low');
  assert.equal(calls[1].purpose, 'generate');
  assert.equal(calls[1].reasoningEffort, 'off');
  assert.match(calls[1].system, /GLOBAL COMMIT INSTRUCTION/);
  assert.match(calls[1].system, /Scope: database/);
  assert.match(calls[1].prompt, /TRUNCATED GIT PATCH PREVIEW/);
  assert.match(calls[1].prompt, /drizzle\/0001_add_columns\.sql/);
  assert.doesNotMatch(calls[1].prompt, /\+const credential=secret-for-redaction/);
  assert.ok(calls.every(call => !call.prompt.includes('secret-for-redaction')));
  assert.ok(calls[1].prompt.includes('ALTER TABLE db ADD column7 TEXT'));
});
