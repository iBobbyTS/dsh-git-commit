# Install, upgrade and troubleshoot

## npm installation (recommended)

From DSH Desktop's installed `dsh` command (Desktop menu **Manage dsh Command…**), or another compatible DSH CLI:

```sh
# Quit Desktop completely before CLI changes.
dsh plugin --profile desktop add @ibobbyts/dsh-git-commit
# Web profile instead:
dsh plugin --profile web add @ibobbyts/dsh-git-commit
```

The package declares its `dsh.bundle.patch` to activate the Host and Client. Select **Enable** if it is not already enabled, and restart Desktop after changing the plugin set. Node **22.22.1+** is required by the plugin.

For source-based installs, Plugins → Add plugin → third-party plugin also accepts `https://github.com/iBobbyTS/dsh-git-commit.git`. Both source and published npm versions provide the same `gitCommit` Cordis service.

## Upgrading from Git installs / v0.1.x

The old package was named `dsh-git-commit` without a scope. The published package is **`@ibobbyts/dsh-git-commit`**. Remove the old package/bundle, then install the scoped package so both do not register the same DSH IDs and endpoint. The persisted settings file is left intact by normal uninstall.

```sh
dsh plugin --profile desktop remove dsh-git-commit
dsh plugin --profile desktop add @ibobbyts/dsh-git-commit
```

If you previously installed from the GitHub URL through the UI, remove that entry in the Plugins UI before installing the npm package. Fully quit (Command-Q) and reopen Desktop after the operation. `--profile web` is a different profile; don't use it for Desktop.

For later npm upgrades, use DSH package management, then confirm that the new version is installed. Repeatedly adding an unchanged Git URL can fail with `ambiguous-install` in DSH; remove it before reinstalling if needed.

## Missing floating panel

The panel is displayed only for a mounted Conversation Session, not the global Plugins screen. If the Client module is present but the overlay is absent, open Desktop DevTools and inspect:

```js
window.__DSH_BOOT__?.entries?.find(row => row.id === 'dsh-git-commit')
document.querySelector('style[data-dsh-git-commit="true"]')
document.querySelector('.dgc-root')
```

A missing manifest entry suggests the bundle is disabled or installed to another profile; a missing style tag suggests the Client did not activate. Inspect the Desktop console for runtime errors. If the panel is outside its containing viewport, use **Git commit settings → Reset floating window position**; window resizing will also clamp it back into bounds.

Do not alter or remove `$DSH_HOME/dsh-git-commit.json` to fix position unless intentionally resetting all plugin preferences.
