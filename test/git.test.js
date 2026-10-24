import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, repoRoot, visibleStatus, plannedMode, preparedSnapshot, commitPrepared, parseNumstat } from '../lib/core/git.js';
import { GitCommitService } from '../lib/core/service.js';
import { InstructionStore } from '../lib/core/store.js';
import { reasoningSelection, activeInstructions, cleanMessage, splitFileDiffs, previewFileDiff, parseReadDecisions, generateMessage } from '../lib/core/message.js';
import { summarizeLlmCalls } from '../lib/core/metrics.js';

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'dgc-test-'));
  try {
    await git(root, ['init', '-b', 'main']);
    await git(root, ['config', 'user.name', 'Test']);
    await git(root, ['config', 'user.email', 'test@example.com']);
    await writeFile(join(root,'a.txt'),'one\n');
    await git(root,['add','-A']); await git(root,['commit','-m','initial']);
    return await fn(root);
  } finally { await rm(root,{recursive:true,force:true}); }
}
const ctx = {llm:{listProviders:()=>[], listModels:async()=>[]},get:()=>undefined};

test('staged only never commits unstaged changes, returns 7-char hash and accurate lines', async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\ntwo\n');
  await git(root,['add','a.txt']);
  await writeFile(join(root,'a.txt'),'one\ntwo\nthree\n');
  assert.equal(await plannedMode(root),'staged');
  const service=new GitCommitService(ctx);
  const result=await service.commit({cwd:root,message:'feat: add two'});
  assert.equal(result.success,true,result.error);
  assert.equal(result.scope,'staged');
  assert.equal(result.hash.length,7);
  assert.equal(result.additions,1);
  assert.equal(result.deletions,0);
  assert.equal((await git(root,['show','HEAD:a.txt'])), 'one\ntwo\n');
  assert.equal((await readFile(join(root,'a.txt'),'utf8')), 'one\ntwo\nthree\n');
  assert.equal((await git(root,['diff','--name-only'])).trim(),'a.txt');
  service.close();
}));

test('no staged entries means all tracked and untracked changes are committed', async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nchanged\n');
  await writeFile(join(root,'new.txt'),'new\nfile\n');
  const before=await visibleStatus(root);
  assert.equal(before.additions,3);
  assert.equal(before.deletions,0);
  const service=new GitCommitService(ctx);
  const result=await service.commit({cwd:root,message:'feat: add files'});
  assert.equal(result.success,true,result.error);
  assert.equal(result.scope,'all');
  assert.equal(result.additions,3,result.message);
  assert.equal(result.deletions,0);
  assert.equal((await git(root,['status','--porcelain'])).trim(),'');
  assert.equal((await git(root,['show','HEAD:new.txt'])), 'new\nfile\n');
  service.close();
}));

test('no staged changes are staged before model generation and survive a failed generation', async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nchanged\n');
  await writeFile(join(root,'new.txt'),'new file\n');
  assert.equal(await plannedMode(root),'all');
  let inspected=false;
  const llm={listProviders:()=>[{id:'mock',name:'Mock'}],
    listModels:async()=>[{provider:'mock',id:'m',name:'Model'}],
    resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'}]}})};
  const service=new GitCommitService({...ctx,llm},{
    store:new InstructionStore(join(root,'.git','settings-test.json')),
    generator:async snapshot=>{
      inspected=true;
      assert.equal(snapshot.mode,'staged','model input must be the real staged index');
      assert.deepEqual((await git(root,['diff','--cached','--name-only'])).trim().split('\n'),
        ['a.txt','new.txt'],'git add -A runs before model generation');
      throw new Error('simulated LLM failure');
    },
  });
  try {
    const result=await service.commit({cwd:root});
    assert.equal(inspected,true);
    assert.equal(result.success,false);
    assert.equal(result.scope,'all');
    assert.match(result.error,/simulated LLM failure/);
    assert.equal((await git(root,['diff','--cached','--name-only'])).trim().split('\n').length,2,
      'failed generation intentionally preserves staging');
    assert.equal((await git(root,['log','-1','--format=%s'])).trim(),'initial');
  }finally{service.close();}
}));

test('snapshot preparation does not mutate index, and rejects worktree changes', async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nchanged\n');
  const snapshot=await preparedSnapshot(root,'all');
  assert.equal((await git(root,['diff','--cached','--name-only'])).trim(),'');
  await writeFile(join(root,'a.txt'),'one\ndifferent\n');
  await assert.rejects(commitPrepared(snapshot,'test: stale'),/Working tree changed/);
  assert.equal((await git(root,['diff','--cached','--name-only'])).trim(),'');
  assert.equal((await git(root,['log','-1','--format=%s'])).trim(),'initial');
}));

test('programmatic API generates model message and responds with requested contract', async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nnew\n');
  const store=new InstructionStore(join(root,'.git','settings.json'));
  await store.save(root,{globalInstruction:'Global',repositoryInstruction:'Repo',inheritGlobal:true});
  let observed;
  const service=new GitCommitService(ctx,{store, generator:async(snapshot,settings,call)=>{
    observed={snapshot,settings};
    return 'fix: correct behavior';
  }});
  const result=await service.commit({cwd:root});
  assert.equal(result.success,false); // no provider: a model must be configured rather than silently using a random one
  assert.match(result.error,/No configured DSH model/);
  const service2=new GitCommitService({ ...ctx, llm:{...ctx.llm,listProviders:()=>[{id:'mock',name:'Mock'}],listModels:async()=>[{provider:'mock',id:'m1',name:'M1'}],resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'},{id:'low'}]}})} },{store,generator:async(snapshot,settings)=>{
    observed={snapshot,settings};return 'fix: correct behavior';
  }});
  const done=await service2.commit({cwd:root});
  assert.equal(done.success,true,done.error);
  assert.deepEqual({additions:done.additions,deletions:done.deletions},{additions:1,deletions:0});
  assert.equal(done.message,'fix: correct behavior');
  assert.match(done.hash,/^[0-9a-f]{7}$/);
  assert.equal(observed.settings.globalInstruction,'Global');
  service.close(); service2.close();
}));

test('settings inheritance, model selection, and deterministic reasoning',async()=>{
  assert.equal(reasoningSelection({reasoning:{efforts:[{id:'off'},{id:'low'},{id:'high'}]}}),'off');
  assert.equal(reasoningSelection({reasoning:{efforts:[{id:'low'},{id:'high'}]}}),'low');
  assert.equal(reasoningSelection({} ),undefined);
  // Classifier uses lowest non-Off level, unless Off is the only level.
  const offLowHigh={reasoning:{efforts:[{id:'off'},{id:'low'},{id:'medium'},{id:'high'}]}};
  assert.equal(reasoningSelection(offLowHigh,'decide'),'low');
  assert.equal(reasoningSelection(offLowHigh,'generate'),'off');
  assert.equal(reasoningSelection({reasoning:{efforts:[{id:'off'}]}},'decide'),'off');
  assert.equal(reasoningSelection({reasoning:{efforts:[{id:'medium'},{id:'high'}]}},'decide'),'medium');
  assert.equal(reasoningSelection({reasoning:{efforts:[{id:'medium'},{id:'high'}]}},'generate'),'medium');
  assert.equal(reasoningSelection({},'decide'),undefined);
  const settings={globalInstruction:'G',repositoryInstruction:'R',inheritGlobal:true};
  assert.match(activeInstructions(settings),/GLOBAL/);
  assert.doesNotMatch(activeInstructions({...settings,inheritGlobal:false}),/GLOBAL/);
  assert.equal(cleanMessage('```text\nfeat: update\n```'),'feat: update');
});

test('per-file patches preserve Git inventory, unicode paths and renames',async()=>fixture(async root=>{
  const unusual='my file 测试.txt';
  await writeFile(join(root,unusual),'one\ntwo unicode marker\n');
  await git(root,['mv','a.txt','renamed a.txt']);
  await git(root,['add','-A']);
  const snapshot=await preparedSnapshot(root,'staged');
  const chunks=splitFileDiffs(snapshot);
  assert.equal(chunks.length,snapshot.paths.length);
  assert.deepEqual(chunks.map(x=>x.path),snapshot.paths);
  const unicode=chunks.find(x=>x.path===unusual);
  assert.match(unicode.diff,/two unicode marker/);
  assert.equal(unicode.changedLines,2);
  assert.ok(chunks.some(x=>x.path==='renamed a.txt'));
  assert.deepEqual(parseReadDecisions('invalid',chunks),new Set(chunks.map(x=>x.id)));
  assert.equal(previewFileDiff(unicode,2).split('\n').filter(Boolean).length,2);
}));

test('numstat parser handles renames and binary changes',()=>{
  assert.deepEqual(parseNumstat(['12\t3\tsrc/a.ts', '-\t-\timg.png', '3\t1\t', 'a', 'b', ''].join('\0')),{additions:15,deletions:4,binary:1});
});

test('repository model overrides persist independently and inherit global without settings migration',async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-cfg-'));
  try {
    const file=join(base,'settings.json');
    const store=new InstructionStore(file);
    await store.save('/a',{inheritGlobal:false,repositoryInstruction:'A',globalInstruction:'global',
      model:{provider:'mock',model:'global'},repositoryModel:{provider:'mock',model:'repo-a'}});
    await store.save('/b',{repositoryInstruction:'B'});
    const fresh=new InstructionStore(file);
    assert.equal((await fresh.get('/a')).inheritGlobal,false);
    assert.equal((await fresh.get('/b')).inheritGlobal,true);
    assert.equal((await fresh.get('/b')).globalInstruction,'global');
    assert.deepEqual((await fresh.get('/b')).model,{provider:'mock',model:'global'});
    assert.equal((await fresh.get('/b')).repositoryModel,null);
    assert.deepEqual((await fresh.get('/a')).repositoryModel,{provider:'mock',model:'repo-a'});
    await store.save(null,{model:{provider:'mock',model:'new-global'}});
    assert.deepEqual((await fresh.get('/a')).repositoryModel,{provider:'mock',model:'repo-a'},
      'global model updates cannot overwrite explicit repository selection');
    assert.deepEqual((await fresh.get('/b')).model,{provider:'mock',model:'new-global'});
    await store.save('/a',{repositoryModel:null});
    assert.equal((await fresh.get('/a')).repositoryModel,null);
    const raw=JSON.parse(await readFile(file,'utf8'));
    assert.equal(raw.repositories['/a'].model,null);
    assert.deepEqual(raw.global.model,{provider:'mock',model:'new-global'});
    await assert.rejects(store.save(null,{repositoryModel:{provider:'mock',model:'bad'}}),/require a Git repository/);
    await assert.rejects(store.save('/a',{repositoryModel:{provider:'',model:'bad'}}),/Invalid repositoryModel selection/);
    await assert.rejects(store.save('/a',{repositoryModel:{provider:'mock',model:''}}),/Invalid repositoryModel selection/);
    assert.equal((await fresh.get('/a')).repositoryModel,null);
    await writeFile(file,JSON.stringify({version:1,global:{instruction:'legacy',model:{provider:'old',model:'model'}},
      repositories:{'/a':{instruction:'old repo'}}}));
    const legacy=await fresh.get('/a');
    assert.deepEqual(legacy.model,{provider:'old',model:'model'});
    assert.equal(legacy.repositoryModel,null,'old v1 settings must inherit global');
  } finally {await rm(base,{recursive:true,force:true});}
});

test('chosen model follows repository override, global override, DSH default and fallback in order', async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-route-'));
  const store=new InstructionStore(join(base,'settings.json'));
  const resolved=[];
  const llm={
    listProviders:()=>[{id:'mock',name:'Mock'}],
    listModels:async()=>[{id:'first',name:'First'},{id:'last',name:'Last'}],
    resolveModelInfo:async(provider,model)=>{resolved.push(`${provider}/${model}`);return {reasoning:{efforts:[{id:'off'}]}};},
  };
  let dshDefault={provider:'mock',model:'default'};
  const service=new GitCommitService({
    llm,get:()=>({currentSelection:()=>dshDefault}),
  },{store});
  try {
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'default');
    await store.save(null,{model:{provider:'mock',model:'global'}});
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'global');
    await store.save('/a',{repositoryModel:{provider:'mock',model:'specific'}});
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'specific');
    assert.equal((await service.chosenModel(await store.get('/b'))).model,'global');
    await store.save('/a',{repositoryModel:null});
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'global');
    await store.save(null,{model:null});
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'default');
    dshDefault=null;
    assert.equal((await service.chosenModel(await store.get('/a'))).model,'first');
    assert.equal(resolved.at(-1),'mock/first');
  } finally {service.close();await rm(base,{recursive:true,force:true});}
});

test('non-Git workspaces expose a neutral status and editable global settings without creating repo entries',async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-plain-'));
  try {
    await mkdir(join(base,'视频'));
    const cwd=join(base,'视频');
    const store=new InstructionStore(join(base,'settings.json'));
    const service=new GitCommitService({
      ...ctx,
      llm:{...ctx.llm,resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'}]}})},
    }, {store});
    const status=await service.status({cwd});
    assert.deepEqual(status,{isRepository:false,root:null});
    assert.deepEqual(await service.changeToken({cwd}),{token:null,commitState:null});
    assert.deepEqual(await service.settings({cwd}),{
      globalInstruction:'',repositoryInstruction:'',inheritGlobal:true,model:null,repositoryModel:null,autoHideNonGit:false,showTokenDetails:false,countdownColor:'#f59e0b',floatingPosition:null,
      isRepository:false,root:null,
    });
    const saved=await service.saveSettings({cwd,patch:{globalInstruction:'No scope',model:{provider:'mock',model:'x'}}});
    assert.equal(saved.isRepository,false);
    assert.equal(saved.globalInstruction,'No scope');
    assert.deepEqual(saved.model,{provider:'mock',model:'x'});
    assert.deepEqual((await service.settings({})).model,{provider:'mock',model:'x'});
    await assert.rejects(service.saveSettings({cwd,patch:{repositoryInstruction:'reject'}}),/require a Git repository/);
    await assert.rejects(service.saveSettings({cwd,patch:{inheritGlobal:false}}),/require a Git repository/);
    await assert.rejects(service.saveSettings({cwd,patch:{repositoryModel:{provider:'mock',model:'x'}}}),/require a Git repository/);
    const raw=JSON.parse(await readFile(join(base,'settings.json'),'utf8'));
    assert.deepEqual(raw.repositories,{},'non-Git global edits must not create a fake repository');
    await git(cwd,['init','-b','main']);
    const now=await service.status({cwd});
    assert.equal(now.isRepository,true);
    assert.equal(now.branch,'main');
    assert.equal((await service.settings({cwd})).isRepository,true);
    service.close();
  }finally{await rm(base,{recursive:true,force:true});}
});

test('Automatic non-Git hide is an independent global boolean persisted across repositories', async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-visibility-'));
  try {
    const filename=join(base,'settings.json');
    const store=new InstructionStore(filename);
    assert.equal((await store.get(null)).autoHideNonGit,false);
    await store.save('/one',{autoHideNonGit:true});
    const fresh=new InstructionStore(filename);
    assert.equal((await fresh.get(null)).autoHideNonGit,true);
    assert.equal((await fresh.get('/one')).autoHideNonGit,true);
    assert.equal((await fresh.get('/other')).autoHideNonGit,true);
    assert.equal((await fresh.save(null,{autoHideNonGit:false})).autoHideNonGit,false);
    assert.equal((await new InstructionStore(filename).get('/one')).autoHideNonGit,false);
    await assert.rejects(store.save(null,{autoHideNonGit:'yes'}),/autoHideNonGit must be a boolean/);
    assert.equal((await fresh.get(null)).autoHideNonGit,false);
    const raw=JSON.parse(await readFile(filename,'utf8'));
    assert.equal(raw.global.autoHideNonGit,false);
  } finally { await rm(base,{recursive:true,force:true}); }
});


test('TokenUsage aggregation counts cache writes once and computes true decode speed across overlapping model calls',()=>{
  const usage=summarizeLlmCalls([
    {startedAt:0,firstTokenAt:100,endedAt:1100,
      usage:{inputTokens:100,outputTokens:200,cacheReadTokens:10,cacheWriteTokens:20,reasoningTokens:5}},
    {startedAt:50,firstTokenAt:120,endedAt:1120,
      usage:{inputTokens:50,outputTokens:100,cacheReadTokens:30}},
  ]);
  assert.deepEqual(usage,{
    calls:2,inputTokens:210,outputTokens:300,cacheReadTokens:40,cacheWriteTokens:20,
    reasoningTokens:5,latencyMs:100,durationMs:1120,outputSpeedTps:150,
  });
  assert.equal(summarizeLlmCalls([]),null);
  const incomplete=summarizeLlmCalls([
    {startedAt:5,firstTokenAt:null,endedAt:10,usage:null},
    {startedAt:10,firstTokenAt:15,endedAt:20,usage:{inputTokens:2,outputTokens:5}},
  ]);
  assert.equal(incomplete.calls,2);
  assert.equal(incomplete.inputTokens,null,'do not present partial/missing provider usage as complete');
  assert.equal(incomplete.outputTokens,null);
  assert.equal(incomplete.outputSpeedTps,null);
  assert.equal(incomplete.latencyMs,10);
});

test('global token details and countdown color persist with strict validation and old settings compatibility',async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-telemetry-'));
  try {
    const path=join(base,'settings.json');
    const store=new InstructionStore(path);
    assert.equal((await store.get(null)).showTokenDetails,false);
    assert.equal((await store.get(null)).countdownColor,'#f59e0b');
    const next=await store.save(null,{showTokenDetails:true,countdownColor:'#AB45C0'});
    assert.equal(next.showTokenDetails,true);
    assert.equal(next.countdownColor,'#ab45c0');
    assert.equal((await new InstructionStore(path).get('/repository')).showTokenDetails,true);
    assert.equal((await new InstructionStore(path).get('/repository')).countdownColor,'#ab45c0');
    await assert.rejects(store.save(null,{showTokenDetails:'yes'}),/showTokenDetails must be a boolean/);
    await assert.rejects(store.save(null,{countdownColor:'red'}),/#RRGGBB/);
    await assert.rejects(store.save(null,{countdownColor:'#abcd'}),/#RRGGBB/);
    // Old v0.1.7 settings have no new fields. No migration required.
    await writeFile(path,JSON.stringify({version:1,global:{instruction:'legacy',model:null},repositories:{}}));
    assert.deepEqual({showTokenDetails:(await store.get(null)).showTokenDetails,
      countdownColor:(await store.get(null)).countdownColor},
      {showTokenDetails:false,countdownColor:'#f59e0b'});
  } finally { await rm(base,{recursive:true,force:true}); }
});

test('direct AI calls aggregate metrics in existing programmatic commit response, while caller-supplied messages do not',async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nnew\n');
  let count=0;
  const llm={listProviders:()=>[{id:'mock',name:'Mock'}],
    listModels:async()=>[{id:'model',name:'Model'}],
    resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'}]}})};
  const service=new GitCommitService({...ctx,llm},{
    store:new InstructionStore(join(root,'.git','telemetry-settings.json')),
    callModel:async()=>{
      await new Promise(resolve=>setTimeout(resolve,20));
      return {text:'summary',firstTokenMs:2,
        usage:{inputTokens:10+count++,cacheReadTokens:5,cacheWriteTokens:3,outputTokens:20}};
    },
    generator:async(_snap,_settings,call)=>{
      await Promise.all([
        call({system:'test',prompt:'map1',maxTokens:20}),
        call({system:'test',prompt:'map2',maxTokens:20}),
      ]);
      await call({system:'test',prompt:'reduce',maxTokens:20});
      return 'feat: generated with metrics';
    },
  });
  try {
    const result=await service.commit({cwd:root});
    assert.equal(result.success,true,result.error);
    assert.equal(result.llm.calls,3);
    assert.equal(result.llm.inputTokens,57,'uncached 33 plus cache-read 15 and cache-write 9');
    assert.equal(result.llm.outputTokens,60);
    assert.equal(result.llm.cacheReadTokens,15);
    assert.equal(result.llm.cacheWriteTokens,9);
    assert.ok(result.llm.latencyMs!==null&&result.llm.latencyMs>=0);
    assert.ok(result.llm.outputSpeedTps!==null&&result.llm.outputSpeedTps>0);
    assert.ok(result.llm.durationMs>=20);
    assert.ok(result.totalDurationMs>=result.llm.durationMs);
    await writeFile(join(root,'a.txt'),'one\nnew\nthird\n');
    const manual=await service.commit({cwd:root,message:'test: caller supplied'});
    assert.equal(manual.success,true);
    assert.equal(Object.hasOwn(manual,'llm'),false,'no LLM calls means no fabricated TokenUsage');
  } finally {service.close();}
}));

const tinySettings={globalInstruction:'',repositoryInstruction:'',inheritGlobal:true};
const hugeData=Array.from({length:2300},(_,i)=>`line-${i} GENERATED_SNAPSHOT_CONTENT_${i}`).join('\n')+'\n';

async function largeSnapshotFixture(fn) {
  return fixture(async root=>{
    await mkdir(join(root,'drizzle','meta'),{recursive:true});
    await mkdir(join(root,'drizzle','migrations'),{recursive:true});
    await writeFile(join(root,'drizzle','meta','0000_snapshot.json'), hugeData);
    await writeFile(join(root,'drizzle','migrations','0001_schema.sql'),
      'ALTER TABLE users ADD COLUMN avatar_url text;\n');
    await git(root,['add','-A']);
    const snapshot=await preparedSnapshot(root,'staged');
    return fn(root,snapshot);
  });
}

test('large snapshot + migration sends 1 classifier and 1 generator; rejected full read keeps 200-line preview',async()=>largeSnapshotFixture(async(_root,snapshot)=>{
  const phases=[];
  const result=await generateMessage(snapshot,tinySettings,async call=>{
    phases.push(call);
    if(call.purpose==='classify') return JSON.stringify({decisions:[{id:2,readFullDiff:false}]});
    return 'feat(db): add user avatar column';
  },{redact:text=>text,contextWindow:1_000_000,decisionReasoningEffort:'low',generationReasoningEffort:'off'});
  // The large snapshot position depends on Git file sorting. Classifier output
  // above may default to full if its id is not 2; the test also checks it.
  const big=splitFileDiffs(snapshot).find(file=>file.changedLines>2000);
  assert.ok(big);
  assert.equal(phases.length,2);
  assert.equal(phases[0].purpose,'classify');
  assert.equal(phases[0].reasoningEffort,'low');
  assert.equal(phases[1].purpose,'generate');
  assert.equal(phases[1].reasoningEffort,'off');
  assert.equal(result,'feat(db): add user avatar column');
  assert.match(phases[0].prompt,/0000_snapshot\.json/);
  assert.match(phases[0].prompt,/0001_schema\.sql/);
  assert.doesNotMatch(phases[0].prompt,/ALTER TABLE users/,'classifier sees paths, not the small migration content');
  const included=big.id===2;
  if(included){
    assert.match(phases[1].prompt,/TRUNCATED GIT PATCH PREVIEW/);
    assert.match(phases[1].prompt,/remainder was NOT read/);
    assert.doesNotMatch(phases[1].prompt,/GENERATED_SNAPSHOT_CONTENT_2299/);
  }
  assert.match(phases[1].prompt,/ALTER TABLE users ADD COLUMN avatar_url text/);
}));

test('classifier decisions use actual per-file IDs; full read includes tail, skip truncates exactly at 200 lines',async()=>largeSnapshotFixture(async(_root,snapshot)=>{
  const big=splitFileDiffs(snapshot).find(file=>file.changedLines>2000);
  assert.ok(big);
  for(const full of [false,true]){
    const calls=[];
    await generateMessage(snapshot,tinySettings,async args=>{
      calls.push(args);
      return args.purpose==='classify'
        ? JSON.stringify({decisions:[{id:big.id,readFullDiff:full}]})
        : 'feat(db): migrate schema';
    },{redact:text=>text,contextWindow:1_000_000});
    assert.equal(calls.length,2);
    const generated=calls[1].prompt;
    assert.equal(generated.includes('GENERATED_SNAPSHOT_CONTENT_2299'),full);
    if(!full){
      assert.match(generated,/TRUNCATED GIT PATCH PREVIEW/);
      const preview=previewFileDiff(big);
      assert.equal(preview.split('\n').filter(Boolean).length,200);
      assert.ok(generated.includes(preview));
    }else assert.match(generated,/FULL GIT PATCH/);
  }
}));

test('small changes always take one request, even with many files, and include full patches',async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\ntiny change\n');
  await git(root,['add','a.txt']);
  const snapshot=await preparedSnapshot(root,'staged');
  const calls=[];
  const result=await generateMessage(snapshot,tinySettings,async arg=>{
    calls.push(arg); return 'fix: small change';
  },{redact:text=>text,contextWindow:32768});
  assert.equal(result,'fix: small change');
  assert.equal(calls.length,1);
  assert.equal(calls[0].purpose,'generate');
  assert.match(calls[0].prompt,/tiny change/);
}));

test('missing, duplicated and invalid classifier IDs default to reading full patch',()=>{
  const files=[{id:1},{id:2}];
  assert.deepEqual(parseReadDecisions('{"decisions":[{"id":1,"readFullDiff":false}]}',files),new Set([2]));
  assert.deepEqual(parseReadDecisions('{"decisions":[{"id":1,"readFullDiff":false},{"id":1,"readFullDiff":false}]}',files),new Set([1,2]));
  assert.deepEqual(parseReadDecisions('{"decisions":[{"id":1,"readFullDiff":"no"}]}',files),new Set([1,2]));
  assert.deepEqual(parseReadDecisions('not JSON',files),new Set([1,2]));
});

test('redaction is applied before both LLM calls to paths, diff, and user instructions',async()=>largeSnapshotFixture(async(_root,snapshot)=>{
  const calls=[];
  const secret='AKIAABCDEFGHIJKLMNOP';
  const userSettings={globalInstruction:`Use ${secret} token`,repositoryInstruction:'',inheritGlobal:true};
  const redact=text=>text.replaceAll(secret,'<REDACTED>');
  await generateMessage(snapshot,userSettings,async arg=>{
    calls.push(arg);
    return arg.purpose==='classify' ? 'not JSON' : 'chore: update schema metadata';
  },{redact,contextWindow:1_000_000});
  assert.equal(calls.length,2);
  for(const call of calls){
    assert.doesNotMatch(call.prompt,new RegExp(secret));
  }
  assert.doesNotMatch(calls[1].system,new RegExp(secret));
  assert.match(calls[1].system,/<REDACTED>/);
}));

test('snapshot budget and capture failures never silently discard Diff or trigger more requests',async()=>largeSnapshotFixture(async(_root,snapshot)=>{
  let calls=0;
  await assert.rejects(generateMessage(snapshot,tinySettings,async arg=>{
    calls++;
    return arg.purpose==='classify' ? '{"decisions":[]}' : 'chore: snapshot';
  },{redact:text=>text,contextWindow:3000}),/single-call safety budget/);
  assert.equal(calls,0);
  await assert.rejects(generateMessage({...snapshot,clipped:true},tinySettings,async()=>{
    calls++;return 'chore: update';
  },{redact:text=>text}),/incomplete file coverage/);
  assert.equal(calls,0);
}));

test('production service propagates distinct classification/generation efforts and commits at most twice',async()=>largeSnapshotFixture(async(root,_snapshot)=>{
  const calls=[];
  const llm={listProviders:()=>[{id:'mock',name:'Mock'}],listModels:async()=>[{id:'model',name:'Model'}],
    resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'},{id:'low'},{id:'high'}]},context:{contextWindow:1_000_000}})};
  const service=new GitCommitService({...ctx,llm},{
    store:new InstructionStore(join(root,'.git','settings-test.json')),
    generator:(snapshot,settings,call,options)=>generateMessage(snapshot,settings,call,{...options,redact:text=>text}),
    callModel:async arg=>{
      calls.push(arg);
      const big=splitFileDiffs(await preparedSnapshot(root,'staged')).find(f=>f.changedLines>2000);
      return {text:arg.purpose==='classify'
        ? JSON.stringify({decisions:[{id:big.id,readFullDiff:false}]})
        : 'feat(db): add avatar URL',
      usage:{inputTokens:40,outputTokens:20,cacheReadTokens:10},firstTokenMs:1};
    },
  });
  try {
    const result=await service.commit({cwd:root});
    assert.equal(result.success,true,result.error);
    assert.equal(result.llm.calls,2);
    assert.equal(calls.length,2);
    assert.deepEqual(calls.map(call=>call.selection.reasoningEffort),['low','off']);
    assert.equal(result.llm.inputTokens,100);
    assert.equal(result.llm.outputTokens,40);
    assert.equal(result.message,'feat(db): add avatar URL');
  } finally {service.close();}
}));

test('floating position persists globally, validates coordinates and remains backward compatible',async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-position-'));
  try {
    const filename=join(base,'settings.json');
    const store=new InstructionStore(filename);
    assert.equal((await store.get('/a')).floatingPosition,null);
    const saved=await store.save('/a',{floatingPosition:{right:235,top:162}});
    assert.deepEqual(saved.floatingPosition,{right:235,top:162});
    assert.deepEqual((await new InstructionStore(filename).get('/another')).floatingPosition,{right:235,top:162});
    await assert.rejects(store.save(null,{floatingPosition:{right:-1,top:30}}),/floatingPosition/);
    await assert.rejects(store.save(null,{floatingPosition:{right:Number.POSITIVE_INFINITY,top:30}}),/floatingPosition/);
    await assert.rejects(store.save(null,{floatingPosition:{right:30,top:'4'}}),/floatingPosition/);
    assert.deepEqual((await store.get('/a')).floatingPosition,{right:235,top:162});
    const cleared=await store.save(null,{floatingPosition:null});
    assert.equal(cleared.floatingPosition,null);
    assert.equal((await new InstructionStore(filename).get('/another')).floatingPosition,null);
  }finally{await rm(base,{recursive:true,force:true});}
});

test('concurrent commit callers share the same result and publish progress',async()=>fixture(async root=>{
  await writeFile(join(root,'a.txt'),'one\nshared\n');
  const store=new InstructionStore(join(root,'.git','settings.json'));
  let release;
  let starts=0;
  const pause=new Promise(resolve=>{release=resolve;});
  const service=new GitCommitService({ ...ctx, llm:{...ctx.llm,listProviders:()=>[{id:'mock',name:'Mock'}],listModels:async()=>[{provider:'mock',id:'m1',name:'M1'}],resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'}]}})} },{store,generator:async()=>{
    starts++;
    await pause;
    return 'fix: shared commit';
  }});
  try {
    const first=service.commit({cwd:root});
    const second=service.commit({cwd:root});
    for(let n=0;n<25&&!starts;n++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(starts,1);
    const state=await service.changeToken({cwd:root});
    assert.equal(state.commitState.working,true);
    release();
    const [a,b]=await Promise.all([first,second]);
    assert.deepEqual(a,b);
    assert.equal(a.success,true,a.error);
    const done=await service.changeToken({cwd:root});
    assert.equal(done.commitState.working,false);
    assert.deepEqual(done.commitState.result,a);
    assert.equal((await git(root,['rev-list','--count','HEAD'])).trim(),'2');
  }finally{release();service.close();}
}));
