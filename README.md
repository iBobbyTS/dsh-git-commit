# dsh-git-commit

An independent **DeepSeek Harness (DSH)** plugin providing a three-row floating Git status panel, one-click AI-generated commits, repository-specific writing instructions, a native right-sidebar settings tab, and a reusable **Host service** for other plugins.

> **Validation status:** Git mutation and service logic are tested against real temporary Git repositories. The browser module and DSH profile manifest have been statically checked, but **full Web/Desktop DSH startup and live model calls have not been tested in an installed DSH profile**. The implementation intentionally does not claim end-to-end compatibility without that validation.

## UI

The floating panel uses the DSH `shell.overlay` slot and appears above the conversation, with a drag handle:

```
┌─────────────────────┐
│ ⠿  feature/my-work   │
│ +248        −73      │
│ [ Commit ] [Settings]│
└─────────────────────┘
```

* **Row 1:** branch name for the current Session's working tree (with detached-HEAD support).
* **Row 2:** added/deleted lines relative to HEAD. Tracks staged and unstaged tracked files, plus readable untracked text files. Untracked binary files and files over 4 MiB are excluded from numeric line counts; they remain eligible for commit.
* **Row 3:** `Commit` and `Settings` buttons. Commit runs immediately, displaying an outcome beneath the three rows. The button is disabled if nothing is detected to commit.
* `Settings` opens the native DSH **right sidebar** through `ctx.sidebarRight.openTab('gitCommitSettings')` — not a custom web modal.

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

`Settings` opens the **right sidebar** with the following controls:

| Field | Scope | Default |
|---|---|---|
| Global commit instruction | All repositories | Empty |
| Inherit global instruction | Per repository | **Checked** |
| Repository commit instruction | Current canonical repository | Empty |
| Model | Global; from DSH configured models | DSH's current default model |

Click **Save settings** to persist changes. Both instructions are sent to the model when inheritance is checked, with repository instructions taking precedence in conflicts. When unchecked, **only** the repository instruction is sent. The plugin provides its own fixed accuracy/safety instructions in both cases.

The selected LLM provider/model comes from `ctx.llm.listProviders()` / `listModels()` and is invoked directly via `ctx.llm.stream()`; it does **not** create another agent, require separate API keys, or edit the main Agent's chosen model.

Reasoning effort is deliberately **not** a UI setting: `ctx.llm.resolveModelInfo()` returns adapter-owned ordered effort IDs, from which the plugin selects `off`/`none` if advertised, otherwise the lowest available level. If no reasoning metadata is exposed, the provider default is used.

Settings are stored atomically in `$DSH_HOME/dsh-git-commit.json` (or `~/.dsh/dsh-git-commit.json` without `DSH_HOME`), mode `0600` for newly written files; no configuration files are created inside the repository. Repository entries are keyed by the resolved Git root path.

## Large diff and LLM context

The commit generator supplies an inventory of **all changed files**, added/deleted line totals, recent commit subjects *for style only*, and the staged patch. It never sends the entire Agent conversation or tool history. The patch is treated as untrusted data. Secrets are redacted best-effort using the existing `@mcarvin/smart-diff` helper (not guaranteed exhaustive; use trusted providers and avoid staging credentials).

* **Small changes (up to 18,000 characters of patch):** one call to DSH LLM. Configured global/repository instructions govern subject and body formatting.
* **Large changes:** reuses `@mcarvin/smart-diff`'s exported `splitUnifiedDiffIntoFileChunks` and `groupDiffChunksByBudget`. Large single-file patches are further divided into bounded line sections. Map calls extract verifiable change facts (concurrency 2), then one reduce call combines them with the complete file inventory into **one commit message**.
* **Pathological inputs:** the number of semantic map calls is bounded at 24; when this cap is reached, the final message receives a warning that only the covered chunks were semantically inspected. It does not falsely claim whole-patch inspection. A 64 MiB raw Git diff overflow uses bounded per-file samples rather than an arbitrary prefix of the whole patch.
* Other Git status data, including binary files and full-file coverage, is preserved in the metadata supplied to the final generation (path inventory is bounded to 24,000 characters to prevent context overflow).

This is a deliberate light-weight commit summarizer, **not a code-review agent**. It will fail rather than guess a commit message if no DSH model is configured, and it deliberately does not allow model-side tool execution.

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

The Host injects only `connection` and `llm`. The authenticated `/api`
transport is owned by DSH Connection, and the plugin registers an exact route
through `connection.fetch.register()`. It does not require or access the
`webServer` service directly.

The package requires Node.js **22.22.1+** to satisfy its `@mcarvin/smart-diff@^6.4.0` dependency. It uses the DSH Host's existing `connection`, `llm`, `slots`, and `sidebarRight` services; the right-side UI requires the standard DSH Web/Desktop shell.

> **Security:** UI requests use **`ctx.connection.fetch.register({ path: '/api/git-commit', ... })`**, reusing the authenticated DSH `/api` carrier and its Owner/Host/Origin checks. The browser uses the standard `ctx.connection.rpc.call('/api', 'git-commit', ...)` request envelope. Importantly, this avoids `ctx.connection.rpc.handle()` creating a new channel, which reads `webServer` from the Connection service's *own* injection scope and caused plugin activation to fail. A bare `ctx.webServer.register()` would bypass authentication and is not used.

### Updating a failed 0.1.0 / 0.1.1 Desktop installation

Use Plugins → **Uninstall** (not only the enable toggle) and install the Git URL again.
DSH's package manager can retain the previous Git checkout when it already
matches the installed spec; explicitly remove the installed package first.
Enable the new bundle and fully quit/reopen Desktop. Verify version **0.1.2**.

The previous `webServer` inject addition in 0.1.1 was insufficient because
`connection.rpc.handle()` uses a shadow Context originating in the Connection
provider, not the consumer's declared dependencies. v0.1.2 avoids that route.

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
  "fullHash": "ac1234e..."
}
```

A failure returns `{ success:false, status:'failure', scope, additions:0, deletions:0, message:'', hash:null, error:'...' }` and **never invents a commit hash**. `commit({cwd, message:'...'})` is supported when another plugin already has a prepared commit message; it still follows the exact same staged/all semantics and snapshot safeguards. `status({cwd})`, `changeToken({cwd})`, `settings({cwd})`, `saveSettings({cwd,patch})` and `models()` are also available. See [`lib/index.d.ts`](lib/index.d.ts).

The Client uses the existing authenticated `/api` Connection RPC transport with endpoint `git-commit` (payload method: `status`, `changeToken`, `settings`, `saveSettings`, `models`, `commit`). Because the client passes the active workspace `cwd` and the Host resolves the canonical repository root, multiple Sessions and Git worktrees can be supported without assuming all Sessions use the same checkout.

## Tests

```sh
npm test
npm run check
```

Tests use temporary *real Git repositories* for staged-only vs all-files commits, untracked files, worktree changes during generation, accurate return values, settings persistence, reasoning metadata, and oversized diff batching. No provider key is required. A final installed-profile smoke test is still needed for the client module loader, DSH right-sidebar slot, and live LLM adapter wiring.

## Reference implementations and licensing

This project is independently implemented on DSH's public APIs. Reference projects and the specific ideas reused:

| Reference | License | Used for |
|---|---|---|
| [luigiinred/dsh-git-status-pill](https://github.com/luigiinred/dsh-git-status-pill) | MIT | Floating `shell.overlay` surface and session-aware branch/line-status UX |
| [dennisrongo/dsh-plugins: dsh-git](https://github.com/dennisrongo/dsh-plugins/tree/main/plugins/dsh-git) | MIT | DSH native LLM service calls, staged-diff commit model, watcher/token concept |
| [mcarvin8/smart-diff](https://github.com/mcarvin8/smart-diff) | MIT | **Direct installed npm dependency** for public diff chunking and secret-redaction functions |
| [MantisWare/commit-ai](https://github.com/MantisWare/commit-ai) | MIT | Design reference for map/reduce, bounded concurrency and huge-file handling |
| [SunParis/GitCommitGenerator](https://github.com/SunParis/GitCommitGenerator) | MIT | Design reference for eliminating unhelpful generated/binary diff bodies |
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | See upstream | Canonical Cordis services, Connection RPC, LLM metadata, right sidebar and client slots |

Implementation code here is new rather than a wholesale fork of any referenced repository. The package's own code is MIT-licensed. The direct smart-diff npm dependency retains its upstream MIT license and copyright; third-party notices and upstream references are recorded in [THIRD_PARTY.md](THIRD_PARTY.md). No AGPL implementation code or font assets are included.
