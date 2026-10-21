import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, repoRoot, visibleStatus, plannedMode, preparedSnapshot, commitPrepared, parseNumstat } from '../lib/core/git.js';
import { GitCommitService } from '../lib/core/service.js';
import { InstructionStore } from '../lib/core/store.js';
import { reasoningSelection, activeInstructions, makeBatches, cleanMessage } from '../lib/core/message.js';

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
  const settings={globalInstruction:'G',repositoryInstruction:'R',inheritGlobal:true};
  assert.match(activeInstructions(settings),/GLOBAL/);
  assert.doesNotMatch(activeInstructions({...settings,inheritGlobal:false}),/GLOBAL/);
  assert.equal(cleanMessage('```text\nfeat: update\n```'),'feat: update');
});

test('file chunks are grouped without dropping trailing files, oversized sections get split',()=>{
  const split = diff => diff.split(/(?=diff --git )/).filter(Boolean);
  const group = (chunks, max) => { const batches=[];let acc='';for(const part of chunks){if(acc&&acc.length+part.length>max){batches.push(acc);acc='';}acc+=part;}if(acc)batches.push(acc);return batches;};
  const utils={splitUnifiedDiffIntoFileChunks:split,groupDiffChunksByBudget:group};
  const diff='diff --git a/a b/a\n' + Array.from({length:50}, (_,i)=>`+${i} change\n`).join('') + 'diff --git a/z b/z\n+last line\n';
  const batches=makeBatches(diff,130,utils);
  assert.ok(batches.length>2);
  assert.ok(batches.some(s=>s.includes('last line')));
  assert.ok(batches.every(s=>s.length<=180));
});

test('numstat parser handles renames and binary changes',()=>{
  assert.deepEqual(parseNumstat(['12\t3\tsrc/a.ts', '-\t-\timg.png', '3\t1\t', 'a', 'b', ''].join('\0')),{additions:15,deletions:4,binary:1});
});

test('settings persist per-repository inherit toggle and global model',async()=>{
  const base=await mkdtemp(join(tmpdir(),'dgc-cfg-'));
  try {
    const store=new InstructionStore(join(base,'settings.json'));
    await store.save('/a',{inheritGlobal:false,repositoryInstruction:'A',globalInstruction:'global',model:{provider:'mock',model:'x'}});
    await store.save('/b',{repositoryInstruction:'B'});
    assert.equal((await store.get('/a')).inheritGlobal,false);
    assert.equal((await store.get('/b')).inheritGlobal,true);
    assert.equal((await store.get('/b')).globalInstruction,'global');
    assert.deepEqual((await store.get('/b')).model,{provider:'mock',model:'x'});
  } finally {await rm(base,{recursive:true,force:true});}
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
    assert.deepEqual(await service.changeToken({cwd}),{token:null});
    assert.deepEqual(await service.settings({cwd}),{
      globalInstruction:'',repositoryInstruction:'',inheritGlobal:true,model:null,autoHideNonGit:false,
      isRepository:false,root:null,
    });
    const saved=await service.saveSettings({cwd,patch:{globalInstruction:'No scope',model:{provider:'mock',model:'x'}}});
    assert.equal(saved.isRepository,false);
    assert.equal(saved.globalInstruction,'No scope');
    assert.deepEqual(saved.model,{provider:'mock',model:'x'});
    assert.deepEqual((await service.settings({})).model,{provider:'mock',model:'x'});
    await assert.rejects(service.saveSettings({cwd,patch:{repositoryInstruction:'reject'}}),/require a Git repository/);
    await assert.rejects(service.saveSettings({cwd,patch:{inheritGlobal:false}}),/require a Git repository/);
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
