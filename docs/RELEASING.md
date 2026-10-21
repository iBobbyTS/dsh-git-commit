# npm release procedure

Package: **`@ibobbyts/dsh-git-commit`**, GitHub repository: **`iBobbyTS/dsh-git-commit`**.

The release pipeline follows the existing `@ibobbyts/svelte-ui-utils` pattern: versioned Git tags cause **GitHub Actions Trusted Publishing (OIDC)**; no long-lived `NPM_TOKEN` secret is required.

## One-time setup: first manual npm publication

Trusted Publishing is configured on an **existing** npm package. This repository initially contains version **0.2.0**, so do **not** create/push a `v0.2.0` release tag before completing this manual step.

1. Verify you control the npm **`@ibobbyts`** scope and that `@ibobbyts/dsh-git-commit` is available. From your own terminal, check the namespace on npmjs.com.
2. Clone `https://github.com/iBobbyTS/dsh-git-commit`, pull the release commit and inspect the source, README, `package.json`, and pack output.
3. Use Node **24** and npm CLI **11.5.1+**; then run:

   ```sh
   npm install
   npm run check
   npm pack --dry-run --ignore-scripts
   npm login
   npm publish --access public
   ```

   `prepublishOnly` reruns `npm run check` before the real publish. npm may require browser login and 2FA. **Only you** should perform the first publication; this workflow does not attempt to use your credentials.
4. Confirm `npm view @ibobbyts/dsh-git-commit version` returns `0.2.0`.
5. Go to **npmjs.com → @ibobbyts/dsh-git-commit → Settings → Trusted publishing → GitHub Actions**. Configure exactly:

   | Setting | Value |
   |---|---|
   | Organization or user | `iBobbyTS` |
   | Repository | `dsh-git-commit` |
   | Workflow filename | `npm-publish.yml` |
   | Environment | Leave blank (the workflow does not use one) |
   | Allowed actions | Enable **Allow `npm publish`** (not only `npm stage publish`) |

   New Trusted Publisher configurations must complete a successful publish through the workflow within **2 days** or the connection expires; set this up when ready to tag the **next** version.
6. Do not add `NPM_TOKEN`, `NODE_AUTH_TOKEN` or any other publish credential to GitHub Secrets. If desired, restrict token-based publishing after successful OIDC validation.

## Subsequent releases: automatic publish on tags

1. Bump `package.json`'s `version` (e.g., `0.2.1`), update code and docs, run `npm run check`, and merge the change into `main`.
2. Push a version tag matching `package.json` exactly:

   ```sh
   git checkout main && git pull --ff-only
   git tag -a v0.2.1 -m 'release v0.2.1'
   git push origin v0.2.1
   ```

3. `.github/workflows/npm-publish.yml` installs dependencies, checks source and package metadata, tests, verifies `vX.Y.Z` matches `package.json`, and runs `npm publish --access public` via **OIDC**. The tag must be on `main` history. A `workflow_dispatch` run performs **dry-run validation only** and never publishes.
4. Inspect the GitHub Actions run and `npm view @ibobbyts/dsh-git-commit version` after completion.

**Do not reuse or move a published tag.** npm versions are immutable. An unsuccessful release should be diagnosed and rerun with the same tag only if the npm version was not published; otherwise increment the version.

## CI prerequisites and limits

The repo intentionally has **no committed npm lockfile** yet because this environment cannot download the registry dependency graph. The workflows use `npm install` with exact direct secret-redaction dependency version and run all tests; after creating a lockfile in an online checkout, commit it and switch install steps to `npm ci` for fully reproducible builds. No publish step or tag is executed as part of initial configuration.

The tag workflow uses GitHub-hosted runners, Node 24, npm >=11.5.1, `id-token: write`, `contents: read`, and caching disabled. GitHub runners and npm Trusted Publishing must see an exact match between the package's `repository` field, npm Trusted Publisher fields, and workflow identity. Provenance support depends on npm and public repository settings. See https://docs.npmjs.com/trusted-publishers/ .
