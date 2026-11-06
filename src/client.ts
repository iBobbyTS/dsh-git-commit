import type {
  GitCommitApi,
  GitCommitRequest,
  GitCommitResult,
  GitCommitSettings,
  GitActionResult,
  GitCommitLlmMetrics,
} from './protocol.js'
type Stop = () => void
type TextError = string | { key: string; reason?: string }
type Translator = (key: string, params?: object) => string
type Position = { right: number; top: number | null; bottom?: number }
type RepoStatus = Awaited<ReturnType<GitCommitApi['status']>>
type ModelSelection = { provider: string; model: string }
type Catalog = Awaited<ReturnType<GitCommitApi['models']>>
type TimerState = {
  id: number
  paused: boolean
  remainingMs: number
  expiresAt: number
}
type ActionFeedback = Partial<GitActionResult> & {
  success: boolean
} & TimerState
type CommitFeedback = TimerState & {
  hash: string | null
  additions: number
  deletions: number
  subject: string
  llm: GitCommitLlmMetrics | null
}
interface ClientContext {
  locale: {
    bind(ns: string): Translator
    subscribe(fn: Stop): Stop
    getSnapshot(): unknown
    register(ns: string, dictionaries: object): Stop
  }
  connection: {
    rpc: {
      call(
        channel: string,
        endpoint: string,
        request: object,
        signal?: AbortSignal,
      ): Promise<{
        ok: boolean
        value: unknown
        error?: string | { message: string }
      }>
    }
  }
  sidebarRight: {
    mounted: { subscribe(fn: Stop): Stop; getSnapshot(): string | undefined }
    openTab(kind: string): unknown
  }
  sidebarRightTabs: { register(spec: object): Stop }
  slots: {
    inject(name: string, fn: () => unknown): unknown
    register(spec: object, component: React.ComponentType<never>): Stop
  }
  effect(fn: () => unknown, label: string): unknown
}
function errorMessage(error: unknown): string {
  return error !== null && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error)
}

import * as React from 'react'
const h = React.createElement
const TAB_ID = 'dsh-git-commit/settings'
const TAB_KIND = 'gitCommitSettings'
const CHANNEL = '/api'
const ENDPOINT = 'git-commit'
const LOCALE_NS = 'dshGitCommit'
// DSH maps Simplified Chinese to 'zh'; unprovided locales fall back to 'en'.
const translations = {
  zh: {
    gitCommit: 'Git 提交',
    settingsTitle: 'Git 提交设置',
    settingsScope: 'Git 提交设置范围',
    dragWindow: '拖动 Git 提交浮窗',
    notRepository: '当前目录不是 Git 仓库',
    collapse: '折叠 Git 提交浮窗',
    committing: '正在提交更改',
    committingTitle: '正在提交更改…',
    stagedOnly: '仅提交已暂存的更改',
    stageAll: '暂存并提交所有更改',
    commitSettings: '提交设置',
    completed: '提交完成',
    committed: '已提交 {hash}',
    countdown: '提交提示倒计时',
    push: '推送提交',
    pushing: '正在推送…',
    pushed: '推送成功',
    pushFailed: '推送失败：{reason}',
    pushUpToDate: '已是最新，无需推送',
    pushCountdown: '推送提示倒计时',
    mergeAndDelete: '合并并删除分支',
    merging: '正在合并并删除…',
    mergedAndDeleted: '已将 {source} 合并到 {target} 并删除本地分支',
    mergeFailed: '合并并删除失败：{reason}',
    mergeCountdown: '合并提示倒计时',
    repository: '仓库',
    global: '全局',
    model: '模型',
    repositoryModel: '仓库模型',
    globalModel: '全局模型',
    inheritGlobal: '继承全局设置 ({model})',
    inheritInstruction: '继承全局指令',
    repositoryInstruction: '仓库提交指令',
    repositoryPlaceholder: '当前仓库专属的提交约定',
    dshDefault: 'DSH 默认',
    dshDefaultNamed: 'DSH 默认 ({model})',
    globalInstruction: '全局提交指令',
    globalPlaceholder: '适用于所有仓库的提交约定',
    autoHide: '在非 Git 项目中自动隐藏浮窗',
    showTokens: '显示 Token 详情',
    countdownColor: '倒计时颜色',
    resetPosition: '恢复浮窗默认位置',
    loading: '正在加载…',
    notConfigured: '未配置',
    saveFailed: '保存设置失败：{reason}',
    positionFailed: '保存浮窗位置失败：{reason}',
    commitFailed: '提交失败：{reason}',
    requestFailed: '请求失败',
  },
  en: {
    gitCommit: 'Git commit',
    settingsTitle: 'Git commit settings',
    settingsScope: 'Git commit settings scope',
    dragWindow: 'Drag Git commit window',
    notRepository: 'Not a git repository',
    collapse: 'Collapse Git commit',
    committing: 'Committing changes',
    committingTitle: 'Committing changes…',
    stagedOnly: 'Commit staged changes only',
    stageAll: 'Stage and commit all changes',
    commitSettings: 'Commit settings',
    completed: 'Commit completed',
    committed: 'Committed {hash}',
    countdown: 'Commit notification countdown',
    push: 'Push commits',
    pushing: 'Pushing…',
    pushed: 'Push succeeded',
    pushFailed: 'Push failed: {reason}',
    pushUpToDate: 'Already up to date',
    pushCountdown: 'Push notification countdown',
    mergeAndDelete: 'Merge and delete branch',
    merging: 'Merging and deleting…',
    mergedAndDeleted:
      'Merged {source} into {target} and deleted the local branch',
    mergeFailed: 'Merge and delete failed: {reason}',
    mergeCountdown: 'Merge notification countdown',
    repository: 'Repository',
    global: 'Global',
    model: 'Model',
    repositoryModel: 'Repository model',
    globalModel: 'Global model',
    inheritGlobal: 'Inherit Global ({model})',
    inheritInstruction: 'Inherit global instruction',
    repositoryInstruction: 'Repository commit instruction',
    repositoryPlaceholder: 'Repository-specific commit conventions',
    dshDefault: 'DSH default',
    dshDefaultNamed: 'DSH default ({model})',
    globalInstruction: 'Global commit instruction',
    globalPlaceholder: 'Shared conventions for every repository',
    autoHide: 'Automatically hide floating window in non-git projects',
    showTokens: 'Show token details',
    countdownColor: 'Countdown color',
    resetPosition: 'Reset floating window position',
    loading: 'Loading…',
    notConfigured: 'Not configured',
    saveFailed: 'Failed to save settings: {reason}',
    positionFailed: 'Failed to save floating window position: {reason}',
    commitFailed: 'Commit failed: {reason}',
    requestFailed: 'Request failed',
  },
}
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
      .dgc-actions .dgc-merge-delete{width:56px;min-width:56px;flex:0 0 56px;gap:3px}
      .dgc-feedback-divider{width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l2);margin:0 0 8px}
      .dgc-action-feedback{max-width:320px;white-space:pre-wrap;overflow-wrap:anywhere}
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
      .dgc-plugin-config{width:100%;max-width:100%;box-sizing:border-box;padding:8px 0 14px;display:flex;flex-direction:column;gap:10px}
      .dgc-reset-position{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:34px;width:max-content;max-width:100%;padding:7px 14px;font:inherit;cursor:pointer;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
      .dgc-reset-position:hover{background:var(--dsw-alias-bg-layer-2)}
      .dgc-reset-position:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-countdown-color{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
      .dgc-countdown-color input{width:42px;height:30px;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);cursor:pointer}
      .dgc-countdown-color input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dgc-feedback{display:flex;flex-direction:column;gap:4px;min-width:0;width:max-content;max-width:none;box-sizing:border-box}
      .dgc-result-head{font:600 10.5px/1.4 ui-monospace,Menlo,monospace;letter-spacing:-.15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dgc-result-subject{font:12px/1.4 var(--dsh-font-family-text,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dgc-result-subject-wrap{white-space:normal;overflow:visible;text-overflow:clip}
      .dgc-result-metrics{font:10.5px/1.5 ui-monospace,Menlo,monospace;white-space:nowrap;width:max-content;max-width:none;overflow:visible;text-overflow:clip}
      .dgc-countdown-track{width:100%;height:3px;overflow:hidden;border-radius:99px;background:rgba(128,136,150,.18);margin-top:3px}
      .dgc-countdown-fill{width:100%;height:100%;background-color:#f59e0b;transform-origin:left center;animation:dgc-countdown 10s linear forwards}
      @keyframes dgc-countdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}
    `
/** All icons inherit theme text color, with accessible text on their buttons. */
function actionIcon(kind: string) {
  const props = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: 'false',
  }
  if (kind === 'loading')
    return h(
      'svg',
      { ...props, className: 'dgc-loading-icon' },
      h('path', { d: 'M12 3a9 9 0 1 1-9 9' }),
    )
  if (kind === 'commit')
    return h(
      'svg',
      props,
      h('path', { d: 'M2.5 12h5' }),
      h('circle', { cx: 12, cy: 12, r: 4.5 }),
      h('path', { d: 'M16.5 12h5' }),
    )
  if (kind === 'push')
    return h(
      'svg',
      props,
      h('path', { d: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5' }),
    )
  if (kind === 'merge')
    return h(
      'svg',
      props,
      h('circle', { cx: 6, cy: 4, r: 2 }),
      h('circle', { cx: 6, cy: 20, r: 2 }),
      h('circle', { cx: 18, cy: 4, r: 2 }),
      h('path', { d: 'M6 6v12M18 6c0 7-12 3-12 10' }),
    )
  if (kind === 'delete')
    return h(
      'svg',
      props,
      h('path', { d: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7' }),
    )
  if (kind === 'settings')
    return h(
      'svg',
      props,
      h('path', {
        d: 'M9.8 3h4.4l.5 2.05 1.33.55 1.82-1.09 3.11 3.11-1.09 1.82.55 1.33 2.05.5v4.4l-2.05.5-.55 1.33 1.09 1.82-3.11 3.11-1.82-1.09-1.33.55-.5 2.05H9.8l-.5-2.05-1.33-.55-1.82 1.09-3.11-3.11 1.09-1.82-.55-1.33-2.05-.5v-4.4l2.05-.5.55-1.33-1.09-1.82 3.11-3.11 1.82 1.09 1.33-.55.5-2.05Z',
      }),
      h('circle', { cx: 12, cy: 13.5, r: 3 }),
    )
  if (kind === 'collapse')
    return h('svg', props, h('path', { d: 'M6 10l6 6 6-6' }))
  if (kind === 'cross')
    return h('svg', props, h('path', { d: 'M5 5l14 14M19 5L5 19' }))
  return h(
    'svg',
    props,
    h('circle', { cx: 6, cy: 4, r: 2 }),
    h('path', { d: 'M6 6v8a5 5 0 0 0 5 5h7' }),
    h('circle', { cx: 18, cy: 19, r: 2 }),
  )
}

/** Merge changed settings only; serialize requests so older saves cannot overwrite newer edits. */
function createAutoSaver(
  send: (patch: Record<string, unknown>) => Promise<unknown>,
  onError: (error: TextError) => void,
) {
  let pending: Record<string, unknown> = {}
  let timer: ReturnType<typeof setTimeout> | null = null
  let active: Promise<void> | null = null
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (active) return active
    active = (async () => {
      while (Object.keys(pending).length) {
        const patch = pending
        pending = {}
        try {
          await send(patch)
          onError('')
        } catch (error) {
          // Keep unsaved edits, preserving newer values on conflicting fields.
          pending = { ...patch, ...pending }
          onError({ key: 'saveFailed', reason: errorMessage(error) })
          break
        }
      }
    })().finally(() => {
      active = null
    })
    return active
  }
  const update = (key: string, value: unknown, immediate = false) => {
    pending[key] = value
    if (timer !== null) clearTimeout(timer)
    if (immediate) {
      void flush()
    } else
      timer = setTimeout(() => {
        timer = null
        void flush()
      }, 400)
  }
  return {
    update,
    flush,
    close: () => {
      void flush()
    },
  }
}
const colorOrDefault = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : '#f59e0b'
const countText = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value).toLocaleString('en-US')
    : '—'
const secondsText = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? (value / 1000).toFixed(2)
    : '—'
const speedText = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value.toFixed(1)
    : '—'
function tokenLine(llm: GitCommitLlmMetrics | null) {
  return `↓ ${countText(llm?.inputTokens)} ↑ ${countText(llm?.outputTokens)} | ${secondsText(llm?.latencyMs)}s · ${speedText(llm?.outputSpeedTps)}t/s`
}
const workspace = {
  cwd: '',
  listeners: new Set<Stop>(),
  getSnapshot() {
    return workspace.cwd
  },
  subscribe(fn: Stop) {
    workspace.listeners.add(fn)
    return () => workspace.listeners.delete(fn)
  },
  set(cwd: string) {
    if (cwd !== workspace.cwd) {
      workspace.cwd = cwd
      workspace.listeners.forEach((fn) => fn())
    }
  },
}
// The setting is Host-owned, but the two Client panels share its current value.
const visibility = {
  value: {
    hide: false,
    showTokenDetails: false,
    countdownColor: '#f59e0b',
    ready: false,
  },
  version: 0,
  listeners: new Set<Stop>(),
  getSnapshot() {
    return visibility.value
  },
  subscribe(fn: Stop) {
    visibility.listeners.add(fn)
    return () => visibility.listeners.delete(fn)
  },
  /** Partial global setting patch, synchronized immediately between both Client surfaces. */
  set(patch: Partial<GitCommitSettings>) {
    const current = visibility.value
    const next = {
      hide: Object.hasOwn(patch, 'autoHideNonGit')
        ? patch.autoHideNonGit === true
        : current.hide,
      showTokenDetails: Object.hasOwn(patch, 'showTokenDetails')
        ? patch.showTokenDetails === true
        : current.showTokenDetails,
      countdownColor: Object.hasOwn(patch, 'countdownColor')
        ? colorOrDefault(patch.countdownColor)
        : current.countdownColor,
      ready: true,
    }
    if (
      !current.ready ||
      current.hide !== next.hide ||
      current.showTokenDetails !== next.showTokenDetails ||
      current.countdownColor !== next.countdownColor
    ) {
      visibility.value = next
      visibility.version++
      for (const fn of visibility.listeners) fn()
    }
  },
}
/** The default is lower-right anchored. Explicit moves are top/right anchored. */
const DEFAULT_POSITION: Position = Object.freeze({
  right: 24,
  bottom: 98,
  top: null,
})
const POSITION_MARGIN = 6
const isUsablePosition = (
  pos: unknown,
): pos is { right: number; top: number } =>
  pos !== null &&
  typeof pos === 'object' &&
  'right' in pos &&
  'top' in pos &&
  typeof pos.right === 'number' &&
  typeof pos.top === 'number' &&
  Number.isFinite(pos.right) &&
  pos.right >= 0 &&
  Number.isFinite(pos.top) &&
  pos.top >= 0
const samePosition = (a: Position, b: Position) =>
  a.right === b.right && a.top === b.top
/**
 * Shared between settings and overlay; one global saved position per Desktop profile.
 * A late settings response must never undo a local drag or reset.
 */
const floatingPosition = {
  value: DEFAULT_POSITION,
  loaded: false,
  localEdit: false,
  listeners: new Set<Stop>(),
  saveQueue: Promise.resolve() as Promise<unknown>,
  subscribe(fn: Stop) {
    floatingPosition.listeners.add(fn)
    return () => floatingPosition.listeners.delete(fn)
  },
  getSnapshot() {
    return floatingPosition.value
  },
  set(next: Position) {
    floatingPosition.localEdit = true
    if (!samePosition(floatingPosition.value, next)) {
      floatingPosition.value = next
      for (const fn of floatingPosition.listeners) fn()
    }
  },
  hydrate(saved: unknown) {
    if (floatingPosition.loaded) return
    floatingPosition.loaded = true
    if (floatingPosition.localEdit) return
    const next = isUsablePosition(saved)
      ? { right: saved.right, top: saved.top }
      : DEFAULT_POSITION
    if (!samePosition(floatingPosition.value, next)) {
      floatingPosition.value = next
      for (const fn of floatingPosition.listeners) fn()
    }
  },
}
const bounded = (number: number, min: number, max: number) =>
  Math.max(min, Math.min(Math.max(min, max), number))
/** Clamp to the visible intersection of the overlay's positioning container and viewport.
 * Use measured actual panel dimensions rather than arbitrary pixel limits.
 */
function inBounds(position: Position, root: HTMLElement | null) {
  if (
    !root ||
    !Number.isFinite(root.offsetWidth) ||
    !Number.isFinite(root.offsetHeight)
  )
    return position
  const parent = root.offsetParent ?? root.parentElement
  const width = parent?.clientWidth ?? window.innerWidth
  const height = parent?.clientHeight ?? window.innerHeight
  if (!(width > 0 && height > 0)) return position
  const rect = parent?.getBoundingClientRect?.() ?? { left: 0, top: 0 }
  const viewW = Number.isFinite(window.innerWidth) ? window.innerWidth : width
  const viewH = Number.isFinite(window.innerHeight)
    ? window.innerHeight
    : height
  const visibleLeft = Math.max(0, -rect.left)
  const visibleRight = Math.min(width, viewW - rect.left)
  const visibleTop = Math.max(0, -rect.top)
  const visibleBottom = Math.min(height, viewH - rect.top)
  if (visibleRight <= visibleLeft || visibleBottom <= visibleTop)
    return position
  const left = bounded(
    width - position.right - root.offsetWidth,
    visibleLeft + POSITION_MARGIN,
    visibleRight - root.offsetWidth - POSITION_MARGIN,
  )
  const top = bounded(
    position.top == null ? root.offsetTop : position.top,
    visibleTop + POSITION_MARGIN,
    visibleBottom - root.offsetHeight - POSITION_MARGIN,
  )
  const right = width - left - root.offsetWidth
  if (
    position.top == null &&
    Math.abs(right - position.right) < 0.5 &&
    Math.abs(top - root.offsetTop) < 0.5
  )
    return position
  return { right, top }
}
function failureText(
  result: { error?: string | { message: string } },
  t: Translator,
) {
  return (
    (typeof result.error === 'object' ? result.error.message : result.error) ??
    t('requestFailed')
  )
}
function apply(ctx: ClientContext) {
  const t = ctx.locale.bind(LOCALE_NS)
  const subscribeLocale = (listener: Stop) => ctx.locale.subscribe(listener)
  const localeSnapshot = () => ctx.locale.getSnapshot()
  const errorText = (value: TextError) =>
    typeof value === 'object' ? t(value.key, { reason: value.reason }) : value
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, translations),
    'dsh-git-commit: locales',
  )
  const rpc = async <K extends keyof GitCommitApi>(
    method: K,
    payload: object = {},
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<GitCommitApi[K]>>> => {
    const result = await ctx.connection.rpc.call(
      CHANNEL,
      ENDPOINT,
      { method, payload },
      signal,
    )
    if (!result.ok) throw new Error(failureText(result, t))
    return result.value as Awaited<ReturnType<GitCommitApi[K]>>
  }
  /** Serialize position saves from dragging, resize correction, and the reset button. */
  const persistPosition = (
    position: Position,
    cwd: string | undefined,
    onError: (error: TextError) => void = () => {},
  ) => {
    const value =
      position.top == null ? null : { right: position.right, top: position.top }
    floatingPosition.saveQueue = floatingPosition.saveQueue
      .catch(() => {})
      .then(() =>
        rpc('saveSettings', { cwd, patch: { floatingPosition: value } }),
      )
      .catch((error) => {
        onError({ key: 'positionFailed', reason: errorMessage(error) })
      })
    return floatingPosition.saveQueue
  }
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.dshGitCommit = 'true'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, 'dsh-git-commit: styles')

  /** Each operation owns its timer: replacing one never restarts a sibling. */
  function useActionFeedback(
    cwd: string | undefined,
    hovered: React.MutableRefObject<boolean>,
  ) {
    const [value, setValue] = React.useState<ActionFeedback | null>(null)
    const sequence = React.useRef(0)
    React.useEffect(() => {
      setValue(null)
    }, [cwd])
    React.useEffect(() => {
      if (!value || value.paused) return
      const timer = setTimeout(
        () => setValue((current) => (current === value ? null : current)),
        Math.max(0, value.expiresAt - Date.now()),
      )
      return () => clearTimeout(timer)
    }, [value])
    return {
      value,
      show(result: Partial<GitActionResult> & { success: boolean }) {
        setValue({
          ...result,
          id: ++sequence.current,
          paused: hovered.current,
          remainingMs: 10000,
          expiresAt: Date.now() + 10000,
        })
      },
      pause() {
        setValue((current) =>
          current && !current.paused
            ? {
                ...current,
                paused: true,
                remainingMs: Math.max(0, current.expiresAt - Date.now()),
              }
            : current,
        )
      },
      resume() {
        setValue((current) =>
          current?.paused
            ? {
                ...current,
                paused: false,
                expiresAt: Date.now() + current.remainingMs,
              }
            : current,
        )
      },
    }
  }
  function CommitPill(props: {
    useSessions: <T>(
      fn: (snapshot: { byId: Record<string, { cwd?: string }> }) => T,
    ) => T
  }) {
    React.useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot)
    const sessionId = React.useSyncExternalStore(
      ctx.sidebarRight.mounted.subscribe,
      ctx.sidebarRight.mounted.getSnapshot,
      ctx.sidebarRight.mounted.getSnapshot,
    )
    const cwd = props.useSessions((s) =>
      sessionId ? s.byId[sessionId]?.cwd : undefined,
    )
    const floatingPreference = React.useSyncExternalStore(
      visibility.subscribe,
      visibility.getSnapshot,
      visibility.getSnapshot,
    )
    const [statusEntry, setStatusEntry] = React.useState<{
      cwd: string
      data: RepoStatus
    } | null>(null)
    // Index status by cwd to avoid showing the previous Session's repository while switching.
    const data =
      statusEntry != null && statusEntry.cwd === cwd ? statusEntry.data : null
    const [problem, setProblem] = React.useState('')
    const [working, setWorking] = React.useState(false)
    const handledCommitId = React.useRef<number | null>(null)
    const activeCommitId = React.useRef<number | null>(null)
    const lastObservedCommitId = React.useRef<number | null>(null)
    const [notice, setNotice] = React.useState<TextError>('')
    const [feedback, setFeedback] = React.useState<CommitFeedback | null>(null)
    const feedbackSequence = React.useRef(0)
    const feedbackHovered = React.useRef(false)
    const pushFeedback = useActionFeedback(cwd, feedbackHovered)
    const mergeFeedback = useActionFeedback(cwd, feedbackHovered)
    const [pushReady, setPushReady] = React.useState(false)
    const [actionWorking, setActionWorking] = React.useState<
      'push' | 'mergeAndDelete' | null
    >(null)
    const actionLock = React.useRef<string | null>(null)
    const viewEpoch = React.useRef({ cwd })
    if (viewEpoch.current.cwd !== cwd) viewEpoch.current = { cwd }
    const [collapsed, setCollapsed] = React.useState(false)
    const position = React.useSyncExternalStore(
      floatingPosition.subscribe,
      floatingPosition.getSnapshot,
      floatingPosition.getSnapshot,
    )
    const rootRef = React.useRef<HTMLDivElement>(null)
    const drag = React.useRef<{
      id: number
      x: number
      y: number
      right: number
      top: number
      moved: boolean
      root: HTMLElement | null
    } | null>(null)
    const suppressClick = React.useRef(false)
    React.useEffect(() => {
      workspace.set(typeof cwd === 'string' ? cwd : '')
    }, [cwd])
    React.useEffect(() => {
      if (!cwd) return
      let valid = true
      const revision = visibility.version
      void rpc('settings', { cwd }).then(
        (settings) => {
          if (valid) {
            floatingPosition.hydrate(settings.floatingPosition)
            if (visibility.version === revision) visibility.set(settings)
          }
        },
        () => {
          if (valid && visibility.version === revision)
            visibility.set({ autoHideNonGit: false })
        },
      )
      return () => {
        valid = false
      }
    }, [cwd])
    const showCommitResult = (result: GitCommitResult, id: number | null) => {
      if (id != null && handledCommitId.current === id) return
      if (id != null) handledCommitId.current = id
      if (result.success) {
        setPushReady(true)
        setFeedback({
          id: ++feedbackSequence.current,
          hash: result.hash,
          additions: result.additions,
          deletions: result.deletions,
          subject: String(result.message ?? '')
            .split(/\r?\n/, 1)[0]
            .trim(),
          llm: result.llm ?? null,
          paused: feedbackHovered.current,
          remainingMs: 10000,
          expiresAt: Date.now() + 10000,
        })
      } else setNotice({ key: 'commitFailed', reason: result.error })
    }
    React.useEffect(() => {
      feedbackHovered.current = false
      handledCommitId.current = null
      activeCommitId.current = null
      lastObservedCommitId.current = null
      setWorking(false)
      setPushReady(false)
      setActionWorking(null)
      actionLock.current = null
      if (!cwd) {
        setStatusEntry(null)
        setProblem('')
        return
      }
      let cancelled = false,
        previousToken: number | null | undefined = undefined,
        lastFull = 0,
        reading = false,
        notRepo = false
      const refresh = async () => {
        if (reading) return
        reading = true
        try {
          const status = await rpc('status', { cwd })
          if (!cancelled) {
            notRepo = status.isRepository === false
            setStatusEntry({ cwd, data: status })
            setProblem('')
          }
        } catch (error) {
          if (!cancelled) {
            setStatusEntry(null)
            setProblem(errorMessage(error))
          }
        } finally {
          reading = false
          lastFull = Date.now()
        }
      }
      const tick = async () => {
        if (cancelled) return
        // Without a Git repository no need to launch Git every 900ms.
        // A 30s probe also detects a later `git init` in the same directory.
        if (notRepo) {
          if (Date.now() - lastFull >= 30000) await refresh()
          return
        }
        try {
          const { token, commitState } = await rpc('changeToken', { cwd })
          if (cancelled) return
          if (commitState) {
            if (lastObservedCommitId.current === null)
              lastObservedCommitId.current = commitState.id
            const isNewResult = commitState.id > lastObservedCommitId.current
            if (commitState.working) {
              activeCommitId.current = commitState.id
              setWorking(true)
            } else {
              setWorking(false)
              if (
                commitState.result &&
                (activeCommitId.current === commitState.id || isNewResult)
              ) {
                showCommitResult(commitState.result, commitState.id)
                activeCommitId.current = null
              }
            }
            lastObservedCommitId.current = Math.max(
              lastObservedCommitId.current,
              commitState.id,
            )
          } else setWorking(false)
          if (previousToken !== token || Date.now() - lastFull > 30000) {
            previousToken = token
            await refresh()
          }
        } catch {
          if (Date.now() - lastFull > 5000) await refresh()
        }
      }
      setStatusEntry(null)
      setNotice('')
      setFeedback(null)
      setProblem('')
      void tick()
      const interval = setInterval(() => {
        void tick()
      }, 900)
      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }, [cwd])
    React.useEffect(() => {
      if (!feedback || feedback.paused) return
      // Paused notices have no active dismissal timer. Resuming schedules
      // exactly the remaining time, with cleanup guarding replacement.
      const remaining = Math.max(0, feedback.expiresAt - Date.now())
      if (remaining === 0) {
        setFeedback((current) => (current === feedback ? null : current))
        return
      }
      const timer = setTimeout(
        () => setFeedback((current) => (current === feedback ? null : current)),
        remaining,
      )
      return () => clearTimeout(timer)
    }, [feedback])
    const pauseFeedback = () => {
      feedbackHovered.current = true
      pushFeedback.pause()
      mergeFeedback.pause()
      setFeedback((current) =>
        current && !current.paused
          ? {
              ...current,
              paused: true,
              remainingMs: Math.max(0, current.expiresAt - Date.now()),
            }
          : current,
      )
    }
    const resumeFeedback = () => {
      feedbackHovered.current = false
      pushFeedback.resume()
      mergeFeedback.resume()
      setFeedback((current) =>
        current && current.paused
          ? {
              ...current,
              paused: false,
              expiresAt: Date.now() + current.remainingMs,
            }
          : current,
      )
    }
    const isNonGit = data?.isRepository === false
    const hiddenNonGit =
      isNonGit && (!floatingPreference.ready || floatingPreference.hide)
    // Watch both the pane and the panel: window resizing, folding, or a new
    // commit feedback line may reduce available space or increase card height.
    React.useEffect(() => {
      const root = rootRef.current
      if (
        !root ||
        !sessionId ||
        !cwd ||
        hiddenNonGit ||
        !floatingPosition.loaded
      )
        return
      const check = () => {
        if (drag.current) return
        const checked = inBounds(floatingPosition.value, root)
        if (!samePosition(checked, floatingPosition.value)) {
          floatingPosition.set(checked)
          void persistPosition(checked, cwd, setNotice)
        }
      }
      check()
      const ResizeObserverClass = window.ResizeObserver
      const observer =
        typeof ResizeObserverClass === 'function'
          ? new ResizeObserverClass(check)
          : null
      if (observer) {
        observer.observe(root)
        if (root.offsetParent) observer.observe(root.offsetParent)
      }
      window.addEventListener?.('resize', check)
      return () => {
        observer?.disconnect()
        window.removeEventListener?.('resize', check)
      }
    }, [
      cwd,
      sessionId,
      collapsed,
      hiddenNonGit,
      !!feedback,
      !!pushFeedback.value,
      !!mergeFeedback.value,
      floatingPosition.loaded,
      position.top == null,
    ])
    if (!sessionId || !cwd) return null
    const location = {
      right: position.right,
      ...(position.top == null
        ? { bottom: position.bottom }
        : { top: position.top }),
    }
    // Do not flash a non-Git warning before persisted global visibility is known.
    if (hiddenNonGit) return null
    // The first collapse turns bottom-right placement into top-right placement.
    // Both compact and expanded cards thereafter share exactly the same top/right.
    const pinUpperRight = (event: React.MouseEvent<HTMLElement>) => {
      if (floatingPosition.value.top != null) return
      const root = event.currentTarget.closest<HTMLElement>('.dgc-root')
      if (root && Number.isFinite(root.offsetTop)) {
        const next = inBounds(
          { right: floatingPosition.value.right, top: root.offsetTop },
          root,
        )
        floatingPosition.set(next)
        void persistPosition(next, cwd, setNotice)
      }
    }
    const onDragStart = (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const root = event.currentTarget.closest<HTMLElement>('.dgc-root')
      const top = floatingPosition.value.top ?? root?.offsetTop ?? 0
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        right: floatingPosition.value.right,
        top,
        moved: false,
        root,
      }
      suppressClick.current = false
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {}
    }
    const onDragMove = (event: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.id !== event.pointerId) return
      const dx = event.clientX - d.x,
        dy = event.clientY - d.y
      if (!d.moved && dx * dx + dy * dy < 16) return
      d.moved = true
      floatingPosition.set(
        inBounds({ right: d.right - dx, top: d.top + dy }, d.root),
      )
    }
    const onDragEnd = (event: React.PointerEvent<HTMLElement>) => {
      if (drag.current?.id !== event.pointerId) return
      if (drag.current.moved) {
        suppressClick.current = true
        void persistPosition(floatingPosition.value, cwd, setNotice)
      }
      drag.current = null
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {}
    }
    const onDragCancel = () => {
      if (drag.current?.moved)
        void persistPosition(floatingPosition.value, cwd, setNotice)
      drag.current = null
      suppressClick.current = false
    }
    const dragHandlers = {
      onPointerDown: onDragStart,
      onPointerMove: onDragMove,
      onPointerUp: onDragEnd,
      onPointerCancel: onDragCancel,
    }
    const fold = (event: React.MouseEvent<HTMLElement>) => {
      resumeFeedback()
      pinUpperRight(event)
      setCollapsed(true)
    }
    if (collapsed)
      return h(
        'div',
        { className: 'dgc-root', style: location, ref: rootRef },
        h(
          'div',
          { className: 'dgc-card dgc-card-collapsed' },
          h(
            'button',
            {
              type: 'button',
              className: 'dgc-collapsed-trigger',
              title: t('gitCommit'),
              'aria-label': t('gitCommit'),
              ...dragHandlers,
              onClick: () => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                setCollapsed(false)
              },
            },
            actionIcon('git'),
            isNonGit
              ? h(
                  'span',
                  { className: 'dgc-git-cross', 'aria-hidden': true },
                  actionIcon('cross'),
                )
              : null,
          ),
        ),
      )
    if (isNonGit)
      return h(
        'div',
        { className: 'dgc-root', style: location, ref: rootRef },
        h(
          'div',
          { className: 'dgc-card dgc-card-no-repo', role: 'status' },
          h(
            'div',
            { className: 'dgc-line' },
            h(
              'span',
              {
                className: 'dgc-no-repo',
                title: t('dragWindow'),
                ...dragHandlers,
              },
              t('notRepository'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dgc-fold',
                title: t('collapse'),
                'aria-label': t('collapse'),
                onClick: fold,
              },
              actionIcon('collapse'),
            ),
          ),
        ),
      )
    const hasChanges =
      data &&
      (data.additions ||
        data.deletions ||
        data.untracked ||
        data.binary ||
        data.stagedFiles)
    const onCommit = async () => {
      if (working || actionLock.current || !hasChanges) return
      const epoch = viewEpoch.current
      actionLock.current = 'commit'
      setWorking(true)
      setNotice('')
      setFeedback(null)
      try {
        const result = await rpc('commit', { cwd, sessionId })
        if (viewEpoch.current !== epoch) return
        showCommitResult(result, activeCommitId.current)
        const status = await rpc('status', { cwd })
        if (viewEpoch.current === epoch) setStatusEntry({ cwd, data: status })
      } catch (error) {
        if (viewEpoch.current === epoch)
          setNotice({ key: 'commitFailed', reason: errorMessage(error) })
      } finally {
        if (viewEpoch.current === epoch) {
          setWorking(false)
          actionLock.current = null
        }
      }
    }
    const onFollowUp = async (kind: 'push' | 'mergeAndDelete') => {
      if (working || actionLock.current || data?.isRepository !== true) return
      const epoch = viewEpoch.current
      const targetFeedback = kind === 'push' ? pushFeedback : mergeFeedback
      actionLock.current = kind
      setActionWorking(kind)
      try {
        const result = await rpc(kind, { cwd })
        if (viewEpoch.current !== epoch) return
        targetFeedback.show(result)
        if (kind === 'mergeAndDelete' && result.merged) setPushReady(true)
        // A status refresh failure must not turn a successful Git operation
        // into failure or replace its independent result notification.
        try {
          const status = await rpc('status', { cwd })
          if (viewEpoch.current === epoch) setStatusEntry({ cwd, data: status })
        } catch (error) {
          if (viewEpoch.current === epoch) setProblem(errorMessage(error))
        }
      } catch (error) {
        if (viewEpoch.current === epoch)
          targetFeedback.show({ success: false, error: errorMessage(error) })
      } finally {
        if (viewEpoch.current === epoch) {
          actionLock.current = null
          setActionWorking(null)
        }
      }
    }
    const actionResult = (
      entry: ActionFeedback | null,
      kind: string,
      hasPrevious: boolean,
    ) => {
      if (!entry) return null
      const message = entry.success
        ? kind === 'push'
          ? t(entry.upToDate ? 'pushUpToDate' : 'pushed')
          : t('mergedAndDeleted', entry)
        : t(kind === 'push' ? 'pushFailed' : 'mergeFailed', {
            reason: entry.error,
          })
      return h(
        'div',
        { key: `${kind}-${entry.id}` },
        hasPrevious ? h('hr', { className: 'dgc-feedback-divider' }) : null,
        h(
          'div',
          {
            className: 'dgc-action-feedback',
            role: entry.success ? 'status' : 'alert',
          },
          h(
            'div',
            {
              className: entry.success
                ? `dgc-result-subject${kind === 'mergeAndDelete' ? ' dgc-result-subject-wrap' : ''}`
                : 'dgc-notice dgc-error',
              title: message,
            },
            message,
          ),
          h(
            'div',
            {
              className: 'dgc-countdown-track',
              role: 'progressbar',
              'aria-label': t(
                kind === 'push' ? 'pushCountdown' : 'mergeCountdown',
              ),
              'aria-valuemin': 0,
              'aria-valuemax': 10,
            },
            h('div', {
              className: 'dgc-countdown-fill',
              style: {
                backgroundColor: floatingPreference.countdownColor,
                animationPlayState: entry.paused ? 'paused' : 'running',
              },
            }),
          ),
        ),
      )
    }
    const grip = h(
      'span',
      {
        className: 'dgc-grip',
        title: t('dragWindow'),
        ...dragHandlers,
      },
      '⠿',
    )
    return h(
      'div',
      { className: 'dgc-root', style: location, ref: rootRef },
      h(
        'div',
        {
          className: 'dgc-card',
          onMouseEnter: pauseFeedback,
          onMouseLeave: resumeFeedback,
        },
        h(
          'div',
          { className: 'dgc-line' },
          grip,
          h(
            'span',
            { className: 'dgc-branch', title: data?.branch ?? 'Git…' },
            data?.branch ?? 'Git…',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dgc-fold',
              title: t('collapse'),
              'aria-label': t('collapse'),
              onClick: fold,
            },
            actionIcon('collapse'),
          ),
        ),
        h(
          'div',
          { className: 'dgc-numbers' },
          h('span', { className: 'dgc-add' }, `+${data?.additions ?? 0}`),
          h('span', { className: 'dgc-del' }, `−${data?.deletions ?? 0}`),
        ),
        h(
          'div',
          { className: 'dgc-line dgc-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dgc-button dgc-icon-button dgc-primary',
              disabled: working || !!actionWorking || !hasChanges,
              onClick: onCommit,
              title: working
                ? t('committingTitle')
                : data?.stagedFiles
                  ? t('stagedOnly')
                  : t('stageAll'),
              'aria-label': working
                ? t('committing')
                : data?.stagedFiles
                  ? t('stagedOnly')
                  : t('stageAll'),
            },
            actionIcon(working ? 'loading' : 'commit'),
          ),
          pushReady
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dgc-button dgc-icon-button dgc-secondary',
                  disabled: working || !!actionWorking,
                  title: t(actionWorking === 'push' ? 'pushing' : 'push'),
                  'aria-label': t(
                    actionWorking === 'push' ? 'pushing' : 'push',
                  ),
                  onClick: () => onFollowUp('push'),
                },
                actionIcon(actionWorking === 'push' ? 'loading' : 'push'),
              )
            : null,
          data?.canMergeAndDelete
            ? h(
                'button',
                {
                  type: 'button',
                  className:
                    'dgc-button dgc-icon-button dgc-secondary dgc-merge-delete',
                  disabled: working || !!actionWorking,
                  title: t(
                    actionWorking === 'mergeAndDelete'
                      ? 'merging'
                      : 'mergeAndDelete',
                  ),
                  'aria-label': t(
                    actionWorking === 'mergeAndDelete'
                      ? 'merging'
                      : 'mergeAndDelete',
                  ),
                  onClick: () => onFollowUp('mergeAndDelete'),
                },
                actionWorking === 'mergeAndDelete'
                  ? actionIcon('loading')
                  : h(
                      'span',
                      { style: { display: 'inline-flex', gap: 3 } },
                      actionIcon('merge'),
                      actionIcon('delete'),
                    ),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'dgc-button dgc-icon-button dgc-secondary',
              title: t('commitSettings'),
              'aria-label': t('commitSettings'),
              onClick: () => {
                if (data?.isRepository !== true) return
                try {
                  ctx.sidebarRight.openTab(TAB_KIND)
                } catch (error) {
                  setNotice(errorMessage(error))
                }
              },
            },
            actionIcon('settings'),
          ),
        ),
        problem
          ? h('div', { className: 'dgc-notice dgc-error' }, problem)
          : null,
        notice
          ? h(
              'div',
              {
                className: 'dgc-notice dgc-error',
                role: 'alert',
                style: { whiteSpace: 'pre-wrap' },
              },
              errorText(notice),
            )
          : null,
        feedback
          ? h(
              'div',
              {
                key: feedback.id,
                className: 'dgc-feedback',
                role: 'status',
                'aria-label': t('completed'),
              },
              h(
                'div',
                {
                  className: 'dgc-result-head',
                  title: `${t('committed', { hash: feedback.hash })} · +${feedback.additions} −${feedback.deletions}`,
                },
                `${t('committed', { hash: feedback.hash })} · `,
                h('span', { className: 'dgc-add' }, `+${feedback.additions}`),
                ' ',
                h('span', { className: 'dgc-del' }, `−${feedback.deletions}`),
              ),
              h(
                'div',
                { className: 'dgc-result-subject', title: feedback.subject },
                feedback.subject,
              ),
              floatingPreference.showTokenDetails
                ? h(
                    'div',
                    {
                      className: 'dgc-result-metrics',
                      title: tokenLine(feedback.llm),
                    },
                    tokenLine(feedback.llm),
                  )
                : null,
              h(
                'div',
                {
                  className: 'dgc-countdown-track',
                  role: 'progressbar',
                  'aria-label': t('countdown'),
                  'aria-valuemin': 0,
                  'aria-valuemax': 10,
                },
                h('div', {
                  className: 'dgc-countdown-fill',
                  style: {
                    backgroundColor: floatingPreference.countdownColor,
                    // Keep the same CSS animation timeline across repeated hover
                    // transitions. Rewriting negative animationDelay while the
                    // animation runs can jump it to its already-finished frame.
                    animationPlayState: feedback.paused ? 'paused' : 'running',
                  },
                }),
              ),
            )
          : null,
        actionResult(pushFeedback.value, 'push', !!feedback),
        actionResult(
          mergeFeedback.value,
          'mergeAndDelete',
          !!feedback || !!pushFeedback.value,
        ),
      ),
    )
  }

  function CommitSettings() {
    React.useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot)
    const cwd = React.useSyncExternalStore(
      workspace.subscribe,
      workspace.getSnapshot,
      workspace.getSnapshot,
    )
    const [form, setForm] = React.useState<GitCommitSettings | null>(null)
    const [activeTab, setActiveTab] = React.useState('repository')
    const [models, setModels] = React.useState<Catalog['models']>([])
    const [defaultModel, setDefaultModel] =
      React.useState<ModelSelection | null>(null)
    const [loadError, setLoadError] = React.useState('')
    const [saveError, setSaveError] = React.useState<TextError>('')
    const saverRef = React.useRef<ReturnType<typeof createAutoSaver> | null>(
      null,
    )
    React.useEffect(() => {
      let active = true
      setForm(null)
      setLoadError('')
      setSaveError('')
      // Global settings remain readable even when cwd is outside a repository.
      void rpc('settings', { cwd }).then(
        (value) => {
          if (active) {
            setForm(value)
            visibility.set(value)
            floatingPosition.hydrate(value.floatingPosition)
          }
        },
        (error) => {
          if (active) setLoadError(errorMessage(error))
        },
      )
      void rpc('models').then(
        (catalog) => {
          if (!active) return
          setModels(catalog.models ?? [])
          setDefaultModel(catalog.defaultModel ?? null)
        },
        (error) => {
          if (active) setLoadError(errorMessage(error))
        },
      )
      return () => {
        active = false
      }
    }, [cwd])
    React.useEffect(() => {
      // A repository-less workspace still permits editing global preferences.
      if (form?.isRepository === false) setActiveTab('global')
    }, [form?.isRepository])
    React.useEffect(() => {
      let active = true
      const saver = createAutoSaver(
        (patch) => rpc('saveSettings', { cwd, patch }),
        (error) => {
          if (active) setSaveError(error)
        },
      )
      saverRef.current = saver
      return () => {
        active = false
        if (saverRef.current === saver) saverRef.current = null
        saver.close() // Flush the last unsubmitted keystrokes on closing the sidebar.
      }
    }, [cwd])
    const update = (
      key: keyof GitCommitSettings,
      value: unknown,
      immediate = false,
    ) => {
      if (
        key === 'autoHideNonGit' ||
        key === 'showTokenDetails' ||
        key === 'countdownColor'
      ) {
        visibility.set({ [key]: value })
      }
      setForm((current) => ({ ...current!, [key]: value }))
      setSaveError('')
      saverRef.current?.update(key, value, immediate)
    }
    const repository = form?.isRepository === true
    const selectedModelKey = (selection: ModelSelection | null) =>
      selection ? `${selection.provider}\t${selection.model}` : ''
    const modelChoices = (selected: ModelSelection | null) => {
      const entries = models.map((entry) =>
        h(
          'option',
          {
            key: `${entry.provider}/${entry.model}`,
            value: `${entry.provider}\t${entry.model}`,
          },
          `${entry.providerName} / ${entry.name}`,
        ),
      )
      if (
        selected &&
        !models.some(
          (entry) =>
            entry.provider === selected.provider &&
            entry.model === selected.model,
        )
      ) {
        entries.unshift(
          h(
            'option',
            { key: 'selected-unknown', value: selectedModelKey(selected) },
            `${selected.provider} / ${selected.model}`,
          ),
        )
      }
      return entries
    }
    // Always display the model currently inherited, even if the global selector
    // is set to DSH default (which can itself change independently).
    const effectiveGlobalModel =
      form?.model ?? defaultModel ?? models[0] ?? null
    const inheritedModelName = effectiveGlobalModel
      ? (() => {
          const entry = models.find(
            (item) =>
              item.provider === effectiveGlobalModel.provider &&
              item.model === effectiveGlobalModel.model,
          )
          return entry
            ? `${entry.providerName} / ${entry.name}`
            : `${effectiveGlobalModel.provider} / ${effectiveGlobalModel.model}`
        })()
      : t('notConfigured')
    const tabs = h(
      'div',
      {
        className: 'dgc-tabs',
        role: 'tablist',
        'aria-label': t('settingsScope'),
      },
      ...['repository', 'global'].map((tab) =>
        h(
          'button',
          {
            type: 'button',
            key: tab,
            role: 'tab',
            id: `dgc-tab-${tab}`,
            'aria-label': tab === 'repository' ? t('repository') : t('global'),
            'aria-selected': activeTab === tab,
            'aria-controls': `dgc-panel-${tab}`,
            tabIndex: activeTab === tab ? 0 : -1,
            className: 'dgc-tab',
            onClick: () => setActiveTab(tab),
            onKeyDown: (event) => {
              const next =
                event.key === 'ArrowLeft'
                  ? 'repository'
                  : event.key === 'ArrowRight'
                    ? 'global'
                    : event.key === 'Home'
                      ? 'repository'
                      : event.key === 'End'
                        ? 'global'
                        : null
              if (next) {
                event.preventDefault()
                setActiveTab(next)
                event.currentTarget.parentElement
                  ?.querySelector<HTMLElement>(`#dgc-tab-${next}`)
                  ?.focus?.()
              }
            },
          },
          tab === 'repository' ? t('repository') : t('global'),
        ),
      ),
    )
    const modelSelect = (
      key: string,
      value: string,
      onChange: React.ChangeEventHandler<HTMLSelectElement>,
      firstLabel: string,
      firstValue: string,
    ) =>
      h(
        'label',
        {
          className: 'dgc-field',
          key,
        },
        t('model'),
        h(
          'select',
          {
            'aria-label':
              activeTab === 'repository'
                ? t('repositoryModel')
                : t('globalModel'),
            value,
            onChange,
          },
          h('option', { value: firstValue }, firstLabel),
          ...modelChoices(
            activeTab === 'repository' ? form!.repositoryModel : form!.model,
          ),
        ),
      )
    const content = !form
      ? null
      : activeTab === 'repository'
        ? repository
          ? [
              modelSelect(
                'repository-model',
                form.repositoryModel
                  ? selectedModelKey(form.repositoryModel)
                  : 'inherit-global',
                (e) => {
                  const choice = e.target.value
                  const selected = models.find(
                    (entry) => selectedModelKey(entry) === choice,
                  )
                  update(
                    'repositoryModel',
                    choice === 'inherit-global'
                      ? null
                      : selected
                        ? { provider: selected.provider, model: selected.model }
                        : form.repositoryModel,
                    true,
                  )
                },
                t('inheritGlobal', { model: inheritedModelName }),
                'inherit-global',
              ),
              h('hr', {
                key: 'repository-divider',
                className: 'dgc-settings-divider',
              }),
              h(
                'label',
                { className: 'dgc-check', key: 'inherit' },
                h('input', {
                  type: 'checkbox',
                  checked: form.inheritGlobal,
                  onChange: (e) =>
                    update('inheritGlobal', e.target.checked, true),
                }),
                t('inheritInstruction'),
              ),
              h(
                'label',
                { className: 'dgc-field', key: 'repo' },
                t('repositoryInstruction'),
                h('textarea', {
                  value: form.repositoryInstruction,
                  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    update('repositoryInstruction', e.target.value),
                  onBlur: () => {
                    void saverRef.current?.flush()
                  },
                  placeholder: t('repositoryPlaceholder'),
                }),
              ),
              h('code', { className: 'dgc-repo-path', key: 'path' }, form.root),
            ]
          : h(
              'div',
              { className: 'dgc-subtle', key: 'no-repo' },
              t('notRepository'),
            )
        : [
            modelSelect(
              'global-model',
              selectedModelKey(form.model),
              (e) => {
                const choice = e.target.value
                const selected = models.find(
                  (entry) => selectedModelKey(entry) === choice,
                )
                update(
                  'model',
                  !choice
                    ? null
                    : selected
                      ? { provider: selected.provider, model: selected.model }
                      : form.model,
                  true,
                )
              },
              defaultModel
                ? t('dshDefaultNamed', {
                    model: `${defaultModel.provider}/${defaultModel.model}`,
                  })
                : t('dshDefault'),
              '',
            ),
            h('hr', {
              key: 'global-divider',
              className: 'dgc-settings-divider',
            }),
            h(
              'label',
              { className: 'dgc-field', key: 'global' },
              t('globalInstruction'),
              h('textarea', {
                value: form.globalInstruction,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  update('globalInstruction', e.target.value),
                onBlur: () => {
                  void saverRef.current?.flush()
                },
                placeholder: t('globalPlaceholder'),
              }),
            ),
            h(
              'label',
              { className: 'dgc-check', key: 'autoHideNonGit' },
              h('input', {
                type: 'checkbox',
                checked: form.autoHideNonGit === true,
                onChange: (e) =>
                  update('autoHideNonGit', e.target.checked, true),
              }),
              t('autoHide'),
            ),
            h(
              'label',
              { className: 'dgc-check', key: 'showTokenDetails' },
              h('input', {
                type: 'checkbox',
                checked: form.showTokenDetails === true,
                onChange: (e) =>
                  update('showTokenDetails', e.target.checked, true),
              }),
              t('showTokens'),
            ),
            h(
              'label',
              { className: 'dgc-countdown-color', key: 'countdownColor' },
              h('span', null, t('countdownColor')),
              h('input', {
                type: 'color',
                value: colorOrDefault(form.countdownColor),
                'aria-label': t('countdownColor'),
                title: t('countdownColor'),
                onChange: (e) => update('countdownColor', e.target.value, true),
              }),
            ),
          ]
    return h(
      'div',
      { className: 'dgc-settings' },
      h('h3', null, t('settingsTitle')),
      tabs,
      !form
        ? h('div', { className: 'dgc-subtle' }, loadError || t('loading'))
        : h(
            'div',
            {
              className: 'dgc-tab-panel',
              role: 'tabpanel',
              id: `dgc-panel-${activeTab}`,
              'aria-labelledby': `dgc-tab-${activeTab}`,
            },
            content,
          ),
      saveError
        ? h(
            'div',
            { className: 'dgc-notice dgc-save-error', role: 'alert' },
            errorText(saveError),
          )
        : null,
      form && loadError
        ? h(
            'div',
            { className: 'dgc-notice dgc-error', role: 'alert' },
            loadError,
          )
        : null,
    )
  }

  // This slot belongs to DSH's Plugins -> bundle detail page, not the
  // session's right sidebar. The key MUST equal package.json.name.
  function CommitBundleConfig(props: { view?: string }) {
    React.useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot)
    const [error, setError] = React.useState<TextError | null>(null)
    if (props?.view === 'summary') return null
    return h(
      'div',
      { className: 'dgc-plugin-config' },
      h(
        'button',
        {
          type: 'button',
          className: 'dgc-reset-position',
          'aria-label': t('resetPosition'),
          title: t('resetPosition'),
          onClick: () => {
            floatingPosition.set(DEFAULT_POSITION)
            setError(null)
            void persistPosition(DEFAULT_POSITION, undefined, setError)
          },
        },
        t('resetPosition'),
      ),
      error
        ? h(
            'div',
            { className: 'dgc-notice dgc-save-error', role: 'alert' },
            errorText(error),
          )
        : null,
    )
  }

  ctx.effect(
    () =>
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: '@ibobbyts/dsh-git-commit',
            label: () => t('gitCommit'),
            inject: () => ({}),
          },
          CommitBundleConfig,
        ),
      ),
    'dsh-git-commit: plugin page',
  )
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        title: () => t('settingsTitle'),
        priority: 'extension',
      }),
    'dsh-git-commit: settings tab',
  )
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register(
          { name: 'sidebar.right.pane.tab', key: TAB_ID },
          CommitSettings,
        ),
      ),
    'dsh-git-commit: settings body',
  )
  ctx.effect(
    () =>
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-git-commit',
            order: 45,
            label: t('gitCommit'),
          },
          CommitPill,
        ),
      ),
    'dsh-git-commit: floating pill',
  )
}
export const inject = [
  'slots',
  'connection',
  'locale',
  'sidebarRight',
  'sidebarRightTabs',
]
export { apply }
