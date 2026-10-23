/** Browser loader bundle (no JSX compilation required). DSH also loads this in Desktop. */
window.__ModuleLoader__.load({
  id: '@ibobbyts/dsh-git-commit',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const TAB_ID = 'dsh-git-commit/settings';
    const TAB_KIND = 'gitCommitSettings';
    const CHANNEL = '/api';
    const ENDPOINT = 'git-commit';
    const CSS = `
      .dgc-root{position:absolute;z-index:24;pointer-events:none;color:var(--dsw-alias-label-primary);font-size:12px}
      .dgc-card{pointer-events:auto;width:max-content;min-width:102px;max-width:none;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 26px #0004;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}
      .dgc-line{display:flex;align-items:center;gap:8px;min-width:0}.dgc-branch{font-weight:600;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;max-width:128px}
      .dgc-grip{cursor:grab;touch-action:none;user-select:none;color:var(--dsw-alias-label-secondary)}.dgc-grip:active{cursor:grabbing}
      .dgc-numbers{font:600 13px ui-monospace,Menlo,monospace;display:flex;gap:15px;white-space:nowrap;width:max-content;max-width:100%;min-width:0;overflow:hidden}.dgc-add{color:var(--dsw-alias-state-success-primary)}.dgc-del{color:var(--dsw-alias-state-error-primary)}
      .dgc-button{font:inherit;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:6px 9px;cursor:pointer;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
      .dgc-button:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}
      .dgc-button:disabled{opacity:.55;cursor:default}
      .dgc-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-loading-icon{width:19px;height:19px;display:block;animation:dgc-spin 0.9s linear infinite}
      @keyframes dgc-spin{to{transform:rotate(360deg)}}
      .dgc-primary{background:var(--dsw-alias-brand-primary);color:white;border-color:transparent;flex:1;font-weight:600}
      .dgc-actions{gap:8px;justify-content:flex-start}
      .dgc-icon-button{display:inline-flex;align-items:center;justify-content:center;height:36px;min-width:44px;padding:0;line-height:1}
      .dgc-icon-button svg{width:19px;height:19px;display:block;flex-shrink:0}
      .dgc-actions .dgc-primary,.dgc-actions .dgc-secondary{width:36px;height:36px;min-width:36px;flex:0 0 36px;padding:0}
      .dgc-fold{display:inline-flex;align-items:center;justify-content:center;margin-left:auto;width:24px;height:24px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;cursor:pointer;flex-shrink:0;padding:0}
      .dgc-fold:hover{background:rgba(128,136,150,.15);color:var(--dsw-alias-label-primary)}
      .dgc-fold svg{width:16px;height:16px}
      .dgc-fold:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-card-collapsed{width:44px;height:44px;min-width:44px;max-width:44px;padding:0;gap:0}
      .dgc-collapsed-trigger{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-alias-label-primary);cursor:grab;touch-action:none;user-select:none;border-radius:11px}
      .dgc-collapsed-trigger:hover{background:rgba(128,136,150,.14)}.dgc-collapsed-trigger:active{cursor:grabbing}
      .dgc-collapsed-trigger svg{width:22px;height:22px}
      .dgc-collapsed-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-4px}
      .dgc-card-no-repo{width:max-content;min-width:0;max-width:216px;padding:10px 12px}
      .dgc-no-repo{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:var(--dsw-alias-label-primary);cursor:grab;touch-action:none;user-select:none}.dgc-no-repo:active{cursor:grabbing}
      .dgc-git-cross{position:absolute;top:5px;right:5px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:#ef4444;pointer-events:none}
      .dgc-git-cross svg{width:12px;height:12px;stroke-width:2.8}
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
      .dgc-tabs{display:flex;gap:4px;padding:3px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px}
      .dgc-tab{flex:1;min-width:0;padding:8px 10px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:1.25;font-family:inherit;cursor:pointer}
      .dgc-tab[aria-selected="true"]{background:var(--dsw-alias-bg-overlay);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
      .dgc-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .dgc-tab-panel{display:flex;flex-direction:column;gap:13px;min-width:0}
      body[data-ds-dark-theme] .dgc-tab[aria-selected="true"]{background:#383e47;border-color:#596271;color:#f3f5f8}
      .dgc-reset-position{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:34px;width:100%;font:inherit;cursor:pointer;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
      .dgc-reset-position:hover{background:var(--dsw-alias-bg-layer-2)}
      .dgc-reset-position:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-countdown-color{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
      .dgc-countdown-color input{width:42px;height:30px;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);cursor:pointer}
      .dgc-countdown-color input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-feedback{display:flex;flex-direction:column;gap:4px;min-width:0;width:max-content;max-width:none;box-sizing:border-box}
      .dgc-result-head{font:600 10.5px/1.4 ui-monospace,Menlo,monospace;letter-spacing:-.15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dgc-result-subject{font:12px/1.4 var(--dsh-font-family-text,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dgc-result-metrics{font:10.5px/1.5 ui-monospace,Menlo,monospace;white-space:nowrap;width:max-content;max-width:none;overflow:visible;text-overflow:clip}
      .dgc-countdown-track{width:100%;height:3px;overflow:hidden;border-radius:99px;background:rgba(128,136,150,.18);margin-top:3px}
      .dgc-countdown-fill{width:100%;height:100%;background-color:#f59e0b;transform-origin:left center;animation:dgc-countdown 10s linear forwards}
      @keyframes dgc-countdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}
    `;
    /** All icons inherit theme text color, with accessible text on their buttons. */
    function actionIcon(kind) {
      const props = { width:19, height:19, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true, focusable:'false' };
      if (kind === 'loading') return h('svg',{...props,className:'dgc-loading-icon'},h('path',{d:'M12 3a9 9 0 1 1-9 9'}));
      if (kind === 'commit') return h('svg',props,
        h('path',{d:'M2.5 12h5'}),h('circle',{cx:12,cy:12,r:4.5}),h('path',{d:'M16.5 12h5'}));
      if (kind === 'settings') return h('svg',props,
        h('path',{d:'M9.8 3h4.4l.5 2.05 1.33.55 1.82-1.09 3.11 3.11-1.09 1.82.55 1.33 2.05.5v4.4l-2.05.5-.55 1.33 1.09 1.82-3.11 3.11-1.82-1.09-1.33.55-.5 2.05H9.8l-.5-2.05-1.33-.55-1.82 1.09-3.11-3.11 1.09-1.82-.55-1.33-2.05-.5v-4.4l2.05-.5.55-1.33-1.09-1.82 3.11-3.11 1.82 1.09 1.33-.55.5-2.05Z'}),
        h('circle',{cx:12,cy:13.5,r:3}));
      if (kind === 'collapse') return h('svg',props,h('path',{d:'M6 10l6 6 6-6'}));
      if (kind === 'cross') return h('svg',props,h('path',{d:'M5 5l14 14M19 5L5 19'}));
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
    const colorOrDefault = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
      ? value.toLowerCase() : '#f59e0b';
    const countText = value => Number.isFinite(value) && value >= 0
      ? Math.round(value).toLocaleString('en-US') : '—';
    const secondsText = value => Number.isFinite(value) && value >= 0
      ? (value / 1000).toFixed(2) : '—';
    const speedText = value => Number.isFinite(value) && value >= 0
      ? value.toFixed(1) : '—';
    function tokenLine(llm) {
      return `↓ ${countText(llm?.inputTokens)} ↑ ${countText(llm?.outputTokens)} | ${secondsText(llm?.latencyMs)}s · ${speedText(llm?.outputSpeedTps)}t/s`;
    }
    const workspace = { cwd: '', listeners: new Set(), getSnapshot() { return workspace.cwd; }, subscribe(fn) { workspace.listeners.add(fn); return () => workspace.listeners.delete(fn); }, set(cwd) { if (cwd !== workspace.cwd) { workspace.cwd = cwd; workspace.listeners.forEach(fn => fn()); } } };
    // The setting is Host-owned, but the two Client panels share its current value.
    const visibility = {
      value: { hide: false, showTokenDetails: false, countdownColor: '#f59e0b', ready: false },
      version: 0, listeners: new Set(),
      getSnapshot() { return visibility.value; },
      subscribe(fn) { visibility.listeners.add(fn); return () => visibility.listeners.delete(fn); },
      /** Partial global setting patch, synchronized immediately between both Client surfaces. */
      set(patch) {
        const current = visibility.value;
        const next = {
          hide: Object.hasOwn(patch, 'autoHideNonGit') ? patch.autoHideNonGit === true : current.hide,
          showTokenDetails: Object.hasOwn(patch, 'showTokenDetails') ? patch.showTokenDetails === true : current.showTokenDetails,
          countdownColor: Object.hasOwn(patch, 'countdownColor') ? colorOrDefault(patch.countdownColor) : current.countdownColor,
          ready: true,
        };
        if (!current.ready || current.hide !== next.hide || current.showTokenDetails !== next.showTokenDetails
            || current.countdownColor !== next.countdownColor) {
          visibility.value = next;
          visibility.version++;
          for (const fn of visibility.listeners) fn();
        }
      },
    };
    /** The default is lower-right anchored. Explicit moves are top/right anchored. */
    const DEFAULT_POSITION = Object.freeze({ right: 24, bottom: 98, top: null });
    const POSITION_MARGIN = 6;
    const isUsablePosition = pos => pos && Number.isFinite(pos.right) && pos.right >= 0
      && Number.isFinite(pos.top) && pos.top >= 0;
    const samePosition = (a,b) => a.right === b.right && a.top === b.top;
    /**
     * Shared between settings and overlay; one global saved position per Desktop profile.
     * A late settings response must never undo a local drag or reset.
     */
    const floatingPosition = {
      value: DEFAULT_POSITION, loaded: false, localEdit: false, listeners: new Set(), saveQueue: Promise.resolve(),
      subscribe(fn) { floatingPosition.listeners.add(fn); return () => floatingPosition.listeners.delete(fn); },
      getSnapshot() { return floatingPosition.value; },
      set(next) {
        floatingPosition.localEdit = true;
        if (!samePosition(floatingPosition.value,next)) {
          floatingPosition.value = next;
          for (const fn of floatingPosition.listeners) fn();
        }
      },
      hydrate(saved) {
        if (floatingPosition.loaded) return;
        floatingPosition.loaded = true;
        if (floatingPosition.localEdit) return;
        const next = isUsablePosition(saved) ? { right: saved.right, top: saved.top } : DEFAULT_POSITION;
        if (!samePosition(floatingPosition.value,next)) {
          floatingPosition.value = next;
          for (const fn of floatingPosition.listeners) fn();
        }
      },
    };
    const bounded = (number, min, max) => Math.max(min, Math.min(Math.max(min,max),number));
    /** Clamp to the visible intersection of the overlay's positioning container and viewport.
     * Use measured actual panel dimensions rather than arbitrary pixel limits.
     */
    function inBounds(position, root) {
      if (!root || !Number.isFinite(root.offsetWidth) || !Number.isFinite(root.offsetHeight)) return position;
      const parent = root.offsetParent ?? root.parentElement;
      const width = parent?.clientWidth ?? window.innerWidth;
      const height = parent?.clientHeight ?? window.innerHeight;
      if (!(width > 0 && height > 0)) return position;
      const rect = parent?.getBoundingClientRect?.() ?? {left:0,top:0};
      const viewW = Number.isFinite(window.innerWidth) ? window.innerWidth : width;
      const viewH = Number.isFinite(window.innerHeight) ? window.innerHeight : height;
      const visibleLeft = Math.max(0,-rect.left);
      const visibleRight = Math.min(width,viewW-rect.left);
      const visibleTop = Math.max(0,-rect.top);
      const visibleBottom = Math.min(height,viewH-rect.top);
      if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return position;
      const left = bounded(width-position.right-root.offsetWidth,
        visibleLeft+POSITION_MARGIN,visibleRight-root.offsetWidth-POSITION_MARGIN);
      const top = bounded(position.top == null ? root.offsetTop : position.top,
        visibleTop+POSITION_MARGIN,visibleBottom-root.offsetHeight-POSITION_MARGIN);
      const right = width-left-root.offsetWidth;
      if (position.top == null && Math.abs(right-position.right) < 0.5
          && Math.abs(top-root.offsetTop) < 0.5) return position;
      return { right, top };
    }
    function failureText(result) { return result?.error?.message ?? result?.error ?? 'Request failed'; }
    function apply(ctx) {
      const rpc = async (method, payload = {}, signal) => {
        const result = await ctx.connection.rpc.call(CHANNEL, ENDPOINT, { method, payload }, signal);
        if (!result.ok) throw new Error(failureText(result));
        return result.value;
      };
      /** Serialize position saves from dragging, resize correction, and the reset button. */
      const persistPosition = (position,cwd,onError=()=>{}) => {
        const value = position.top == null ? null : {right:position.right,top:position.top};
        floatingPosition.saveQueue = floatingPosition.saveQueue.catch(()=>{}).then(() =>
          rpc('saveSettings',{cwd,patch:{floatingPosition:value}})).catch(error=>{
            onError('Failed to save floating window position: ' + (error?.message ?? String(error)));
          });
        return floatingPosition.saveQueue;
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
        const floatingPreference = React.useSyncExternalStore(visibility.subscribe, visibility.getSnapshot, visibility.getSnapshot);
        const [statusEntry, setStatusEntry] = React.useState(null);
        // Index status by cwd to avoid showing the previous Session's repository while switching.
        const data = statusEntry != null && statusEntry.cwd === cwd ? statusEntry.data : null;
        const [problem, setProblem] = React.useState('');
        const [working, setWorking] = React.useState(false);
        const handledCommitId = React.useRef(null);
        const activeCommitId = React.useRef(null);
        const lastObservedCommitId = React.useRef(null);
        const [notice, setNotice] = React.useState('');
        const [feedback, setFeedback] = React.useState(null);
        const feedbackSequence = React.useRef(0);
        const [collapsed, setCollapsed] = React.useState(false);
        const position = React.useSyncExternalStore(floatingPosition.subscribe, floatingPosition.getSnapshot, floatingPosition.getSnapshot);
        const rootRef = React.useRef(null);
        const drag = React.useRef(null);
        const suppressClick = React.useRef(false);
        React.useEffect(() => { workspace.set(typeof cwd === 'string' ? cwd : ''); }, [cwd]);
        React.useEffect(() => {
          if (!cwd) return;
          let valid = true;
          const revision = visibility.version;
          void rpc('settings', { cwd }).then(settings => {
            if (valid) {
              floatingPosition.hydrate(settings.floatingPosition);
              if (visibility.version === revision) visibility.set(settings);
            }
          }, () => { if (valid && visibility.version === revision) visibility.set({ autoHideNonGit: false }); });
          return () => { valid = false; };
        }, [cwd]);
        const showCommitResult = (result, id) => {
          if (id != null && handledCommitId.current === id) return;
          if (id != null) handledCommitId.current = id;
          if (result.success) {
            setFeedback({
              id: ++feedbackSequence.current,
              heading: `Committed ${result.hash} · +${result.additions} −${result.deletions}`,
              hash: result.hash, additions: result.additions, deletions: result.deletions,
              subject: String(result.message ?? '').split(/\r?\n/, 1)[0].trim(),
              llm: result.llm ?? null, expiresAt: Date.now() + 10000,
            });
          } else setNotice('Commit failed: ' + result.error);
        };
        React.useEffect(() => {
          handledCommitId.current = null;
          activeCommitId.current = null;
          lastObservedCommitId.current = null;
          setWorking(false);
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
              const { token, commitState } = await rpc('changeToken', { cwd });
              if (cancelled) return;
              if (commitState) {
                if (lastObservedCommitId.current === null) lastObservedCommitId.current = commitState.id;
                const isNewResult = commitState.id > lastObservedCommitId.current;
                if (commitState.working) {
                  activeCommitId.current = commitState.id;
                  setWorking(true);
                } else {
                  setWorking(false);
                  if (commitState.result && (activeCommitId.current === commitState.id || isNewResult)) {
                    showCommitResult(commitState.result,commitState.id);
                    activeCommitId.current = null;
                  }
                }
                lastObservedCommitId.current = Math.max(lastObservedCommitId.current,commitState.id);
              } else setWorking(false);
              if (previousToken !== token || Date.now() - lastFull > 30000) {
                previousToken = token;
                await refresh();
              }
            } catch { if (Date.now() - lastFull > 5000) await refresh(); }
          };
          setStatusEntry(null); setNotice(''); setFeedback(null); setProblem('');
          void tick();
          const interval = setInterval(() => { void tick(); }, 900);
          return () => { cancelled = true; clearInterval(interval); };
        }, [cwd]);
        React.useEffect(() => {
          if (!feedback) return;
          // One timer per completed commit: cleanup prevents stale results from
          // removing a newer notification or firing after the Session closes.
          const remaining = Math.max(0, feedback.expiresAt - Date.now());
          const timer = setTimeout(() => setFeedback(current => current === feedback ? null : current), remaining);
          return () => clearTimeout(timer);
        }, [feedback]);
        const isNonGit = data?.isRepository === false;
        const hiddenNonGit = isNonGit && (!floatingPreference.ready || floatingPreference.hide);
        // Watch both the pane and the panel: window resizing, folding, or a new
        // commit feedback line may reduce available space or increase card height.
        React.useEffect(() => {
          const root = rootRef.current;
          if (!root || !sessionId || !cwd || hiddenNonGit || !floatingPosition.loaded) return;
          const check = () => {
            if (drag.current) return;
            const checked = inBounds(floatingPosition.value,root);
            if (!samePosition(checked,floatingPosition.value)) {
              floatingPosition.set(checked);
              void persistPosition(checked,cwd,setNotice);
            }
          };
          check();
          const ResizeObserverClass = window.ResizeObserver;
          const observer = typeof ResizeObserverClass === 'function' ? new ResizeObserverClass(check) : null;
          if (observer) { observer.observe(root); if(root.offsetParent) observer.observe(root.offsetParent); }
          window.addEventListener?.('resize',check);
          return () => { observer?.disconnect(); window.removeEventListener?.('resize',check); };
        }, [cwd,sessionId,collapsed,hiddenNonGit,!!feedback,floatingPosition.loaded,position.top == null]);
        if (!sessionId || !cwd) return null;
        const location = { right: position.right, ...(position.top == null ? { bottom: position.bottom } : { top: position.top }) };
        // Do not flash a non-Git warning before persisted global visibility is known.
        if (hiddenNonGit) return null;
        // The first collapse turns bottom-right placement into top-right placement.
        // Both compact and expanded cards thereafter share exactly the same top/right.
        const pinUpperRight = event => {
          if (floatingPosition.value.top != null) return;
          const root = event.currentTarget.closest?.('.dgc-root');
          if (root && Number.isFinite(root.offsetTop)) {
            const next = inBounds({ right:floatingPosition.value.right, top:root.offsetTop }, root);
            floatingPosition.set(next);
            void persistPosition(next,cwd,setNotice);
          }
        };
        const onDragStart = event => {
          if (event.button !== 0) return;
          const root = event.currentTarget.closest?.('.dgc-root');
          const top = floatingPosition.value.top ?? root?.offsetTop ?? 0;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
            right: floatingPosition.value.right, top, moved: false, root };
          suppressClick.current = false;
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
        };
        const onDragMove = event => {
          const d = drag.current;
          if (!d || d.id !== event.pointerId) return;
          const dx = event.clientX - d.x, dy = event.clientY - d.y;
          if (!d.moved && dx * dx + dy * dy < 16) return;
          d.moved = true;
          floatingPosition.set(inBounds({right:d.right-dx,top:d.top+dy},d.root));
        };
        const onDragEnd = event => {
          if (drag.current?.id !== event.pointerId) return;
          if (drag.current.moved) {
            suppressClick.current = true;
            void persistPosition(floatingPosition.value,cwd,setNotice);
          }
          drag.current = null;
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
        };
        const onDragCancel = () => { if (drag.current?.moved) void persistPosition(floatingPosition.value,cwd,setNotice); drag.current = null; suppressClick.current = false; };
        const dragHandlers = { onPointerDown: onDragStart, onPointerMove: onDragMove,
          onPointerUp: onDragEnd, onPointerCancel: onDragCancel };
        const fold = event => { pinUpperRight(event); setCollapsed(true); };
        if (collapsed) return h('div',{className:'dgc-root',style:location,ref:rootRef},
          h('div',{className:'dgc-card dgc-card-collapsed'},
            h('button',{type:'button',className:'dgc-collapsed-trigger',title:'Git commit','aria-label':'Git commit',
              ...dragHandlers,
              onClick:()=>{ if (suppressClick.current) { suppressClick.current = false; return; } setCollapsed(false); }},
              actionIcon('git'),
              isNonGit ? h('span',{className:'dgc-git-cross','aria-hidden':true},actionIcon('cross')) : null)));
        if (isNonGit) return h('div',{className:'dgc-root',style:location,ref:rootRef},
          h('div',{className:'dgc-card dgc-card-no-repo',role:'status'},
            h('div',{className:'dgc-line'},
              h('span',{className:'dgc-no-repo',title:'Drag Git commit window',...dragHandlers},'Not a git repository'),
              h('button',{type:'button',className:'dgc-fold',title:'Collapse Git commit',
                'aria-label':'Collapse Git commit',onClick:fold},actionIcon('collapse')))));
        const hasChanges = data && (data.additions || data.deletions || data.untracked || data.binary || data.stagedFiles);
        const onCommit = async () => {
          if (working || !hasChanges || data?.isRepository === false) return;
          setWorking(true); setNotice(''); setFeedback(null);
          try {
            const result = await rpc('commit', { cwd });
            showCommitResult(result, activeCommitId.current);
            setStatusEntry({cwd, data: await rpc('status', { cwd })});
          } catch (error) { setNotice('Commit failed: ' + error.message); }
          finally { setWorking(false); }
        };
        const grip = h('span', {
          className:'dgc-grip', title:'Drag Git commit window', ...dragHandlers,
        },'⠿');
        return h('div',{className:'dgc-root',style:location,ref:rootRef},
          h('div',{className:'dgc-card'},
            h('div',{className:'dgc-line'},grip,
              h('span',{className:'dgc-branch',title:data?.branch??'Git…'},data?.branch??'Git…'),
              h('button',{type:'button',className:'dgc-fold',title:'Collapse Git commit','aria-label':'Collapse Git commit',
                onClick:fold},actionIcon('collapse'))),
            h('div',{className:'dgc-numbers'},h('span',{className:'dgc-add'},`+${data?.additions??0}`),h('span',{className:'dgc-del'},`−${data?.deletions??0}`)),
            h('div',{className:'dgc-line dgc-actions'},
              h('button',{type:'button',className:'dgc-button dgc-icon-button dgc-primary',disabled:working||!hasChanges,onClick:onCommit,
                title:working?'Committing changes…':data?.stagedFiles?'Commit staged changes only':'Stage and commit all changes',
                'aria-label':working?'Committing changes':data?.stagedFiles?'Commit staged changes only':'Stage and commit all changes'},actionIcon(working?'loading':'commit')),
              h('button',{type:'button',className:'dgc-button dgc-icon-button dgc-secondary',
                title:'Commit settings','aria-label':'Commit settings',
                onClick:()=>{if(data?.isRepository!==true)return;try{ctx.sidebarRight.openTab(TAB_KIND);}catch(error){setNotice(error.message);}}},actionIcon('settings'))),
            problem?h('div',{className:'dgc-notice dgc-error'},problem):null,
            notice?h('div',{className:'dgc-notice dgc-error',role:'alert',style:{whiteSpace:'pre-wrap'}},notice):null,
            feedback?h('div',{key:feedback.id,className:'dgc-feedback',role:'status','aria-label':'Commit completed'},
              h('div',{className:'dgc-result-head',title:feedback.heading},
                `Committed ${feedback.hash} · `,
                h('span',{className:'dgc-add'},`+${feedback.additions}`),' ',
                h('span',{className:'dgc-del'},`−${feedback.deletions}`)),
              h('div',{className:'dgc-result-subject',title:feedback.subject},feedback.subject),
              floatingPreference.showTokenDetails
                ? h('div',{className:'dgc-result-metrics',title:tokenLine(feedback.llm)},tokenLine(feedback.llm)) : null,
              h('div',{className:'dgc-countdown-track',role:'progressbar','aria-label':'Commit notification countdown',
                'aria-valuemin':0,'aria-valuemax':10},
                h('div',{className:'dgc-countdown-fill',style:{
                  backgroundColor:floatingPreference.countdownColor,
                  animationDelay:`-${Math.min(10000,Math.max(0,10000 - (feedback.expiresAt - Date.now())))}ms`,
                }}))) : null
          )
        );
      }

      function CommitSettings() {
        const cwd = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot, workspace.getSnapshot);
        const [form, setForm] = React.useState(null);
        const [activeTab, setActiveTab] = React.useState('repository');
        const [models, setModels] = React.useState([]);
        const [defaultModel, setDefaultModel] = React.useState(null);
        const [loadError, setLoadError] = React.useState('');
        const [saveError, setSaveError] = React.useState('');
        const saverRef = React.useRef(null);
        React.useEffect(()=>{
          let active = true;
          setForm(null); setLoadError(''); setSaveError('');
          // Global settings remain readable even when cwd is outside a repository.
          void rpc('settings',{cwd}).then(value=>{if(active){setForm(value);visibility.set(value);floatingPosition.hydrate(value.floatingPosition);}},error=>{if(active)setLoadError(error.message);});
          void rpc('models').then(catalog=>{
            if (!active)return;
            setModels(catalog.models??[]);setDefaultModel(catalog.defaultModel??null);
          },error=>{if(active)setLoadError(error.message);});
          return ()=>{active=false;};
        },[cwd]);
        React.useEffect(()=>{
          // A repository-less workspace still permits editing global preferences.
          if (form?.isRepository === false) setActiveTab('global');
        },[form?.isRepository]);
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
          if (key === 'autoHideNonGit' || key === 'showTokenDetails' || key === 'countdownColor') {
            visibility.set({ [key]: value });
          }
          setForm(current=>({...current,[key]:value}));
          setSaveError('');
          saverRef.current?.update(key,value,immediate);
        };
        const repository = form?.isRepository === true;
        const selectedModelKey = selection => selection ? `${selection.provider}\t${selection.model}` : '';
        const modelChoices = selected => {
          const entries = models.map(entry => h('option',{
            key:`${entry.provider}/${entry.model}`,value:`${entry.provider}\t${entry.model}`,
          },`${entry.providerName} / ${entry.name}`));
          if (selected && !models.some(entry => entry.provider === selected.provider && entry.model === selected.model)) {
            entries.unshift(h('option',{key:'selected-unknown',value:selectedModelKey(selected)},
              `${selected.provider} / ${selected.model}`));
          }
          return entries;
        };
        // Always display the model currently inherited, even if the global selector
        // is set to DSH default (which can itself change independently).
        const effectiveGlobalModel = form?.model ?? defaultModel ?? models[0] ?? null;
        const inheritedModelName = effectiveGlobalModel ? (() => {
          const entry = models.find(item => item.provider === effectiveGlobalModel.provider
            && item.model === effectiveGlobalModel.model);
          return entry ? `${entry.providerName} / ${entry.name}`
            : `${effectiveGlobalModel.provider} / ${effectiveGlobalModel.model}`;
        })() : 'Not configured';
        const tabs = h('div',{className:'dgc-tabs',role:'tablist','aria-label':'Git commit settings scope'},
          ...['repository','global'].map(tab => h('button',{
            type:'button',key:tab,role:'tab',id:`dgc-tab-${tab}`,
            'aria-label':tab === 'repository' ? 'Repository' : 'Global',
            'aria-selected':activeTab === tab, 'aria-controls':`dgc-panel-${tab}`,
            tabIndex:activeTab === tab ? 0 : -1,
            className:'dgc-tab',onClick:()=>setActiveTab(tab),
            onKeyDown:event=>{
              const next = event.key === 'ArrowLeft' ? 'repository'
                : event.key === 'ArrowRight' ? 'global'
                  : event.key === 'Home' ? 'repository' : event.key === 'End' ? 'global' : null;
              if (next) {
                event.preventDefault();
                setActiveTab(next);
                event.currentTarget.parentElement?.querySelector?.(`#dgc-tab-${next}`)?.focus?.();
              }
            },
          },tab === 'repository' ? 'Repository' : 'Global')));
        const modelSelect = (key,value,onChange,firstLabel,firstValue) => h('label',{
          className:'dgc-field',key,
        },'Model',h('select',{'aria-label':activeTab === 'repository' ? 'Repository model' : 'Global model',
          value,onChange,
        },h('option',{value:firstValue},firstLabel),...modelChoices(
          activeTab === 'repository' ? form.repositoryModel : form.model)));
        const content = !form ? null : activeTab === 'repository'
          ? (repository ? [
              modelSelect('repository-model',form.repositoryModel ? selectedModelKey(form.repositoryModel) : 'inherit-global',e=>{
                const choice=e.target.value;
                const selected=models.find(entry=>selectedModelKey(entry)===choice);
                update('repositoryModel',choice==='inherit-global'?null:selected
                  ? {provider:selected.provider,model:selected.model} : form.repositoryModel,true);
              },`Inherit Global (${inheritedModelName})`,'inherit-global'),
              h('hr',{key:'repository-divider',className:'dgc-settings-divider'}),
              h('label',{className:'dgc-check',key:'inherit'},
                h('input',{type:'checkbox',checked:form.inheritGlobal,
                  onChange:e=>update('inheritGlobal',e.target.checked,true)}),
                'Inherit global instruction'),
              h('label',{className:'dgc-field',key:'repo'},'Repository commit instruction',
                h('textarea',{value:form.repositoryInstruction,onChange:e=>update('repositoryInstruction',e.target.value),
                  onBlur:()=>{void saverRef.current?.flush();},placeholder:'Repository-specific commit conventions'})),
              h('code',{className:'dgc-repo-path',key:'path'},form.root),
            ] : h('div',{className:'dgc-subtle',key:'no-repo'},'Not a git repository'))
          : [
              modelSelect('global-model',selectedModelKey(form.model),e=>{
                const choice=e.target.value;
                const selected=models.find(entry=>selectedModelKey(entry)===choice);
                update('model',!choice?null:selected
                  ? {provider:selected.provider,model:selected.model}:form.model,true);
              },defaultModel
                ? `DSH default (${defaultModel.provider}/${defaultModel.model})` : 'DSH default',''),
              h('hr',{key:'global-divider',className:'dgc-settings-divider'}),
              h('label',{className:'dgc-field',key:'global'},'Global commit instruction',
                h('textarea',{value:form.globalInstruction,onChange:e=>update('globalInstruction',e.target.value),
                  onBlur:()=>{void saverRef.current?.flush();},placeholder:'Shared conventions for every repository'})),
              h('label',{className:'dgc-check',key:'autoHideNonGit'},
                h('input',{type:'checkbox',checked:form.autoHideNonGit===true,
                  onChange:e=>update('autoHideNonGit',e.target.checked,true)}),
                'Automatically hide floating window in non-git projects'),
              h('label',{className:'dgc-check',key:'showTokenDetails'},
                h('input',{type:'checkbox',checked:form.showTokenDetails===true,
                  onChange:e=>update('showTokenDetails',e.target.checked,true)}),
                'Show token details'),
              h('label',{className:'dgc-countdown-color',key:'countdownColor'},
                h('span',null,'Countdown color'),
                h('input',{type:'color',value:colorOrDefault(form.countdownColor),
                  'aria-label':'Countdown color',title:'Countdown color',
                  onChange:e=>update('countdownColor',e.target.value,true)})),
              h('hr',{key:'positionDivider',className:'dgc-settings-divider'}),
              h('button',{type:'button',key:'resetPosition',className:'dgc-reset-position',
                'aria-label':'Reset floating window position',title:'Reset floating window position',
                onClick:()=>{
                  floatingPosition.set(DEFAULT_POSITION);
                  setSaveError('');
                  void persistPosition(DEFAULT_POSITION,cwd,setSaveError);
                }},'Reset floating window position'),
            ];
        return h('div',{className:'dgc-settings'},
          h('h3',null,'Git commit settings'),
          tabs,
          !form ? h('div',{className:'dgc-subtle'},loadError||'Loading…')
            : h('div',{className:'dgc-tab-panel',role:'tabpanel',id:`dgc-panel-${activeTab}`,
              'aria-labelledby':`dgc-tab-${activeTab}`},content),
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
