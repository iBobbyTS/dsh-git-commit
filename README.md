# dsh-git-commit

A lightweight floating **Git status + AI Commit** plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness), published as **`@ibobbyts/dsh-git-commit`**.

- View the current Session's Git branch and changed-line counts in a draggable, collapsible panel.
- Generate a commit message through a model configured in DSH, then make **one real Git commit**.
- Configure independent **Repository** / **Global** settings tabs: per-repository model overrides (default: inherit global), writing instructions, Token metrics, and countdown color in the native DSH right sidebar.
- Keep the floating panel within the visible window; **drag locations persist** across restarts. The plugin's **Plugins → dsh-git-commit** details page includes **Reset floating window position**.
- Non-Git directories show a compact warning or remain hidden according to your preference.

## Install

From the npm registry (recommended after the first publication):

```sh
dsh plugin --profile desktop add @ibobbyts/dsh-git-commit
# Or: dsh plugin --profile web add @ibobbyts/dsh-git-commit
```

Alternatively, in **Plugins → Add plugin → Install third-party plugin**, use `https://github.com/iBobbyTS/dsh-git-commit.git`.

**Upgrading from v0.1.x:** The npm package is now scoped. Remove the previous `dsh-git-commit` package/bundle before installing `@ibobbyts/dsh-git-commit`; the Host service name remains `gitCommit`, and the settings file is reused. Fully quit and restart DSH Desktop after installation.

[Complete install, upgrade, and troubleshooting guide](docs/INSTALLATION.md)

## How commits work

If anything is staged, the plugin commits **only the staged Git index**. If nothing is staged, it snapshots all non-ignored worktree changes, generates a message, revalidates the snapshot, stages, and commits them. Committing never pushes automatically or bypasses Git hooks. A changed snapshot fails safely instead of committing uninspected content.

After a successful commit, a **Push** button appears immediately to the right of Commit. It performs a normal (never force) push; a branch without an upstream establishes `origin/<same-name>` as upstream. Push success and failure get their own ten-second notification, independent of the commit countdown.

On a non-default branch (excluding `main` and detached HEAD), a single **Merge and delete** button contains both merge and delete icons. It resolves the default branch using `git symbolic-ref --short refs/remotes/origin/HEAD` and removes only the leading `origin/`. With a clean index/worktree, it switches to that **existing local branch**, merges the source, then safely deletes the **local source branch** with `git branch -d`. No fetch, pull, remote deletion or push is implicit. Missing default/local target or an unfinished Git operation refuses the action. Conflicts leave the source branch intact and the target's conflict state available for inspection; a deletion failure reports failure without undoing a completed merge.

Commit, Push and Merge results have independent countdowns, separated by horizontal dividers. Hovering the card pauses each countdown at its own remaining duration. The Push button remains available after a merge so you can explicitly push the local default branch.

Small Diff: one LLM call. When a file has over 2,000 changed lines: one low-reasoning classification call (all paths and large-file previews), then one final generation call (Off reasoning when supported). Total **at most two LLM calls**. Large-file previews are explicitly marked; inputs are best-effort credential-redacted before transmission. Both calls carry the requesting Session id as model-hidden routing metadata, so Session-keyed provider routes (such as OpenCode's required Session header) behave as they do in a normal Agent conversation. See [Architecture](docs/ARCHITECTURE.md).

## Model notification

A commit requested by a Session also tells the model that those changes are committed, so it does not commit them again. The notice enters the Session's Agent inbox through `agent.inject()`:

- A **running** Agent sees it at its next step boundary.
- An **idle** Agent keeps it pending until your next message, and the inbox claim order places the notice *before* that message.
- It never wakes the Agent by itself, so an idle Session stays idle.

The notice is model-facing only: Chat shows user, assistant, and tool rows, so the injected context adds **no transcript row**, and it never appears as your own message. It stays inspectable in the Session log and the **Trajectory** view. Delivery requires the requesting Session id, which the floating panel sends with every commit. An undelivered notice survives a restart and is re-sent when the Session reopens, provided `HEAD` still points at that commit; it is dropped as stale otherwise. Disable it in `cordis.patch.yml` with `config: { notifyModel: false }`.

## Call the Git commit service from another DSH Host plugin

`@ibobbyts/dsh-git-commit` exposes a **Cordis-native Host service**. Declare `gitCommit` in your plugin's injection list. No separate MCP server or browser RPC is required:

```ts
import type {} from '@ibobbyts/dsh-git-commit'; // optional: Context type augmentation

export const inject = ['gitCommit'];

export async function run(ctx: import('@deepseek-ai/cordis').Context, cwd: string) {
  const result = await ctx.gitCommit.commit({ cwd });
  if (!result.success) throw new Error(result.error ?? 'Git commit failed');

  return {
    hash: result.hash,            // first 7 hex characters
    message: result.message,      // actual committed message
    additions: result.additions,  // actual committed lines
    deletions: result.deletions,
    scope: result.scope,          // 'staged' or 'all'
    llm: result.llm,              // optional Token/TTFT/speed statistics
  };
}
```

`cwd` may point anywhere inside a Git worktree. Pass `{message: 'type: subject'}` to commit with a **caller-supplied message** instead of invoking an LLM, while retaining all snapshot and hook checks. Other operations include `ctx.gitCommit.status({cwd})` and `ctx.gitCommit.settings({cwd})`. Importing the types is optional at runtime; the service requires this plugin to be installed and enabled in the same DSH profile.

[Full API contract](lib/index.d.ts) · [Settings reference](docs/CONFIGURATION.md)

## Development and releases

```sh
npm install
npm run check
npm pack --dry-run --ignore-scripts
```

The source is MIT licensed. See [Development](docs/DEVELOPMENT.md), [npm release instructions](docs/RELEASING.md), and [third-party licenses](THIRD_PARTY.md). No npm token is committed to the repository.
