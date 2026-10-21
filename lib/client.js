/** Browser loader bundle (no JSX compilation required). DSH also loads this in Desktop. */
window.__ModuleLoader__.load({
  id: 'dsh-git-commit',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const TAB_ID = 'dsh-git-commit/settings';
    const TAB_KIND = 'gitCommitSettings';
    const CHANNEL = '/api';
    const ENDPOINT = 'git-commit';
    const CSS = `
      .dgc-root{position:absolute;z-index:24;pointer-events:none;color:var(--dsw-alias-label-primary);font-size:12px}
      .dgc-card{pointer-events:auto;width:216px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 26px #0004;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}
      .dgc-line{display:flex;align-items:center;gap:8px;min-width:0}.dgc-branch{font-weight:600;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .dgc-grip{cursor:grab;touch-action:none;user-select:none;color:var(--dsw-alias-label-secondary)}.dgc-grip:active{cursor:grabbing}
      .dgc-numbers{font:600 13px ui-monospace,Menlo,monospace;display:flex;gap:15px}.dgc-add{color:var(--dsw-alias-state-success-primary)}.dgc-del{color:var(--dsw-alias-state-error-primary)}
      .dgc-button{font:inherit;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:6px 9px;cursor:pointer;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
      .dgc-button:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}
      .dgc-button:disabled{opacity:.55;cursor:default}
      .dgc-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-primary{background:var(--dsw-alias-brand-primary);color:white;border-color:transparent;flex:1;font-weight:600}
      .dgc-actions{gap:8px}
      .dgc-icon-button{display:inline-flex;align-items:center;justify-content:center;height:36px;min-width:44px;padding:0;line-height:1}
      .dgc-icon-button svg{width:19px;height:19px;display:block;flex-shrink:0}
      .dgc-actions .dgc-primary{flex:1.1}
      .dgc-actions .dgc-secondary{flex:1}
      .dgc-fold{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;cursor:pointer;flex-shrink:0;padding:0}
      .dgc-fold:hover{background:rgba(128,136,150,.15);color:var(--dsw-alias-label-primary)}
      .dgc-fold svg{width:16px;height:16px}
      .dgc-fold:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-card-collapsed{width:44px;height:44px;padding:0;gap:0}
      .dgc-collapsed-trigger{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:11px}
      .dgc-collapsed-trigger:hover{background:rgba(128,136,150,.14)}
      .dgc-collapsed-trigger svg{width:22px;height:22px}
      .dgc-collapsed-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-4px}
      .dgc-card-no-repo{width:max-content;max-width:calc(100vw - 24px);padding:12px 14px}
      .dgc-no-repo{font-weight:600;white-space:nowrap;color:var(--dsw-alias-label-primary)}
      /* DSH expresses the resolved theme on body, not [data-theme] or the OS media query. */
      body[data-ds-dark-theme] .dgc-card{background:#2b3038;border-color:#48505b;box-shadow:0 12px 32px rgba(0,0,0,.48),0 2px 8px rgba(0,0,0,.23)}
      body[data-ds-dark-theme] .dgc-root{color:#f4f6f9}
      body[data-ds-dark-theme] .dgc-grip{color:#b6bdc8}
      body[data-ds-dark-theme] .dgc-primary{background:#101216;color:#f5f7fa;border-color:#414852}
      body[data-ds-dark-theme] .dgc-primary:hover:not(:disabled){background:#191d24;border-color:#66707e}
      body[data-ds-dark-theme] .dgc-secondary{background:#383e47;color:#f3f5f8;border-color:#4c5560}
      body[data-ds-dark-theme] .dgc-secondary:hover:not(:disabled){background:#454c56;border-color:#758090}
      body[data-ds-dark-theme] .dgc-icon-button:focus-visible{outline-color:#a7b4cc}
      body[data-ds-dark-theme] .dgc-no-repo{color:#f4f6f9}
      .dgc-notice{font-size:11px;line-height:1.45;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dgc-error{color:var(--dsw-alias-state-error-primary)}
      .dgc-settings{padding:16px;height:100%;box-sizing:border-box;overflow:auto;display:flex;flex-direction:column;gap:13px;color:var(--dsw-alias-label-primary)}.dgc-settings h3{font-size:15px;margin:0 0 4px}
      .dgc-field{display:flex;flex-direction:column;gap:6px;font-size:12px}.dgc-field textarea,.dgc-field select{width:100%;box-sizing:border-box;min-height:34px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;color:var(--dsw-alias-label-primary);padding:8px;font:inherit}.dgc-field textarea{min-height:92px;resize:vertical}
      .dgc-check{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px}.dgc-check input{accent-color:var(--dsw-alias-brand-primary)}.dgc-subtle{color:var(--dsw-alias-label-secondary);font-size:11px;overflow-wrap:anywhere}
      .dgc-settings-divider{width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l2);margin:2px 0}
      .dgc-repo-path{display:block;font:11px ui-monospace,Menlo,monospace;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;word-break:break-all}
      .dgc-save-error{color:var(--dsw-alias-state-error-primary)}
    `;
    /** All icons inherit theme text color, with accessible text on their buttons. */
    function actionIcon(kind) {
      const props = { width:19, height:19, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true, focusable:'false' };
      if (kind === 'commit') return h('svg',props,
        h('path',{d:'M2.5 12h5'}),h('circle',{cx:12,cy:12,r:4.5}),h('path',{d:'M16.5 12h5'}));
      if (kind === 'settings') return h('svg',props,
        h('path',{d:'M9.8 3h4.4l.5 2.05 1.33.55 1.82-1.09 3.11 3.11-1.09 1.82.55 1.33 2.05.5v4.4l-2.05.5-.55 1.33 1.09 1.82-3.11 3.11-1.82-1.09-1.33.55-.5 2.05H9.8l-.5-2.05-1.33-.55-1.82 1.09-3.11-3.11 1.09-1.82-.55-1.33-2.05-.5v-4.4l2.05-.5.55-1.33-1.09-1.82 3.11-3.11 1.82 1.09 1.33-.55.5-2.05Z'}),
        h('circle',{cx:12,cy:13.5,r:3}));
      if (kind === 'collapse') return h('svg',props,h('path',{d:'M6 10l6 6 6-6'}));
      return h('svg',props,
        h('circle',{cx:6,cy:4,r:2}),h('path',{d:'M6 6v8a5 5 0 0 0 5 5h7'}),h('circle',{cx:18,cy:19,r:2}));
    }

    /** Merge changed settings only; serialize requests so older saves cannot overwrite newer edits. */
    function createAutoSaver(send,onError) {
      let pending = {};
      let timer = null;
      let active = null;
      const flush = () => {
        if (timer !== null) { clearTimeout(timer); timer = null; }
        if (active) return active;
        active = (async () => {
          while (Object.keys(pending).length) {
            const patch = pending;
            pending = {};
            try { await send(patch); onError(''); }
            catch (error) {
              // Keep unsaved edits, preserving newer values on conflicting fields.
              pending = { ...patch, ...pending };
              onError('Failed to save settings: ' + (error?.message ?? String(error)));
              break;
            }
          }
        })().finally(() => { active = null; });
        return active;
      };
      const update = (key,value,immediate=false) => {
        pending[key] = value;
        if (timer !== null) clearTimeout(timer);
        if (immediate) { void flush(); }
        else timer = setTimeout(() => { timer=null; void flush(); }, 400);
      };
      return { update, flush, close: () => { void flush(); } };
    }
    const workspace = { cwd: '', listeners: new Set(), getSnapshot() { return workspace.cwd; }, subscribe(fn) { workspace.listeners.add(fn); return () => workspace.listeners.delete(fn); }, set(cwd) { if (cwd !== workspace.cwd) { workspace.cwd = cwd; workspace.listeners.forEach(fn => fn()); } } };
    function failureText(result) { return result?.error?.message ?? result?.error ?? 'Request failed'; }
    function apply(ctx) {
      const rpc = async (method, payload = {}, signal) => {
        const result = await ctx.connection.rpc.call(CHANNEL, ENDPOINT, { method, payload }, signal);
        if (!result.ok) throw new Error(failureText(result));
        return result.value;
      };
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.dshGitCommit = 'true';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'dsh-git-commit: styles');

      function CommitPill(props) {
        const sessionId = React.useSyncExternalStore(
          ctx.sidebarRight.mounted.subscribe,
          ctx.sidebarRight.mounted.getSnapshot,
          ctx.sidebarRight.mounted.getSnapshot,
        );
        const cwd = props.useSessions(s => sessionId ? s.byId[sessionId]?.cwd : undefined);
        const [statusEntry, setStatusEntry] = React.useState(null);
        // Index status by cwd to avoid showing the previous Session's repository while switching.
        const data = statusEntry?.cwd === cwd ? statusEntry.data : null;
        const [problem, setProblem] = React.useState('');
        const [working, setWorking] = React.useState(false);
        const [notice, setNotice] = React.useState('');
        const [collapsed, setCollapsed] = React.useState(false);
        const [position, setPosition] = React.useState({ right: 24, bottom: 98 });
        const drag = React.useRef(null);
        const positionRef = React.useRef(position);
        positionRef.current = position;
        React.useEffect(() => { workspace.set(typeof cwd === 'string' ? cwd : ''); }, [cwd]);
        React.useEffect(() => {
          if (!cwd) { setStatusEntry(null); setProblem(''); return; }
          let cancelled = false, previousToken = undefined, lastFull = 0, reading = false, notRepo = false;
          const refresh = async () => {
            if (reading) return;
            reading = true;
            try {
              const status = await rpc('status', { cwd });
              if (!cancelled) {
                notRepo = status.isRepository === false;
                setStatusEntry({ cwd, data: status });
                setProblem('');
              }
            } catch (error) {
              if (!cancelled) { setStatusEntry(null); setProblem(error.message); }
            } finally { reading = false; lastFull = Date.now(); }
          };
          const tick = async () => {
            if (cancelled) return;
            // Without a Git repository no need to launch Git every 900ms.
            // A 30s probe also detects a later `git init` in the same directory.
            if (notRepo) { if (Date.now() - lastFull >= 30000) await refresh(); return; }
            try {
              const { token } = await rpc('changeToken', { cwd });
              if (previousToken !== token || Date.now() - lastFull > 30000) {
                previousToken = token;
                await refresh();
              }
            } catch { if (Date.now() - lastFull > 5000) await refresh(); }
          };
          setStatusEntry(null); setNotice(''); setProblem('');
          void tick();
          const interval = setInterval(() => { void tick(); }, 900);
          return () => { cancelled = true; clearInterval(interval); };
        }, [cwd]);
        if (!sessionId || !cwd) return null;
        const location = { right: position.right, bottom: position.bottom };
        if (data?.isRepository === false) {
          // Non-Git Sessions must never expose Commit/Settings/Collapse actions.
          return h('div',{className:'dgc-root',style:location},
            h('div',{className:'dgc-card dgc-card-no-repo',role:'status'},
              h('span',{className:'dgc-no-repo'},'Not a git repository')));
        }
        if (collapsed) return h('div',{className:'dgc-root',style:location},
          h('div',{className:'dgc-card dgc-card-collapsed'},
            h('button',{type:'button',className:'dgc-collapsed-trigger',title:'Git commit','aria-label':'Git commit',
              onClick:()=>setCollapsed(false)},actionIcon('git'))));
        const hasChanges = data && (data.additions || data.deletions || data.untracked || data.binary || data.stagedFiles);
        const onCommit = async () => {
          if (working || !hasChanges || data?.isRepository === false) return;
          setWorking(true); setNotice('');
          try {
            const result = await rpc('commit', { cwd });
            if (result.success) setNotice(`Committed ${result.hash} · +${result.additions} −${result.deletions}\n${result.message}`);
            else setNotice('Commit failed: ' + result.error);
            setStatusEntry({cwd, data: await rpc('status', { cwd })});
          } catch (error) { setNotice('Commit failed: ' + error.message); }
          finally { setWorking(false); }
        };
        const grip = h('span', {
          className:'dgc-grip', title:'Drag Git commit window',
          onPointerDown:e=>{ if(e.button!==0)return; drag.current={x:e.clientX,y:e.clientY,...positionRef.current}; try{e.currentTarget.setPointerCapture(e.pointerId);}catch{} },
          onPointerMove:e=>{const d=drag.current;if(!d)return;setPosition({right:Math.max(6,Math.min(4000,d.right-(e.clientX-d.x))),bottom:Math.max(6,Math.min(3000,d.bottom-(e.clientY-d.y)))});},
          onPointerUp:e=>{drag.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}},
          onPointerCancel:()=>{drag.current=null;},
        },'⠿');
        return h('div',{className:'dgc-root',style:location},
          h('div',{className:'dgc-card'},
            h('div',{className:'dgc-line'},grip,
              h('span',{className:'dgc-branch',title:data?.root??cwd},data?.branch??'Git…'),
              h('button',{type:'button',className:'dgc-fold',title:'Collapse Git commit','aria-label':'Collapse Git commit',
                onClick:()=>setCollapsed(true)},actionIcon('collapse'))),
            h('div',{className:'dgc-numbers'},h('span',{className:'dgc-add'},`+${data?.additions??0}`),h('span',{className:'dgc-del'},`−${data?.deletions??0}`)),
            h('div',{className:'dgc-line dgc-actions'},
              h('button',{type:'button',className:'dgc-button dgc-icon-button dgc-primary',disabled:working||!hasChanges,onClick:onCommit,
                title:working?'Committing changes…':data?.stagedFiles?'Commit staged changes only':'Stage and commit all changes',
                'aria-label':working?'Committing changes':data?.stagedFiles?'Commit staged changes only':'Stage and commit all changes'},actionIcon('commit')),
              h('button',{type:'button',className:'dgc-button dgc-icon-button dgc-secondary',
                title:'Commit settings','aria-label':'Commit settings',
                onClick:()=>{if(data?.isRepository!==true)return;try{ctx.sidebarRight.openTab(TAB_KIND);}catch(error){setNotice(error.message);}}},actionIcon('settings'))),
            problem?h('div',{className:'dgc-notice dgc-error'},problem):null,
            notice?h('div',{className:'dgc-notice',style:{whiteSpace:'pre-wrap'}},notice):null
          )
        );
      }

      function CommitSettings() {
        const cwd = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot, workspace.getSnapshot);
        const [form, setForm] = React.useState(null);
        const [models, setModels] = React.useState([]);
        const [defaultModel, setDefaultModel] = React.useState(null);
        const [loadError, setLoadError] = React.useState('');
        const [saveError, setSaveError] = React.useState('');
        const saverRef = React.useRef(null);
        React.useEffect(()=>{
          let active = true;
          setForm(null); setLoadError(''); setSaveError('');
          // Global settings remain readable even when cwd is outside a repository.
          void rpc('settings',{cwd}).then(value=>{if(active)setForm(value);},error=>{if(active)setLoadError(error.message);});
          void rpc('models').then(catalog=>{
            if (!active)return;
            setModels(catalog.models??[]);setDefaultModel(catalog.defaultModel??null);
          },error=>{if(active)setLoadError(error.message);});
          return ()=>{active=false;};
        },[cwd]);
        React.useEffect(()=>{
          let active = true;
          const saver = createAutoSaver(patch=>rpc('saveSettings',{cwd,patch}),error=>{
            if(active)setSaveError(error);
          });
          saverRef.current=saver;
          return ()=>{
            active=false;
            if(saverRef.current===saver)saverRef.current=null;
            saver.close(); // Flush the last unsubmitted keystrokes on closing the sidebar.
          };
        },[cwd]);
        const update=(key,value,immediate=false)=>{
          setForm(current=>({...current,[key]:value}));
          setSaveError('');
          saverRef.current?.update(key,value,immediate);
        };
        const choice=form?.model?`${form.model.provider}\t${form.model.model}`:'';
        const repository=form?.isRepository===true;
        return h('div',{className:'dgc-settings'},
          h('h3',null,'Git commit settings'),
          !form? h('div',{className:'dgc-subtle'},loadError||'Loading…') : [
            h('label',{className:'dgc-field',key:'global'},'Global commit instruction',
              h('textarea',{value:form.globalInstruction,onChange:e=>update('globalInstruction',e.target.value),
                onBlur:()=>{void saverRef.current?.flush();},placeholder:'Shared conventions for every repository'})),
            h('label',{className:'dgc-field',key:'model'},'Model',h('select',{value:choice,onChange:e=>{
              const value=e.target.value;
              const item=models.find(m=>`${m.provider}\t${m.model}`===value);
              update('model',item?{provider:item.provider,model:item.model}:null,true);
            }},
              h('option',{value:''},defaultModel ? `DSH default (${defaultModel.provider}/${defaultModel.model})` : 'DSH default'),
              ...models.map(model=>h('option',{key:`${model.provider}/${model.model}`,value:`${model.provider}\t${model.model}`},`${model.providerName} / ${model.name}`))
            )),
            h('hr',{key:'divider',className:'dgc-settings-divider'}),
            repository ? [
              h('label',{className:'dgc-check',key:'inherit'},
                h('input',{type:'checkbox',checked:form.inheritGlobal,onChange:e=>update('inheritGlobal',e.target.checked,true)}),
                'Inherit global instruction'),
              h('label',{className:'dgc-field',key:'repo'},'Repository commit instruction',
                h('textarea',{value:form.repositoryInstruction,onChange:e=>update('repositoryInstruction',e.target.value),
                  onBlur:()=>{void saverRef.current?.flush();},placeholder:'Repository-specific commit conventions'})),
              h('code',{className:'dgc-repo-path',key:'path'},form.root),
            ] : h('div',{className:'dgc-subtle',key:'no-repo'},'Not a git repository'),
          ],
          saveError ? h('div',{className:'dgc-notice dgc-save-error',role:'alert'},saveError) : null,
          form && loadError ? h('div',{className:'dgc-notice dgc-error',role:'alert'},loadError) : null
        );
      }

      ctx.effect(() => ctx.sidebarRightTabs.register({ id:TAB_ID, kind:TAB_KIND, title:()=> 'Git commit settings', priority:'extension' }), 'dsh-git-commit: settings tab');
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register({name:'sidebar.right.pane.tab',key:TAB_ID},CommitSettings)), 'dsh-git-commit: settings body');
      ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({name:'shell.overlay',id:'dsh-git-commit',order:45,label:'Git commit'},CommitPill)), 'dsh-git-commit: floating pill');
    }
    return { apply, inject: ['slots','connection','sidebarRight','sidebarRightTabs'] };
  },
});
