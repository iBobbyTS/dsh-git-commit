import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, inject } from '../lib/index.js';
import { generateMessage } from '../lib/core/message.js';

// Test the public host registration contract without a live DSH process.
test('Host exposes a native service and the authenticated Connection RPC channel', async () => {
  const services=[];
  const handlers=[];
  const routes=[];
  // DSH Connection registers RPC routes through the *caller's* webServer.
  // Model the Cordis injection guard so missing dependencies fail this test.
  const ctx={
    reflect:{provide:(name,service)=>{services.push({name,service});return ()=>{};}},
    effect:(dispose)=>{handlers.push({dispose});},
    get webServer() {
      if (!inject.includes('webServer')) throw new Error('cannot get property "webServer" without inject');
      return { register: route => { routes.push(route); return () => {}; } };
    },
    connection:{rpc:{handle:(channel,handler)=>{
      ctx.webServer.register({kind:'prefix',path:channel});
      handlers.push({channel,handler});
      return ()=>{};
    }}},
    get:()=>undefined,
    llm:{listProviders:()=>[],listModels:async()=>[]},
  };
  assert.deepEqual(inject,['connection','llm','webServer']);
  apply(ctx);
  assert.equal(services[0].name,'gitCommit');
  const channel=handlers.find(x=>x.channel);
  assert.equal(channel.channel,'/git-commit');
  assert.deepEqual(routes, [{kind:'prefix',path:'/git-commit'}]);
  const forbidden=await channel.handler('models',{},new AbortController().signal,{principal:{kind:'guest'}});
  assert.equal(forbidden.ok,false);
  assert.equal(forbidden.error.code,'FORBIDDEN');
  const unavailable=await channel.handler('unknown',{},new AbortController().signal,{principal:{kind:'owner'}});
  assert.equal(unavailable.ok,false);
  const ok=await channel.handler('models',{},new AbortController().signal,{principal:{kind:'owner'}});
  assert.equal(ok.ok,true);
  assert.deepEqual(ok.value.models,[]);
  await handlers.find(x=>x.dispose)?.dispose();
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
