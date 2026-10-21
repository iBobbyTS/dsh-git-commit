# dsh-git-commit

A lightweight floating **Git status + AI Commit** plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness), published as **`@ibobbyts/dsh-git-commit`**.

- View the current Session's Git branch and changed-line counts in a draggable, collapsible panel.
- Generate a commit message through a model configured in DSH, then make **one real Git commit**.
- Configure independent **Repository** / **Global** settings tabs: per-repository model overrides (default: inherit global), writing instructions, Token metrics, and countdown color in the native DSH right sidebar.
- Keep the floating panel within the visible window; **drag locations persist** across restarts. The settings panel includes **Reset floating window position**.
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

If anything is staged, the plugin commits **only the staged Git index**. If nothing is staged, it snapshots all non-ignored worktree changes, generates a message, revalidates the snapshot, stages, and commits them. It never pushes or bypasses Git hooks. A changed snapshot fails safely instead of committing uninspected content.

Small Diff: one LLM call. When a file has over 2,000 changed lines: one low-reasoning classification call (all paths and large-file previews), then one final generation call (Off reasoning when supported). Total **at most two LLM calls**. Large-file previews are explicitly marked; inputs are best-effort credential-redacted before transmission. See [Architecture](docs/ARCHITECTURE.md).

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
