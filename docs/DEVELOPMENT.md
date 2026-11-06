# Development

This is a TypeScript Cordis Host/Client plugin. Edit `src/`; `pnpm build:runtime` generates committed `lib/` JS, maps and declarations. The Client uses DSH's `window.__ModuleLoader__`; installation needs no compiler. Node **22.22.1+** is required.

```sh
pnpm install --frozen-lockfile
pnpm check
npm pack --dry-run
```

The tests cover the Host authenticated route, Git snapshot isolation, Diff routing, commit results, settings persistence, Client registry/Session initialization, position boundaries/resize/reset, and LLM metrics. The Client test harness is a lightweight React-hook simulation, not a real Electron/Desktop renderer. Always test a new release in DSH Desktop as well.

Package identity: the DSH Client module registration ID passed to `window.__ModuleLoader__.load()` **must equal** `package.json.name` (`@ibobbyts/dsh-git-commit`), because the boot graph uses npm package names. The Host-side `cordis.patch.yml` row key remains `dsh-git-commit`, and the injected Cordis service remains `gitCommit`. Changing the npm package scope without updating the Client registration makes the entire UI fail to load; a test asserts their equality.

Use the official GitHub repository as source of truth. See [Architecture](ARCHITECTURE.md), [Configuration](CONFIGURATION.md), [Release guide](RELEASING.md) and [MIT license](../LICENSE).

## Build and distribution checks

Use Node 24.11.0 and the `packageManager` pnpm version for maintenance. `pnpm install --frozen-lockfile` prepares development dependencies. `pnpm typecheck` checks Host and Client separately; `pnpm build:runtime` refreshes generated `lib/`; `pnpm test` builds an isolated candidate before testing; `pnpm check:dist` independently rebuilds and compares all artifacts, then packs and tests clean tarball/Git installation. `pnpm check` combines these with one candidate build. Installation uses prebuilt JS; it runs no plugin compiler lifecycle hook.

Automated/source checks target DSH 0.2.2-rc.1. Desktop interaction and real user accounts remain separate validation.
