# Development

This is a zero-build JavaScript Cordis Host/Client plugin. The browser Client ships as `lib/client.js` and uses DSH's `window.__ModuleLoader__`; it does not need a bundler. Node **22.22.1+** is required.

```sh
npm install
npm run check
npm pack --dry-run --ignore-scripts
```

The tests cover the Host authenticated route, Git snapshot isolation, Diff routing, commit results, settings persistence, Client registry/Session initialization, position boundaries/resize/reset, and LLM metrics. The Client test harness is a lightweight React-hook simulation, not a real Electron/Desktop renderer. Always test a new release in DSH Desktop as well.

Package naming: DSH bundle identity (row id) stays `dsh-git-commit`; the published dependency and the bundle's module name are `@ibobbyts/dsh-git-commit`; the injected service remains `gitCommit`. Do not rename the service or transport endpoint when changing npm packaging.

Use the official GitHub repository as source of truth. See [Architecture](ARCHITECTURE.md), [Configuration](CONFIGURATION.md), [Release guide](RELEASING.md) and [MIT license](../LICENSE).
