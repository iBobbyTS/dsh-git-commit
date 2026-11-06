# Host service API

## Calling from another Host plugin

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

[Full API contract](../lib/index.d.ts) · [Settings reference](CONFIGURATION.md)
