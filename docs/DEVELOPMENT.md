# Development

This is a zero-build JavaScript Cordis Host/Client plugin. The browser Client ships as `lib/client.js` and uses DSH's `window.__ModuleLoader__`; it does not need a bundler. Node **22.22.1+** is required.

```sh
npm install
npm run check
npm pack --dry-run --ignore-scripts
```

The tests cover the Host authenticated route, Git snapshot isolation, Diff routing, commit results, settings persistence, Client registry/Session initialization, position boundaries/resize/reset, and LLM metrics. The Client test harness is a lightweight React-hook simulation, not a real Electron/Desktop renderer. Always test a new release in DSH Desktop as well.

Package identity: the DSH Client module registration ID passed to `window.__ModuleLoader__.load()` **must equal** `package.json.name` (`@ibobbyts/dsh-git-commit`), because the boot graph uses npm package names. The Host-side `cordis.patch.yml` row key remains `dsh-git-commit`, and the injected Cordis service remains `gitCommit`. Changing the npm package scope without updating the Client registration makes the entire UI fail to load; a test asserts their equality.

Use the official GitHub repository as source of truth. See [Architecture](ARCHITECTURE.md), [Configuration](CONFIGURATION.md), [Release guide](RELEASING.md) and [MIT license](../LICENSE).
