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

test('large diff uses map/reduce and preserves instructions in the final request', async () => {
  const utils={
    redactSecrets:(text)=>text.replaceAll('secret','[REDACTED]'),
    splitUnifiedDiffIntoFileChunks:diff=>diff.split(/(?=diff --git )/).filter(Boolean),
    groupDiffChunksByBudget:(chunks,max)=>{
      const groups=[];let buf='';for(const s of chunks){if(buf.length&&buf.length+s.length>max){groups.push(buf);buf='';}buf+=s;}if(buf)groups.push(buf);return groups;
    }
  };
  const snapshot={ mode:'staged', paths:['src/a.ts','src/b.ts'], additions:50,deletions:5,binary:0,
    diff:'diff --git a/src/a.ts b/src/a.ts\n' + '+const secret=1\n'.repeat(60) + 'diff --git a/src/b.ts b/src/b.ts\n' + '+const next=2\n'.repeat(60),
  };
  const calls=[];
  const output=await generateMessage(snapshot,{globalInstruction:'English',repositoryInstruction:'Scope: core',inheritGlobal:true},async payload=>{
    calls.push(payload);
    return payload.system.includes('Extract only')?'Document changes':'feat(core): document changes';
  },{budget:450,utils});
  assert.ok(calls.length>2);
  assert.equal(output,'feat(core): document changes');
  assert.match(calls.at(-1).system,/Global|GLOBAL/);
  assert.match(calls.at(-1).system,/Scope: core/);
  assert.ok(calls.every(call=>!call.prompt.includes('secret')));
  assert.match(calls.at(-1).prompt,/src\/b.ts/);
});
