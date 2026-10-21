# dsh-git-commit

An independent **DeepSeek Harness (DSH)** plugin providing a three-row floating Git status panel, one-click AI-generated commits, repository-specific writing instructions, a native right-sidebar settings tab, and a reusable **Host service** for other plugins.

> **Validation status:** Git mutation and service logic are tested with real temporary Git repositories. A browser-loader/component smoke test checks that the floating panel renders for the mounted Session, and the manifest dependencies are checked against DSH’s published client packages. **An installed Desktop end-to-end run and a live model call still require user-side verification**.

## UI

The floating panel uses the DSH `shell.overlay` slot and appears above the conversation, with a drag handle:

```text
┌──────────────────────┐
│ ⠿ feature/my-work  ⌄ │
│ +248      −73         │
│ [ ◉ ] [ ⚙ ]          │
└──────────────────────┘

Collapsed Git:         [ Git icon ]
Collapsed non-Git:     [ Git icon + red × ]
Expanded non-Git:      [ Not a git repository  ⌄ ]
```

* **Row 1:** current branch name (its hover tooltip shows the **complete branch name**, not the repository path), drag grip, and upper-right collapse button. The visible Session is tracked through the public `ctx.sidebarRight.mounted` observable.
* **Row 2:** added/deleted lines relative to HEAD. Tracks staged and unstaged tracked files, plus readable untracked text files. Untracked binary files and files over 4 MiB are excluded from numeric line counts; they remain eligible for commit.
* **Row 3:** two **36 × 36 px**, left-aligned icon buttons: Git Commit and Settings. Commit runs immediately, displaying the outcome beneath the rows, and is disabled if nothing is detected to commit.
* **Sizing:** the expanded card grows as needed for the two actions, added/deleted counts and branch (ellipsis for long branch names) but never exceeds the original **216 px** maximum. Minimum size accommodates the larger of the action row and statistics row, plus padding. The compact card remains **44 × 44 px**.
* **Collapse and drag:** collapse keeps the **upper-right corner** fixed rather than the lower-right corner. The collapsed Git icon can be dragged with a pointer; moving it does **not** also click to expand. A normal click expands it. The tooltip on the compact icon is **Git commit**.
* **Non-Git workspaces:** show a neutral **Not a git repository** row with a collapse control; the compact Git icon gets a **red ×**. Neither state offers Commit or Settings. The text area in the expanded non-Git row can be dragged. An already-open Settings tab remains usable for global controls.
* `Settings` opens the native DSH **right sidebar** through `ctx.sidebarRight.openTab('gitCommitSettings')` — not a custom web modal.
* **Success notification (10 seconds):** appears beneath the action row, then disappears automatically. It shows **exactly two commit lines**: `Committed <hash> · +<additions> −<deletions>` in a compact **monospaced** font, followed by **only the first line of the Commit Message** in the normal UI font. A thin countdown bar shrinks from full to empty over ten seconds; its default color is orange (`#f59e0b`). A new commit restarts both the timer and bar. Failed commits retain an actionable error rather than falsely showing a completed notification.
* **Optional Token details:** when enabled, the third line beneath the commit subject is monospaced: `↓ <total input> · ↑ <output> | <TTFT>s · <decode speed>t/s`. Unavailable provider statistics use `—` rather than an invented zero. If another plugin supplies the message without invoking an LLM, Token details correctly report unavailable values.

Git status updates are event-driven on the Host (`fs.watch` for worktree and Git metadata, with 160 ms debounce and a one-second starvation cap). The browser polls only a *cheap numeric change token* every 900 ms and runs the Git status command only when the token changes. A 30-second full-refresh fallback accounts for lost OS events. External editors, shell commands, Agent Edit/Write tools and other processes are observed when they modify the same local filesystem.

## Commit behavior

**One click means one commit, not just a generated draft:**

* **If any files are staged**, snapshot and commit **only the existing Git Index**. Unstaged modifications to those files remain unstaged afterward.
* **If nothing is staged**, prepare an index snapshot of **all** tracked modifications and untracked (non-ignored) files using a temporary `GIT_INDEX_FILE`. The real Index stays untouched while the LLM generates the message. Immediately before commit, verify the HEAD/index/worktree snapshot, then `git add -A` and commit.
* File modifications or branch changes detected while the model is running result in an explicit failure, rather than silently committing content the model never saw. Operations on one repository serialize to avoid simultaneous plugin commits.
* Git hooks are **not bypassed**. A rejected hook returns a failure, and the original staged content may remain. If staging succeeded but the subsequent `git commit` fails in "all" mode, that staging is preserved rather than destructively rolled back.
* The result reports **actual committed** inserted/deleted lines, the committed message, and the first **seven hexadecimal characters** of the commit SHA (plus optional full SHA).

An aborted/failed Git command never reports success. The plugin does not push, fetch, amend, force-update references, or stage files outside the selected repository.

## Settings

`Settings` opens the DSH native right sidebar, ordered exactly as follows:

1. **Git commit settings** heading
2. **Global commit instruction** (textarea)
3. **Model** (configured DSH provider/model selection)
4. Divider
5. **Inherit global instruction** (per-repository checkbox, default checked)
6. **Repository commit instruction** (textarea)
7. Canonical Git repository path, shown as code beneath the textarea
8. Divider
9. **Automatically hide floating window in non-git projects** (global checkbox; default **unchecked**)
10. **Show token details** (global checkbox; default **unchecked**)
11. **Countdown color** (global `#RRGGBB` color picker; default **orange `#f59e0b`**)

In a non-Git directory (or if the panel remains open after switching from a
repository), the global instruction, model and automatic-hide checkbox remain
available. The repository section displays **Not a git repository** rather than
repository-specific fields; the floating panel does not permit opening Settings
from a non-Git directory. When the global checkbox is on, the floating window
is completely hidden in non-Git projects, including the crossed compact icon,
and reappears in Git projects. When it is off, non-Git projects can display and
collapse the neutral warning. The preference is shared across all repositories
and persists across Desktop restarts; the Client also updates immediately when
it is changed in the Settings tab.

**Automatic persistence:** there is no Save button and no Saved message.
Text edits are debounced for 400 ms and flushed when the textarea loses focus
or the sidebar unmounts; checkbox, model and countdown-color changes are saved immediately.
Each request saves *only changed fields*, and requests are serialized to avoid
an older response overwriting newer edits. Failures retain pending changes
for a later edit/retry and display an error. Successful saves remain silent.
Global settings persist even if there is no Git repository; a non-Git scope
never creates fake repository entries. With inheritance checked, both global
and repository instructions reach the model, and repository-specific instructions
take precedence in conflicts.

The selected LLM provider/model comes from `ctx.llm.listProviders()` / `listModels()` and is invoked directly via `ctx.llm.stream()`; it does **not** create another agent, require separate API keys, or edit the main Agent's chosen model.

Reasoning effort is deliberately **not** a UI setting: `ctx.llm.resolveModelInfo()` supplies adapter-owned ordered effort IDs. The optional large-file **classification** request uses the lowest available *non-Off* effort, falling back to Off only if it is the sole supported level. The final **commit-message generation** request prefers Off and falls back to the lowest supported effort. If no reasoning metadata is exposed, the provider default applies.

Global Token display and countdown color also persist alongside existing instructions; old v1 files missing these keys use the documented defaults without migration. Color inputs are validated as six-digit hexadecimal CSS colors.

Settings are stored atomically in `$DSH_HOME/dsh-git-commit.json` (or `~/.dsh/dsh-git-commit.json` without `DSH_HOME`), mode `0600` for newly written files; no configuration files are created inside the repository. Repository entries are keyed by the resolved Git root path.

## Large diff and LLM context

The generator uses a prepared, immutable Git index snapshot for both LLM context
and the eventual commit. **Neither the file-selection decision nor secret masking
changes the actual staged content.** The model receives the complete changed-file
inventory with per-file +/- counts, the commit scope, the aggregate line totals,
and up to five recent commit subjects *for writing style only*. It never receives
an entire Agent conversation.

* **No single file exceeds 2,000 changed lines** (added + deleted lines from Git patch hunks):
  send **one** DSH LLM request with all file patches and generate the commit message.
  The limit is per file, **not** a maximum on the whole Diff or the source-file length.
* **At least one file exceeds 2,000 changed lines:** send **one** preliminary
  classification request containing the paths and change statistics of **every**
  changed file, plus **the first 200 Git patch lines** for each over-threshold file.
  The preliminary request does not receive the contents of smaller files. It must
  return JSON decisions identifying which large files require a complete patch.
  Unknown, malformed, missing, or conflicting decisions default to **full read**.
* **Generate with one final request:** include full patches for all smaller files
  and large files marked full-read. For large files marked preview-only, retain
  the first 200 patch lines plus a conspicuous `TRUNCATED GIT PATCH PREVIEW`
  annotation stating that the rest was **not inspected**. All paths remain in the
  inventory even when a patch is shortened; no file is silently omitted.
* **At most two model calls**, both through the configured DSH provider/model.
  Classification uses the lowest non-Off reasoning effort when available;
  generation uses Off when available, otherwise the lowest supported effort.
  The previous 18,000-character Map-Reduce loop and 24-map-call limit are gone.
* **Hard safety limits:** source snapshots whose 64 MiB Git capture limit was
  exceeded cannot produce a trustworthy full-file inventory and are rejected
  before requesting a message. Prepared prompts above the local single-call
  character safety budget also fail clearly: the plugin does not send an
  unannounced partial patch or silently start additional LLM retries. The
  provider's actual tokenizer and model context window remain authoritative.
* **Redaction:** `@visulima/redact` 5.0.0's free-text `stringAnonymize` API with
  `credentialRules` and a small extra rule for credential assignments masks
  known secret patterns in **both** LLM requests (including paths and global
  instructions). It deliberately does not use the aggressive PII/date rules.
  This is best-effort, **not a guarantee against credential disclosure**; avoid
  committing secrets and use trusted model providers.

The caller-supplied commit-message path skips all model calls. Normal generated
commits record token metrics for one or two calls, preserving the existing
cross-plugin API. This is a lightweight Commit Message generator, not a
code-review agent, and it never runs model-suggested commands.

## Install into DSH

### Desktop (macOS / Windows)

Use **Plugins → Add plugin → Install a third-party plugin** in Desktop, enter
`https://github.com/iBobbyTS/dsh-git-commit.git`, and select **Enable now**.
If upgrading from a previously failed installation, use the Plugins page to
**Remove** the old copy first, then install the latest GitHub revision and enable it.
Fully **Quit** DSH and reopen it (closing the window alone can leave its Host running).

Alternatively, on macOS use **Manage dsh Command… → Install** to make Desktop's
bundled CLI available. Open Desktop once to initialize its profile, quit it,
and run:

```sh
dsh plugin --profile desktop remove dsh-git-commit   # only for an older installation
dsh plugin --profile desktop add https://github.com/iBobbyTS/dsh-git-commit.git
```

The Desktop CLI is distinct from a separately installed npm `dsh` binary.
Do not use `--profile web` when you want to install into Desktop.

### Web profile or development checkout

```sh
dsh plugin --profile web add /absolute/path/to/dsh-git-commit
```

If a CLI installation is not automatically enabled, select the bundle in the
Plugins UI or add `dsh-git-commit` to the existing `dsh.profile.bundles` list
without removing built-in bundles. The bundle applies [cordis.patch.yml](cordis.patch.yml),
registering the Host plugin and loading `./client` through the Web client module
loader. Restart the affected DSH Host/profile.

### Fix for missing overlay after upgrading to 0.1.5

Version 0.1.5 introduced a startup-only null dereference in the Client's
Session-scoped status cache: before any Session was selected, both the current
`cwd` and the optional-chained `statusEntry?.cwd` were `undefined`, so equality
succeeded and the code accessed `statusEntry.data` while it was `null`.
That could crash and retire the root overlay before opening any project, making
all Git and non-Git projects appear to have no floating panel.
Version **0.1.6** checks the cache record for non-null *before* comparing paths.
Its regression test starts with no Session, enters a Git project, and leaves the
Session again without recreating the plugin.

### Diagnosing a missing floating panel

The floating panel renders only when **a Conversation Session is actually visible**;
Plugin Manager and other global pages hide it. In Desktop press **Command+Option+I**
(or F12 / Fn+F12) to open DevTools and inspect:

```js
window.__DSH_BOOT__?.entries?.find(row => row.id === 'dsh-git-commit')
document.querySelector('style[data-dsh-git-commit="true"]')
document.querySelector('[data-shell-overlay] .dgc-root')
```

- Missing manifest entry: check that the installed bundle is enabled in the **Desktop** profile.
- Manifest entry, but no `style` element: the Client module did not activate (check Console).
- Style exists, but no `.dgc-root`: confirm that a Conversation Session is on screen;
  a component crash, missing Session identity, or the enabled non-Git auto-hide setting can also explain the absence.
- `.dgc-root` exists, but cannot be seen: inspect CSS/layout in the Elements panel.

The Host injects only `connection` and `llm`. The authenticated `/api`
transport is owned by DSH Connection, and the plugin registers an exact route
through `connection.fetch.register()`. It does not require or access the
`webServer` service directly.

The plugin targets Node.js **22.22.1+** and uses the direct `@visulima/redact@5.0.0` dependency for model-bound text masking. It uses the DSH Host's existing `connection`, `llm`, `slots`, and `sidebarRight` services; the right-side UI requires the standard DSH Web/Desktop shell.

> **Security:** UI requests use **`ctx.connection.fetch.register({ path: '/api/git-commit', ... })`**, reusing the authenticated DSH `/api` carrier and its Owner/Host/Origin checks. The browser uses the standard `ctx.connection.rpc.call('/api', 'git-commit', ...)` request envelope. Importantly, this avoids `ctx.connection.rpc.handle()` creating a new channel, which reads `webServer` from the Connection service's *own* injection scope and caused plugin activation to fail. A bare `ctx.webServer.register()` would bypass authentication and is not used.

### Updating an existing Desktop installation

Use Plugins → **Uninstall** (not only the enable toggle) and install the Git URL again.
DSH's package manager can retain the previous Git checkout when it already
matches the installed spec; explicitly remove the installed package first.
Enable the new bundle and fully quit/reopen Desktop. Verify version **0.1.9**.

Earlier versions had two separate startup/UI issues: v0.1.1 registered RPC
through the Connection provider's shadow context and incorrectly accessed
`webServer` (v0.1.2 fixed this); v0.1.2 also used the nonexistent
`SessionListState.current` selector, hiding its floating panel (fixed in v0.1.3).
The Client bundle now declares dependencies on real DSH packages providing
Connection, rendering, layout, Session data, and the right Sidebar instead of
the obsolete `@deepseek-ai/dsh-client-runtime` package.

## Calling the commit API from another DSH Host plugin

This plugin publishes a native Cordis service named `gitCommit`, not a model-visible tool. Consumers must inject it and may call the same commit path that the floating panel uses:

```ts
import type {} from 'dsh-git-commit';

export const inject = ['gitCommit'];

export async function run(ctx: import('@deepseek-ai/cordis').Context, cwd: string) {
  const result = await ctx.gitCommit.commit({ cwd });
  if (!result.success) throw new Error(result.error ?? 'Commit failed');
  return result;
}
```

Result example (the values are illustrative):

```json
{
  "success": true,
  "status": "success",
  "scope": "staged",
  "additions": 248,
  "deletions": 73,
  "message": "feat(api): validate session refresh tokens",
  "hash": "ac1234e",
  "fullHash": "ac1234e...",
  "llm": {
    "calls": 3,
    "inputTokens": 12450,
    "outputTokens": 680,
    "cacheReadTokens": 8000,
    "cacheWriteTokens": 100,
    "latencyMs": 710,
    "durationMs": 4200,
    "outputSpeedTps": 91.2
  },
  "totalDurationMs": 5400
}
```

**LLM statistics:** a direct `ctx.llm.stream()` emits a provider-reported `usage` chunk (some routes omit counters) and model text/reasoning deltas. The plugin uses `BlockAssembler.usage` plus local monotonic timestamps; no separate model request is needed. Total input = uncached `inputTokens` + `cacheReadTokens` + `cacheWriteTokens`. Reasoning output is **already included** in output tokens. For a large Diff, the plugin sums Token usage over its classification and generation calls. Latency is the wall-clock delay from the first model request to the **earliest content token**; output speed is total emitted completion tokens divided by the sum of each call's decoding time, which avoids overstating throughput if the adapter streams overlap. `llm.durationMs` measures LLM phase wall time; `totalDurationMs` includes Git preparation and committing. Usage remains `null` if any contributing request lacks an authoritative provider usage event. The `llm` field is omitted entirely when a caller supplies the message and no model is invoked.

A failure returns `{ success:false, status:'failure', scope, additions:0, deletions:0, message:'', hash:null, error:'...' }` and **never invents a commit hash**. `commit({cwd, message:'...'})` is supported when another plugin already has a prepared commit message; it still follows the exact same staged/all semantics and snapshot safeguards. `status({cwd})`, `changeToken({cwd})`, `settings({cwd})`, `saveSettings({cwd,patch})` and `models()` are also available. See [`lib/index.d.ts`](lib/index.d.ts).

The Client uses the existing authenticated `/api` Connection RPC transport with endpoint `git-commit` (payload method: `status`, `changeToken`, `settings`, `saveSettings`, `models`, `commit`). Because the client passes the active workspace `cwd` and the Host resolves the canonical repository root, multiple Sessions and Git worktrees can be supported without assuming all Sessions use the same checkout.

## Tests

```sh
npm test
npm run check
```

Tests use temporary *real Git repositories* for staged-only vs all-files commits, untracked files, worktree changes during generation, accurate return values, settings persistence, reasoning metadata, and two-call large-file Diff selection. The Client test executes the published `window.__ModuleLoader__` factory with simulated browser and React hooks. It verifies Git/non-Git floating panels, collapse/expand control, icon-only buttons, setting ordering and persistence, the two-line success confirmation, three requested font treatments, ten-second auto-dismiss, live countdown color changes, optional Token details, field-level saves/failures, and supported-client-package manifest. Host tests cover TokenUsage aggregation across concurrent model requests and retaining the existing cross-plugin return contract. A real temporary non-Git directory test checks global-only persistence and recognition of a later `git init`. No provider key is required. An actual Desktop host/browser integration test and a live LLM call are still needed.

## Reference implementations and licensing

This project is independently implemented on DSH's public APIs. Reference projects and the specific ideas reused:

| Reference | License | Used for |
|---|---|---|
| [luigiinred/dsh-git-status-pill](https://github.com/luigiinred/dsh-git-status-pill) | MIT | Floating `shell.overlay` surface and session-aware branch/line-status UX |
| [dennisrongo/dsh-plugins: dsh-git](https://github.com/dennisrongo/dsh-plugins/tree/main/plugins/dsh-git) | MIT | DSH native LLM service calls, staged-diff commit model, watcher/token concept |
| [visulima/redact](https://github.com/visulima/visulima/tree/main/packages/data-manipulation/redact) | MIT | **Direct installed npm dependency** for credential-pattern masking in LLM-bound Diff text |
| [MantisWare/commit-ai](https://github.com/MantisWare/commit-ai) | MIT | Historical design reference for large-file Diff summarization |
| [SunParis/GitCommitGenerator](https://github.com/SunParis/GitCommitGenerator) | MIT | Design reference for eliminating unhelpful generated/binary diff bodies |
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | See upstream | Canonical Cordis services, Connection RPC, LLM metadata, right sidebar and client slots |

Implementation code here is new rather than a wholesale fork of any referenced repository. The package's own code is MIT-licensed. The direct `@visulima/redact` dependency retains its upstream MIT license and copyright; third-party notices and upstream references are recorded in [THIRD_PARTY.md](THIRD_PARTY.md). No AGPL implementation code or font assets are included.
