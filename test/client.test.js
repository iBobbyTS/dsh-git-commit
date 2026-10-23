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

test('DSH boot graph can materialize the Client under its exact npm package identity', () => {
  const registrations = new Map();
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ id, factory }) => registrations.set(id, factory) } },
  });
  assert.equal(registrations.size, 1, 'one client registration per bundle');
  assert.equal(typeof registrations.get(manifest.name), 'function',
    `DSH expects __ModuleLoader__.load to register ${manifest.name}, not an unscoped alias`);
});

test('Client loader declares only real DSH package dependencies', () => {
  assert.equal(manifest.name, '@ibobbyts/dsh-git-commit');
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
function clientHarness({ initial = 'one', failSave = false, initialHide = false, initialShowTokens = false, initialColor = '#f59e0b', branchName = 'main', initialPosition = null, simulateDom = false, initialGlobalModel = null, initialRepositoryModel = null, dshDefaultModel = null, catalogModels = [{provider:'mock',model:'m',providerName:'Mock',name:'M'}, {provider:'mock',model:'alt',providerName:'Mock',name:'Alt'}] } = {}) {
  const sessions = { ids: ['one', 'two'], byId: {
    one: { id: 'one', cwd: '/example/repo-one' },
    two: { id: 'two', cwd: '/example/plain-directory' },
  }};
  const selected = { value: initial, subscribe: () => () => {}, getSnapshot() { return selected.value; } };
  const saved = { globalInstruction: 'Global', model: initialGlobalModel, autoHideNonGit: initialHide, showTokenDetails: initialShowTokens, countdownColor: initialColor, floatingPosition:initialPosition };
  const repoConfig = { repositoryInstruction: 'Repository', inheritGlobal: true, repositoryModel: initialRepositoryModel };
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
  const listeners = new Map();
  let observed=[];
  const container={clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0})};
  const window = {
    innerWidth:800, innerHeight:600,
    __ModuleLoader__: { load: entry => registrations.push(entry) },
    addEventListener(type,cb){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(cb);},
    removeEventListener(type,cb){listeners.get(type)?.delete(cb);},
    ResizeObserver:class {constructor(fn){this.fn=fn;observed.push(this);}observe(){}disconnect(){observed=observed.filter(x=>x!==this);}},
  };
  const document = {
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild: item => styleTags.push(item) },
  };
  let nextInterval=1, nextExpiry=1;
  const intervals=new Map(), expiries=new Map();
  const testTimeout=(fn,delay)=>{
    // Keep the ten-second notification timeout deterministic and fast.
    if (delay>=9000 && delay<=10000) { const id=nextExpiry++; expiries.set(id,fn); return id; }
    return setTimeout(fn,delay);
  };
  const cancelTimeout=id=>{
    if (typeof id==='number' && expiries.delete(id)) return;
    clearTimeout(id);
  };
  runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'), {
    window,document,setTimeout:testTimeout,clearTimeout:cancelTimeout,
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
        ? {isRepository:true,root:'/example/repo-one',branch:branchName,additions:268,deletions:141,stagedFiles:0,untracked:0,binary:0}
        : {isRepository:false,root:null};
      else if(method==='settings')value=payload.cwd.includes('repo-one')
        ? {...saved,...repoConfig,isRepository:true,root:'/example/repo-one'}
        : {...saved,repositoryInstruction:'',inheritGlobal:true,repositoryModel:null,isRepository:false,root:null};
      else if(method==='models')value={models:catalogModels,defaultModel:dshDefaultModel};
      else if(method==='saveSettings'){
        if(failSave)throw new Error('Permission denied');
        for(const [key,val] of Object.entries(payload.patch)) {
          if(['repositoryInstruction','inheritGlobal','repositoryModel'].includes(key)) {
            if(payload.cwd.includes('repo-one'))repoConfig[key]=val;
          }else saved[key]=val;
        }
        value=payload.cwd.includes('repo-one')
          ? {...saved,...repoConfig,isRepository:true,root:'/example/repo-one'}
          : {...saved,repositoryInstruction:'',inheritGlobal:true,repositoryModel:null,isRepository:false,root:null};
      }else if(method==='commit')value={
        success:true,scope:'all',hash:'e9f98bd',additions:268,deletions:141,
        message:'feat(ui): show a commit summary\n\nBody: intentionally hidden in the overlay',
        llm:{calls:3,inputTokens:12450,outputTokens:680,cacheReadTokens:8000,
          cacheWriteTokens:100,latencyMs:710,outputSpeedTps:91.2,durationMs:4100},
      };
      else throw new Error(`Unexpected RPC ${method}`);
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
    if(simulateDom) {
      const root=readVirtualDom(dom,n=>n.props?.className==='dgc-root')[0];
      if(root?.props?.ref) {
        const collapsed=readVirtualDom(dom,n=>n.props?.className?.includes('dgc-card-collapsed')).length>0;
        const nonGit=readVirtualDom(dom,n=>n.props?.className?.includes('dgc-card-no-repo')).length>0;
        const width=collapsed?44:nonGit?200:180;
        const height=collapsed?44:nonGit?46:120;
        root.props.ref.current={offsetParent:container,offsetWidth:width,offsetHeight:height,
          offsetTop:root.props.style.top??container.clientHeight-root.props.style.bottom-height};
      }
    }
    for(const {idx,callback} of scope.pending){
      scope.hooks[idx].cleanup?.();
      scope.hooks[idx].cleanup=callback();
    }
    return dom;
  }
  function unmount(scope){for(const slot of scope.hooks)if(typeof slot?.cleanup==='function')slot.cleanup();}
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const fireExpiry=()=>{const current=[...expiries.values()];expiries.clear();current.forEach(fn=>fn());};
  const resize=(width,height,rootOffset={})=>{
    container.clientWidth=width;container.clientHeight=height;
    window.innerWidth=width;window.innerHeight=height;
    for(const scope of Array.from(observed)) scope.fn();
    for(const listener of listeners.get('resize')??[]) listener();
  };
  return {sessions,selected,saved,repoConfig,calls,opened,definitions,tabTypes,styleTags,mount,render,unmount,settle,fireExpiry,resize,container};
}

const matchButton = (name) => node=>node.type==='button' && node.props['aria-label']===name;
const textOf = node=> typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join(' ') : (node?.children??[]).map(textOf).join(' ');
const switchTab = (render,scope,name) => {
  const tab=readVirtualDom(render(scope),matchButton(name))[0];
  assert.equal(tab?.props?.role,'tab',`missing ${name} tab`);
  tab.props.onClick();
  return render(scope);
};
const namedSelect = (dom,name) => readVirtualDom(dom,node=>node.type==='select' && node.props['aria-label']===name)[0];

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
  assert.equal(branch[0].props.title,'main');
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
  assert.equal(readVirtualDom(expanded,n=>n.props?.className==='dgc-branch')[0].props.title,'main');
  const commit=readVirtualDom(expanded,matchButton('Stage and commit all changes'));
  assert.equal(commit.length,1);
  assert.equal(commit[0].children[0].type,'svg','icon rather than a label');
  const settings=readVirtualDom(expanded,matchButton('Commit settings'));
  assert.equal(settings.length,1);
  assert.equal(settings[0].children[0].type,'svg');
  settings[0].props.onClick();
  assert.deepEqual(t.opened,['gitCommitSettings']);
  readVirtualDom(expanded,matchButton('Collapse Git commit'))[0].props.onClick({currentTarget:{closest:()=>({offsetTop:260})}});
  const collapsed=t.render(p);
  const git=readVirtualDom(collapsed,matchButton('Git commit'));
  assert.equal(git.length,1);
  assert.equal(git[0].props.title,'Git commit');
  assert.equal(readVirtualDom(collapsed,n=>n.props?.className==='dgc-branch').length,0);
  assert.equal(readVirtualDom(collapsed,n=>n.type==='button').length,1);
  assert.equal(collapsed.props.style.top,260,'collapse must preserve upper-right corner');
  assert.equal(collapsed.props.style.right,24);
  assert.equal(git[0].children[0].type,'svg');
  git[0].props.onClick();
  assert.equal(readVirtualDom(t.render(p),matchButton('Collapse Git commit')).length,1);
  t.unmount(p);
});

test('Non-Git workspaces open the Global tab and allow global changes without showing repository fields',async()=>{
  const t=clientHarness({initial:'two'});
  const p=t.mount('shell.overlay');
  t.render(p);await t.settle();
  const dom=t.render(p);
  assert.equal(readVirtualDom(dom,n=>n.props?.className==='dgc-no-repo').length,1);
  assert.match(textOf(dom),/Not a git repository/);
  assert.deepEqual(readVirtualDom(dom,n=>n.type==='button').map(n=>n.props['aria-label']),['Collapse Git commit']);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  t.render(tab); // the repository-less effect selects Global
  const page=t.render(tab);
  assert.equal(readVirtualDom(page,matchButton('Global'))[0].props['aria-selected'],true);
  const fields=readVirtualDom(page,n=>n.type==='label').map(textOf);
  assert.match(fields.join('|'),/Global commit instruction.*Model/s);
  assert.doesNotMatch(fields.join('|'),/Repository commit instruction|Inherit global instruction/);
  assert.equal(readVirtualDom(page,n=>n.type==='input'&&n.props.type==='checkbox').length,2);
  assert.deepEqual(readVirtualDom(page,n=>n.type==='button').map(x=>x.props['aria-label']),
    ['Repository','Global','Reset floating window position']);
  const global=readVirtualDom(page,n=>n.type==='textarea')[0];
  global.props.onChange({target:{value:'Updated global'}});
  global.props.onBlur();await t.settle();
  assert.equal(t.saved.globalInstruction,'Updated global');
  assert.deepEqual(JSON.parse(JSON.stringify(t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch))),
    [{globalInstruction:'Updated global'}]);
  const repoPage=switchTab(t.render,tab,'Repository');
  assert.match(textOf(repoPage),/Not a git repository/);
  assert.equal(namedSelect(repoPage,'Repository model'),undefined);
  t.unmount(p);t.unmount(tab);
});

test('Repository and Global tabs show only scoped controls and serialize independent changes',async()=>{
  const t=clientHarness();
  const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  const page=t.render(tab);
  const tabNodes=readVirtualDom(page,n=>n.type==='button'&&n.props.role==='tab');
  assert.deepEqual(tabNodes.map(textOf),['Repository','Global']);
  assert.deepEqual(tabNodes.map(x=>x.props['aria-selected']),[true,false]);
  assert.deepEqual(tabNodes.map(x=>x.props.tabIndex),[0,-1]);
  assert.ok(namedSelect(page,'Repository model'));
  assert.equal(namedSelect(page,'Global model'),undefined);
  assert.equal(readVirtualDom(page,n=>n.type==='code')[0].children[0],'/example/repo-one');
  assert.doesNotMatch(textOf(page),/Global commit instruction|Show token details|Automatically hide/);
  assert.doesNotMatch(textOf(page),/Saved|Save settings/);
  readVirtualDom(page,n=>n.type==='input' && n.props.type==='checkbox')[0].props.onChange({target:{checked:false}});
  await t.settle();
  const area=readVirtualDom(page,n=>n.type==='textarea')[0];
  area.props.onChange({target:{value:'New repo instruction'}});
  area.props.onBlur();await t.settle();
  assert.equal(t.repoConfig.repositoryInstruction,'New repo instruction');
  assert.equal(t.repoConfig.inheritGlobal,false);
  const globalPage=switchTab(t.render,tab,'Global');
  assert.equal(namedSelect(globalPage,'Repository model'),undefined);
  assert.ok(namedSelect(globalPage,'Global model'));
  assert.equal(readVirtualDom(globalPage,n=>n.type==='textarea').length,1);
  assert.equal(readVirtualDom(globalPage,n=>n.type==='input'&&n.props.type==='checkbox').length,2);
  assert.ok(readVirtualDom(globalPage,matchButton('Reset floating window position'))[0]);
  assert.doesNotMatch(textOf(globalPage),/Repository commit instruction|Inherit global instruction/);
  assert.deepEqual(JSON.parse(JSON.stringify(t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch))),
    [{inheritGlobal:false},{repositoryInstruction:'New repo instruction'}]);
  t.unmount(tab);t.unmount(p);
  const failing=clientHarness({failSave:true});
  const fp=failing.mount('shell.overlay');failing.render(fp);await failing.settle();failing.render(fp);
  const ft=failing.mount('sidebar.right.pane.tab');failing.render(ft);await failing.settle();
  const textarea=readVirtualDom(failing.render(ft),n=>n.type==='textarea')[0];
  textarea.props.onChange({target:{value:'Failure'}});
  textarea.props.onBlur();await failing.settle();
  assert.match(textOf(failing.render(ft)),/Failed to save settings: Permission denied/);
  failing.unmount(ft);failing.unmount(fp);
});

test('switching workspaces while Global tab is active does not dereference an unloaded settings form',async()=>{
  const t=clientHarness();
  const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  switchTab(t.render,tab,'Global');
  t.selected.value='two';t.render(p);
  assert.doesNotThrow(()=>t.render(tab)); // starts loading the new workspace
  assert.doesNotThrow(()=>t.render(tab)); // Global content must not access null form
  await t.settle();
  t.render(tab);
  const loaded=t.render(tab);
  assert.equal(readVirtualDom(loaded,matchButton('Global'))[0].props['aria-selected'],true);
  assert.ok(namedSelect(loaded,'Global model'));
  assert.match(textOf(switchTab(t.render,tab,'Repository')),/Not a git repository/);
  t.unmount(tab);t.unmount(p);
});

test('scope tabs support keyboard focus movement',async()=>{
  const t=clientHarness();const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  const repoButton=readVirtualDom(t.render(tab),matchButton('Repository'))[0];
  let prevented=false, focused=false;
  repoButton.props.onKeyDown({key:'ArrowRight',preventDefault(){prevented=true;},
    currentTarget:{parentElement:{querySelector(){return {focus(){focused=true;}}}}}});
  assert.equal(prevented,true);assert.equal(focused,true);
  assert.equal(readVirtualDom(t.render(tab),matchButton('Global'))[0].props['aria-selected'],true);
  const globalButton=readVirtualDom(t.render(tab),matchButton('Global'))[0];
  globalButton.props.onKeyDown({key:'Home',preventDefault(){},
    currentTarget:{parentElement:{querySelector(){return {focus(){}}}}}});
  assert.equal(readVirtualDom(t.render(tab),matchButton('Repository'))[0].props['aria-selected'],true);
  t.unmount(tab);t.unmount(p);
});

test('repository selector inherits live global label with a stable value, and overrides only its own scope', async()=>{
  const t=clientHarness({initialGlobalModel:{provider:'mock',model:'m'},
    dshDefaultModel:{provider:'mock',model:'alt'}});
  const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  let page=t.render(tab);
  let selector=namedSelect(page,'Repository model');
  assert.equal(selector.props.value,'inherit-global');
  assert.equal(readVirtualDom(selector,node=>node.type==='option')[0].props.value,'inherit-global');
  assert.match(textOf(selector),/Inherit Global \(Mock \/ M\)/);
  selector.props.onChange({target:{value:'mock\talt'}});
  await t.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(t.repoConfig.repositoryModel)),{provider:'mock',model:'alt'});
  assert.deepEqual(t.saved.model,{provider:'mock',model:'m'});
  page=t.render(tab);
  assert.equal(namedSelect(page,'Repository model').props.value,'mock\talt');
  page=switchTab(t.render,tab,'Global');
  assert.equal(namedSelect(page,'Global model').props.value,'mock\tm');
  namedSelect(page,'Global model').props.onChange({target:{value:''}});
  await t.settle();
  assert.equal(t.saved.model,null);
  page=switchTab(t.render,tab,'Repository');
  selector=namedSelect(page,'Repository model');
  assert.match(textOf(selector),/Inherit Global \(Mock \/ Alt\)/,
    'label tracks resolved DSH default when the global override is cleared');
  assert.equal(selector.props.value,'mock\talt','repository override survives global changes');
  selector.props.onChange({target:{value:'inherit-global'}});
  await t.settle();
  assert.equal(t.repoConfig.repositoryModel,null);
  page=t.render(tab);
  assert.equal(namedSelect(page,'Repository model').props.value,'inherit-global');
  assert.match(textOf(namedSelect(page,'Repository model')),/Inherit Global \(Mock \/ Alt\)/);
  assert.deepEqual(JSON.parse(JSON.stringify(t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch))),[
    {repositoryModel:{provider:'mock',model:'alt'}},{model:null},{repositoryModel:null},
  ]);
  t.unmount(tab);t.unmount(p);
});

test('repository inheritance label uses first catalog model if no DSH default is exposed',async()=>{
  const t=clientHarness();
  const p=t.mount('shell.overlay');t.render(p);await t.settle();t.render(p);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  const page=t.render(tab);
  assert.match(textOf(namedSelect(page,'Repository model')),/Inherit Global \(Mock \/ M\)/);
  t.unmount(tab);t.unmount(p);
});

test('Collapsed Git button drags without expanding, and click preserves upper-right anchor', async () => {
  const t=clientHarness();
  const p=t.mount('shell.overlay');
  t.render(p); await t.settle();
  let expanded=t.render(p);
  const fold=readVirtualDom(expanded,matchButton('Collapse Git commit'))[0];
  fold.props.onClick({currentTarget:{closest:()=>({offsetTop:310})}});
  let collapsed=t.render(p);
  assert.equal(collapsed.props.style.top,310);
  assert.equal(collapsed.props.style.right,24);
  let icon=readVirtualDom(collapsed,matchButton('Git commit'))[0];
  const root={offsetTop:310};
  const currentTarget={closest:()=>root,setPointerCapture:()=>{},releasePointerCapture:()=>{}};
  const down={button:0,pointerId:7,clientX:100,clientY:180,currentTarget};
  icon.props.onPointerDown(down);
  icon.props.onPointerMove({...down,clientX:80,clientY:207});
  const moved=t.render(p);
  assert.equal(moved.props.style.top,337);
  assert.equal(moved.props.style.right,44);
  icon.props.onPointerUp({...down,clientX:80,clientY:207});
  icon.props.onClick();
  assert.equal(readVirtualDom(t.render(p),matchButton('Git commit')).length,1,'release click after drag must not unfold');
  // A subsequent normal click has <4px movement and does unfold.
  collapsed=t.render(p);
  icon=readVirtualDom(collapsed,matchButton('Git commit'))[0];
  icon.props.onPointerDown({...down,clientX:140,clientY:205});
  icon.props.onPointerMove({...down,clientX:141,clientY:206});
  icon.props.onPointerUp({...down,clientX:141,clientY:206});
  icon.props.onClick();
  expanded=t.render(p);
  assert.equal(readVirtualDom(expanded,matchButton('Collapse Git commit')).length,1);
  assert.equal(expanded.props.style.top,337);
  assert.equal(expanded.props.style.right,44);
  // Repeated collapse after dragging does not jump down to the original bottom anchor.
  readVirtualDom(expanded,matchButton('Collapse Git commit'))[0].props.onClick({currentTarget:{closest:()=>({offsetTop:337})}});
  assert.equal(t.render(p).props.style.top,337);
  t.unmount(p);
});

test('Non-Git panel folds to crossed Git icon, drags and respects automatic hide from settings', async () => {
  const t=clientHarness({initial:'two'});
  const p=t.mount('shell.overlay');
  t.render(p);await t.settle();
  let expanded=t.render(p);
  assert.match(textOf(expanded),/Not a git repository/);
  assert.deepEqual(readVirtualDom(expanded,n=>n.type==='button').map(n=>n.props['aria-label']),['Collapse Git commit']);
  readVirtualDom(expanded,matchButton('Collapse Git commit'))[0].props.onClick({currentTarget:{closest:()=>({offsetTop:246})}});
  let compact=t.render(p);
  assert.equal(compact.props.style.top,246);
  assert.equal(readVirtualDom(compact,n=>n.props?.className==='dgc-git-cross').length,1);
  assert.equal(readVirtualDom(compact,matchButton('Git commit')).length,1);
  const button=readVirtualDom(compact,matchButton('Git commit'))[0];
  const currentTarget={closest:()=>({offsetTop:246,offsetWidth:44,offsetHeight:44,offsetParent:{clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0})}}),setPointerCapture(){},releasePointerCapture(){}};
  const mouse={button:0,pointerId:8,clientX:180,clientY:260,currentTarget};
  button.props.onPointerDown(mouse);
  button.props.onPointerMove({...mouse,clientX:210,clientY:235});
  button.props.onPointerUp({...mouse,clientX:210,clientY:235});
  button.props.onClick();
  compact=t.render(p);
  assert.equal(compact.props.style.top,221);
  assert.equal(compact.props.style.right,6,'right edge should remain within measured container');
  assert.equal(readVirtualDom(compact,n=>n.props?.className==='dgc-git-cross').length,1);

  // The settings tab can remain open after navigating to a non-Git directory.
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  const page=switchTab(t.render,tab,'Global');
  const hide=readVirtualDom(page,n=>n.type==='input'&&n.props.type==='checkbox');
  assert.equal(hide.length,2);
  assert.equal(hide[0].props.checked,false,'new setting defaults to disabled');
  hide[0].props.onChange({target:{checked:true}});
  assert.equal(t.render(p),null,'Non-Git floating panel hides immediately');
  await t.settle();
  assert.equal(t.saved.autoHideNonGit,true);
  const patches=t.calls.filter(c=>c.method==='saveSettings'&&'autoHideNonGit' in c.payload.patch).map(c=>c.payload.patch);
  assert.deepEqual(JSON.parse(JSON.stringify(patches)),[{autoHideNonGit:true}]);

  // Return to a Git Session: even with hide enabled the compact Git icon reappears without a cross.
  t.selected.value='one';t.render(p);await t.settle();
  const gitCompact=t.render(p);
  assert.notEqual(gitCompact,null);
  assert.equal(readVirtualDom(gitCompact,n=>n.props?.className==='dgc-git-cross').length,0);
  t.selected.value='two';t.render(p);await t.settle();
  assert.equal(t.render(p),null);
  t.unmount(tab);t.unmount(p);

  const persisted=clientHarness({initial:'two',initialHide:true});
  const persistedPill=persisted.mount('shell.overlay');persisted.render(persistedPill);await persisted.settle();
  assert.equal(persisted.render(persistedPill),null,'restarting Client honors persisted preference');
  persisted.unmount(persistedPill);
});

test('Branch tooltip uses full name, and icon action sizing plus max width are constrained',async()=>{
  const fullBranch='feature/very-long-branch-name-for-refactoring-with-extra-details';
  const t=clientHarness({branchName:fullBranch});
  const p=t.mount('shell.overlay');t.render(p);await t.settle();
  const branch=readVirtualDom(t.render(p),n=>n.props?.className==='dgc-branch')[0];
  assert.equal(branch.props.title,fullBranch);
  assert.equal(branch.props.title,textOf(branch),'tooltip contains the complete branch, even when CSS truncates it');
  assert.notEqual(branch.props.title,'/example/repo-one');
  const css=t.styleTags[0].textContent;
  assert.match(css,/\.dgc-card\{[^}]*width:max-content;min-width:102px;max-width:216px/);
   assert.match(css,/\.dgc-numbers\{[^}]*width:max-content;max-width:100%/);
   assert.match(css,/\.dgc-feedback\{[^}]*width:max-content;max-width:100%/);
   assert.match(css,/\.dgc-result-metrics\{[^}]*white-space:nowrap;width:max-content;max-width:100%;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css,/\.dgc-actions \.dgc-primary,\.dgc-actions \.dgc-secondary\{[^}]*width:36px;height:36px/);
  assert.match(css,/\.dgc-actions\{[^}]*justify-content:flex-start/);
  t.unmount(p);
});


test('successful commit shows only monospaced summary, ordinary-font subject, optional monospaced metrics, and ten-second countdown',async()=>{
  const t=clientHarness({initialShowTokens:true,initialColor:'#ec8400'});
  const pill=t.mount('shell.overlay');
  t.render(pill);await t.settle();t.render(pill);
  const button=readVirtualDom(t.render(pill),matchButton('Stage and commit all changes'))[0];
  await button.props.onClick();
  const shown=t.render(pill);
  const head=readVirtualDom(shown,n=>n.props?.className==='dgc-result-head');
  const subject=readVirtualDom(shown,n=>n.props?.className==='dgc-result-subject');
  const metrics=readVirtualDom(shown,n=>n.props?.className==='dgc-result-metrics');
  assert.equal(head.length,1);
  assert.equal(textOf(head[0]),'Committed e9f98bd · +268 −141');
  assert.equal(textOf(subject[0]),'feat(ui): show a commit summary');
  assert.doesNotMatch(textOf(shown),/Body: intentionally hidden/);
  assert.equal(textOf(metrics[0]),'↓ 12,450 · ↑ 680 | 0.71s · 91.2t/s');
  const color=readVirtualDom(shown,n=>n.props?.className==='dgc-countdown-fill');
  assert.equal(color.length,1);
  assert.equal(color[0].props.style.backgroundColor,'#ec8400');
  assert.match(t.styleTags[0].textContent,/\.dgc-result-head\{[^}]*ui-monospace/);
  assert.match(t.styleTags[0].textContent,/\.dgc-result-subject\{[^}]*system-ui/);
  assert.match(t.styleTags[0].textContent,/\.dgc-result-metrics\{[^}]*ui-monospace/);
  assert.match(t.styleTags[0].textContent,/@keyframes dgc-countdown\{from\{transform:scaleX\(1\)\}to\{transform:scaleX\(0\)\}\}/);
  t.fireExpiry();
  assert.equal(readVirtualDom(t.render(pill),n=>n.props?.className==='dgc-feedback').length,0,
    'ten-second timer must remove all success details and progress');
  t.unmount(pill);
});

test('settings automatically persist Show token details and Countdown color, synchronized with floating panel',async()=>{
  const t=clientHarness();
  const pill=t.mount('shell.overlay');t.render(pill);await t.settle();t.render(pill);
  const tab=t.mount('sidebar.right.pane.tab');t.render(tab);await t.settle();
  let form=switchTab(t.render,tab,'Global');
  const tokenLabel=readVirtualDom(form,n=>n.type==='label'&&textOf(n).includes('Show token details'))[0];
  assert.equal(tokenLabel.children[0].props.checked,false);
  tokenLabel.children[0].props.onChange({target:{checked:true}});
  form=t.render(tab);
  const colorInput=readVirtualDom(form,n=>n.type==='input'&&n.props.type==='color')[0];
  assert.equal(colorInput.props.value,'#f59e0b');
  colorInput.props.onChange({target:{value:'#11AA33'}});
  await t.settle();
  assert.equal(t.saved.showTokenDetails,true);
  assert.equal(t.saved.countdownColor,'#11AA33');
  assert.deepEqual(JSON.parse(JSON.stringify(t.calls.filter(c=>c.method==='saveSettings').map(c=>c.payload.patch))),
    [{showTokenDetails:true},{countdownColor:'#11AA33'}]);
  // No old Save button or new success notice.
  assert.doesNotMatch(textOf(t.render(tab)),/Saved|Save settings/);
  await readVirtualDom(t.render(pill),matchButton('Stage and commit all changes'))[0].props.onClick();
  const showing=t.render(pill);
  assert.equal(readVirtualDom(showing,n=>n.props?.className==='dgc-result-metrics').length,1);
  assert.equal(readVirtualDom(showing,n=>n.props?.className==='dgc-countdown-fill')[0].props.style.backgroundColor,'#11aa33');
  // Changing the checkbox immediately removes only the optional metrics line.
  const checkbox=readVirtualDom(t.render(tab),n=>n.type==='label'&&textOf(n).includes('Show token details'))[0].children[0];
  checkbox.props.onChange({target:{checked:false}});
  assert.equal(readVirtualDom(t.render(pill),n=>n.props?.className==='dgc-result-metrics').length,0);
  assert.equal(readVirtualDom(t.render(pill),n=>n.props?.className==='dgc-result-head').length,1);
  t.unmount(tab);t.unmount(pill);
});

test('commit confirmation remains two lines without tokens when details disabled, and expires after ten seconds',async()=>{
  const t=clientHarness();
  const pill=t.mount('shell.overlay');t.render(pill);await t.settle();t.render(pill);
  await readVirtualDom(t.render(pill),matchButton('Stage and commit all changes'))[0].props.onClick();
  const shown=t.render(pill);
  assert.equal(readVirtualDom(shown,n=>n.props?.className==='dgc-result-head').length,1);
  assert.equal(readVirtualDom(shown,n=>n.props?.className==='dgc-result-subject').length,1);
  assert.equal(readVirtualDom(shown,n=>n.props?.className==='dgc-result-metrics').length,0);
  assert.equal(readVirtualDom(shown,n=>n.props?.className==='dgc-countdown-fill')[0].props.style.backgroundColor,'#f59e0b');
  t.fireExpiry();
  assert.equal(readVirtualDom(t.render(pill),n=>n.props?.className==='dgc-feedback').length,0);
  t.unmount(pill);
});


test('floating panel is clamped on all four sides using actual parent dimensions and persists completed drags',async()=>{
  const t=clientHarness({simulateDom:true});
  const p=t.mount('shell.overlay');t.render(p);await t.settle();
  t.render(p);
  const grip=readVirtualDom(t.render(p),n=>n.props?.className==='dgc-grip')[0];
  const root={offsetTop:382,offsetWidth:180,offsetHeight:120,offsetParent:t.container};
  const el={closest:()=>root,setPointerCapture(){},releasePointerCapture(){}};
  const start={button:0,pointerId:40,clientX:300,clientY:300,currentTarget:el};
  grip.props.onPointerDown(start);
  grip.props.onPointerMove({...start,clientX:-9999,clientY:-9999});
  let rootDom=t.render(p);
  assert.equal(rootDom.props.style.right,614,'left limit = 800-180-6');
  assert.equal(rootDom.props.style.top,6,'top limit');
  grip.props.onPointerMove({...start,clientX:9999,clientY:9999});
  rootDom=t.render(p);
  assert.equal(rootDom.props.style.right,6,'right limit');
  assert.equal(rootDom.props.style.top,474,'bottom limit = 600-120-6');
  grip.props.onPointerUp(start);
  await t.settle();
  const saves=t.calls.filter(x=>x.method==='saveSettings'&&'floatingPosition' in x.payload.patch);
  assert.equal(saves.length,1,'one write per completed drag, not per pointer frame');
  assert.deepEqual(JSON.parse(JSON.stringify(saves[0].payload.patch.floatingPosition)),{right:6,top:474});
  assert.deepEqual(JSON.parse(JSON.stringify(t.saved.floatingPosition)),{right:6,top:474});
  t.unmount(p);
});

test('saved position hydrates on next mount; resize snaps inside viewport and reset button returns default',async()=>{
  const t=clientHarness({simulateDom:true,initialPosition:{right:230,top:280}});
  const pill=t.mount('shell.overlay');t.render(pill);await t.settle();
  let dom=t.render(pill);
  assert.equal(dom.props.style.right,230);
  assert.equal(dom.props.style.top,280);
  t.resize(330,210);
  dom=t.render(pill);
  assert.equal(dom.props.style.right,144,'left is 6px inside the smaller container');
  assert.equal(dom.props.style.top,84,'bottom is 6px inside the smaller container');
  await t.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(t.saved.floatingPosition)),{right:144,top:84});
  const settings=t.mount('sidebar.right.pane.tab');t.render(settings);await t.settle();
  const button=readVirtualDom(switchTab(t.render,settings,'Global'),matchButton('Reset floating window position'))[0];
  assert.ok(button,'native settings supports a reset position button');
  button.props.onClick();
  await t.settle();
  assert.equal(t.saved.floatingPosition,null,'reset persists default marker');
  dom=t.render(pill);
  assert.equal(dom.props.style.bottom,98);
  assert.equal(dom.props.style.right,24);
  // On a short window the default bottom anchor can put the panel above the top;
  // the next measured size-change event must keep it visible.
  t.resize(250,90);
  dom=t.render(pill);
  assert.ok(dom.props.style.top>=6,'default is re-clamped if it does not fit');
  t.unmount(pill);t.unmount(settings);
});
