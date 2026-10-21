import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// These names are from the shipped DSH Web/Desktop profile and the actual
// published manifest identities (packages/client/{connection,ui-renderer,
// ui-layout,ui-session,ui-sidebar-right}/package.json), not invented services.
const BUILT_IN_CLIENT_PACKAGES = new Set([
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-sidebar-right',
]);

test('Client loader declares only real DSH package dependencies', () => {
  assert.equal(manifest.name, 'dsh-git-commit');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.exports['./client'], './lib/client.js');
  assert.deepEqual(new Set(manifest.dsh.client.inject), BUILT_IN_CLIENT_PACKAGES);
  for (const dependency of manifest.dsh.client.inject) {
    assert.ok(BUILT_IN_CLIENT_PACKAGES.has(dependency), `unknown package ${dependency}`);
  }
  assert.ok(!manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'));
});

function readVirtualDom(node, predicate, found = []) {
  if (Array.isArray(node)) {
    for (const child of node) readVirtualDom(child, predicate, found);
    return found;
  }
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  for (const child of node.children ?? []) readVirtualDom(child, predicate, found);
  return found;
}

/** Minimal hook scheduler runs the published browser bundle (including effects). */
function clientHarness({ initial = 'one', failSave = false } = {}) {
  const sessions = { ids: ['one', 'two'], byId: {
    one: { id: 'one', cwd: '/example/repo-one' },
    two: { id: 'two', cwd: '/example/plain-directory' },
  }};
  const selected = { value: initial, subscribe: () => () => {}, getSnapshot() { return selected.value; } };
  const saved = { globalInstruction: 'Global', model: null };
  const repoConfig = { repositoryInstruction: 'Repository', inheritGlobal: true };
  const calls = [];
  let activeScope;
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useState(initial) {
      const scope=activeScope, idx=scope.index++;
      if (!(idx in scope.hooks)) scope.hooks[idx] = { value: typeof initial === 'function' ? initial() : initial };
      return [scope.hooks[idx].value, value => {
        scope.hooks[idx].value=typeof value==='function'?value(scope.hooks[idx].value):value;
      }];
    },
    useRef(initial) {
      const scope=activeScope, idx=scope.index++;
      if (!(idx in scope.hooks)) scope.hooks[idx]={current:initial};
      return scope.hooks[idx];
    },
    useSyncExternalStore(_subscribe,getSnapshot) { return getSnapshot(); },
    useEffect(callback,deps) {
      const scope=activeScope, idx=scope.index++, previous=scope.hooks[idx];
      if(previous && deps.length===previous.deps.length && deps.every((x,i)=>x===previous.deps[i]))return;
      scope.hooks[idx]={deps,cleanup:previous?.cleanup};
      scope.pending.push({idx,callback});
    },
  };
  const registrations = [], definitions = new Map(), tabTypes = new Map(), opened=[], styleTags=[];
  const window = { __ModuleLoader__: { load: entry => registrations.push(entry) } };
  const document = {
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild: item => styleTags.push(item) },
  };
  let nextInterval=1;
  const intervals=new Map();
  runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'), {
    window,document,setTimeout,clearTimeout,
    setInterval:(fn)=>{const id=nextInterval++; intervals.set(id,fn);return id;},
    clearInterval:(id)=>intervals.delete(id),
  });
  assert.equal(registrations.length,1);
  const plugin=registrations[0].factory(name=>{
    assert.equal(name,'react');return React;
  });
  plugin.apply({
    effect: callback=>callback(),
    connection:{rpc:{call:async(_channel,_endpoint,{method,payload})=>{
      calls.push({method,payload});
      let value;
      if(method==='changeToken') value={token:payload.cwd.includes('repo-one') ? 1 : null};
      else if(method==='status')value=payload.cwd.includes('repo-one')
        ? {isRepository:true,root:'/example/repo-one',branch:'main',additions:268,deletions:141,stagedFiles:0,untracked:0,binary:0}
        : {isRepository:false,root:null};
      else if(method==='settings')value=payload.cwd.includes('repo-one')
        ? {...saved,...repoConfig,isRepository:true,root:'/example/repo-one'}
        : {...saved,repositoryInstruction:'',inheritGlobal:true,isRepository:false,root:null};
      else if(method==='models')value={models:[{provider:'mock',model:'m',providerName:'Mock',name:'M'}],defaultModel:null};
      else if(method==='saveSettings'){
        if(failSave)throw new Error('Permission denied');
        Object.assign(saved,payload.patch);
        if(payload.cwd.includes('repo-one'))Object.assign(repoConfig,payload.patch);
        value={...saved,...repoConfig,isRepository:payload.cwd.includes('repo-one')};
      }else throw new Error(`Unexpected RPC ${method}`);
      return {ok:true,value};
    } }},
    sidebarRight:{mounted:selected,openTab:kind=>opened.push(kind)},
    sidebarRightTabs:{register:def=>{tabTypes.set(def.kind,def);return()=>{};}},
    slots:{inject:(_key,callback)=>callback(),register:(opts,comp)=>{
      definitions.set(opts.name,comp);return()=>{};
    }},
  });
  function mount(slot) {
    const component=definitions.get(slot);
    assert.equal(typeof component,'function',slot);
    return {component,hooks:[],index:0,pending:[],mounted:true};
  }
  function render(scope,props={useSessions:selector=>selector(sessions)}) {
    scope.index=0;scope.pending=[];activeScope=scope;
    const dom=scope.component(props);
    activeScope=undefined;
    for(const {idx,callback} of scope.pending){
      scope.hooks[idx].cleanup?.();
      scope.hooks[idx].cleanup=callback();
    }
    return dom;
  }
  function unmount(scope){for(const slot of scope.hooks)if(typeof slot?.cleanup==='function')slot.cleanup();}
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return {sessions,selected,saved,repoConfig,calls,opened,definitions,tabTypes,styleTags,mount,render,unmount,settle};
}

const matchButton = (name) => node=>node.type==='button' && node.props['aria-label']===name;
const textOf = node=> typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join(' ') : (node?.children??[]).map(textOf).join(' ');

test('initial empty Session does not crash the global overlay; navigating to a repository activates it',async()=>{
  // In DSH the root shell mounts before a Session is selected. Previously,
  // optional-chain undefined === cwd undefined was true and null.data threw,
  // permanently retiring the shell.overlay entry for every later Session.
  const t=clientHarness({initial:null});
  const pill=t.mount('shell.overlay');
  assert.doesNotThrow(()=>t.render(pill));
  assert.equal(t.render(pill),null,'without selected Session no panel should show');
  t.selected.value='one';
  const loading=t.render(pill);
  assert.notEqual(loading,null,'selecting a Session reactivates the same mount');
  await t.settle();
  const ready=t.render(pill);
  const branch=readVirtualDom(ready,node=>node.props?.className==='dgc-branch');
  assert.equal(branch.length,1);
  assert.equal(branch[0].props.title,'/example/repo-one');
  assert.equal(textOf(branch[0]),'main');
  // Switching away later must again avoid a null-data dereference.
  t.selected.value=null;
  assert.equal(t.render(pill),null);
  t.unmount(pill);
});

test('Client manifest, visible Git panel, collapse and reopen use icon-only controls',async()=>{
  const t=clientHarness();
  assert.equal(t.styleTags[0].dataset.dshGitCommit,'true');
  assert.ok(t.styleTags[0].textContent.includes('body[data-ds-dark-theme] .dgc-card'));
  assert.equal(t.tabTypes.get('gitCommitSettings').id,'dsh-git-commit/settings');
  const p=t.mount('shell.overlay');
  t.render(p);
  await t.settle();
  const expanded=t.render(p);
  assert.equal(readVirtualDom(expanded,n=>n.props?.className==='dgc-branch')[0].props.title,'/example/repo-one');
  const commit=readVirtualDom(expanded,matchButton('Stage and commit all changes'));
  assert.equal(commit.length,1);
  assert.equal(commit[0].children[0].type,'svg','icon rather than a label');
  const settings=readVirtualDom(expanded,matchButton('Commit settings'));
  assert.equal(settings.length,1);
  assert.equal(settings[0].children[0].type,'svg');
  settings[0].props.onClick();
  assert.deepEqual(t.opened,['gitCommitSettings']);
  readVirtualDom(expanded,matchButton('Collapse Git commit'))[0].props.onClick();
  const collapsed=t.render(p);
  const git=readVirtualDom(collapsed,matchButton('Git commit'));
  assert.equal(git.length,1);
  assert.equal(git[0].props.title,'Git commit');
  assert.equal(readVirtualDom(collapsed,n=>n.props?.className==='dgc-branch').length,0);
  assert.equal(readVirtualDom(collapsed,n=>n.type==='button').length,1);
  assert.equal(git[0].children[0].type,'svg');
  git[0].props.onClick();
  assert.equal(readVirtualDom(t.render(p),matchButton('Collapse Git commit')).length,1);
  t.unmount(p);
});

test('Non-Git panel has only neutral text; accidentally opened settings are global-only',async()=>{
  const t=clientHarness({initial:'two'});
  const p=t.mount('shell.overlay');
  t.render(p);
  await t.settle();
  const dom=t.render(p);
  assert.equal(readVirtualDom(dom,n=>n.props?.className==='dgc-no-repo').length,1);
  assert.match(textOf(dom),/Not a git repository/);
  assert.equal(readVirtualDom(dom,n=>n.type==='button').length,0);
  assert.equal(readVirtualDom(dom,n=>n.props?.className==='dgc-error').length,0);
  const tab=t.mount('sidebar.right.pane.tab');
  t.render(tab);
  await t.settle();
  const page=t.render(tab);
  const fields=readVirtualDom(page,n=>n.type==='label').map(textOf);
  assert.match(fields.join('|'),/Global commit instruction.*Model/s);
  assert.doesNotMatch(fields.join('|'),/Repository commit instruction|Inherit global instruction/);
  assert.ok(readVirtualDom(page,n=>n.type==='hr').length===1);
  assert.match(textOf(page),/Not a git repository/);
  assert.equal(readVirtualDom(page,n=>n.type==='button').length,0);
  const global=readVirtualDom(page,n=>n.type==='textarea')[0];
  global.props.onChange({target:{value:'Updated global'}});
  global.props.onBlur();
  await t.settle();
  assert.equal(t.saved.globalInstruction,'Updated global');
  const patches=t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch);
  assert.deepEqual(JSON.parse(JSON.stringify(patches)),[{globalInstruction:'Updated global'}]);
  t.unmount(p);t.unmount(tab);
});

test('Repository settings follow requested order, auto-save partial patches, and only show save failures',async()=>{
  const t=clientHarness();
  const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  const page=t.render(tab);
  const tags=readVirtualDom(page,n=>['h3','label','hr','code','button'].includes(n.type)).map(n=>({type:n.type,text:textOf(n)}));
  assert.deepEqual(tags.map(t=>t.type),['h3','label','label','hr','label','label','code']);
  assert.equal(tags[0].text,'Git commit settings');
  assert.equal(tags.at(-1).text,'/example/repo-one');
  assert.doesNotMatch(textOf(page),/Saved|Save settings/);
  readVirtualDom(page,n=>n.type==='input' && n.props.type==='checkbox')[0].props.onChange({target:{checked:false}});
  await t.settle();
  const area=readVirtualDom(page,n=>n.type==='textarea')[1];
  area.props.onChange({target:{value:'New repo instruction'}});
  area.props.onBlur();
  await t.settle();
  assert.equal(t.repoConfig.repositoryInstruction,'New repo instruction');
  assert.equal(t.repoConfig.inheritGlobal,false);
  const patches=t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch);
  assert.deepEqual(JSON.parse(JSON.stringify(patches)),[{inheritGlobal:false},{repositoryInstruction:'New repo instruction'}]);
  t.unmount(tab);t.unmount(p);
  const failing=clientHarness({failSave:true});
  const fp=failing.mount('shell.overlay');failing.render(fp);await failing.settle();failing.render(fp);
  const ft=failing.mount('sidebar.right.pane.tab');failing.render(ft);await failing.settle();
  const fpage=failing.render(ft);
  const textarea=readVirtualDom(fpage,n=>n.type==='textarea')[0];
  textarea.props.onChange({target:{value:'Failure'}});
  textarea.props.onBlur();
  await failing.settle();
  assert.match(textOf(failing.render(ft)),/Failed to save settings: Permission denied/);
  failing.unmount(ft);failing.unmount(fp);
});
