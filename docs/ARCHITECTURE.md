# Architecture and safety model

## Integration

- Host `lib/index.js` registers the Cordis service `gitCommit` and an authenticated exact Connection fetch route at `/api/git-commit`; it does not expose an unauthenticated web server.
- Client `lib/client.js` is a Web/Desktop browser-loader bundle using DSH's `shell.overlay` and native right-sidebar slots. The on-screen Session is obtained from `sidebarRight.mounted`.
- The Host watches filesystem changes with `fs.watch` and a bounded debounce; the Client checks a cheap change token every 900 ms, refreshing full status on changes and at least every 30 seconds.

## Git index isolation

1. `plannedMode()` chooses `staged` if the index has staged entries; otherwise it chooses `all`.
2. `preparedSnapshot()` creates a stable candidate tree and Diff. For `all`, a temporary `GIT_INDEX_FILE` keeps the real index untouched during model generation.
3. Commit message generation sees only the preselected snapshot. After generation, the plugin verifies HEAD, index, and snapshot tree, then performs `git commit` with normal hooks. Changed content fails rather than being silently included.
4. The real committed message, seven-digit hash, and actual line statistics are returned. A rejected hook never reports success; staging may remain after a failed `all` commit.

The plugin does not fetch, push, amend, reset refs, or stage ignored files. Multiple plugin commits for the same repository serialize.

## LLM context routing (at most two calls)

The plugin builds a complete file inventory and parses each unified Diff file section. When every file has at most **2,000 changed lines**, it makes one generation call. Otherwise, it makes one classification call with every path/stat and the first 200 lines of each large file's Diff. A strictly parsed model decision determines which large files need full Diff. Non-selected large files still contribute an explicitly marked **truncated 200-line preview** to the final generation input. Missing/invalid decisions fall back to full Diff. Pathological or oversized inputs fail explicitly rather than quietly dropping files.

The classifier prefers the lowest **non-Off** reasoning level (Off only when the model offers nothing else); final generation prefers Off, falling back to the lowest supported effort.

Both model inputs are best-effort redacted with `@visulima/redact` credential rules. Redaction is *not* a guarantee against every secret or sensitive source path. The real Git snapshot is never modified by prompt redaction. Review changes and avoid staging credentials before committing.

If the Diff exceeds the provider's safe request budget even after selection, the plugin returns an explicit failure; it never launches unbounded Map-Reduce requests.

## Statistics

Each direct `ctx.llm.stream()` call captures provider `usage` and local monotonic time. The returned `llm` object aggregates input including cache-read and cache-write, output, cache and reasoning counts, TTFT, elapsed model-phase time and decoded-token throughput. Missing provider usage stays `null`. `totalDurationMs` measures the entire commit operation. Caller-supplied messages skip LLM generation and its usage object.

## Config and lifecycle

Settings are atomically written to `$DSH_HOME/dsh-git-commit.json`, permissions `0600` on newly written files, with per-repository instructions keyed by canonical Git root and global UI settings. Global `floatingPosition` is optional, interpreted as top/right CSS pixels, and null resets to the default lower-right anchor. Writes are serialized; UI position changes are persisted at the end of each completed drag rather than on every pointer frame to avoid excessive disk writes. Window/layout clipping corrections also persist.

## Validation

- `npm run check`: syntax checks and Node integration tests using real temporary Git repositories plus a Client browser-loader hook harness.
- `npm pack --dry-run --ignore-scripts`: inspect the publishable artifact.
- Real Desktop rendering, actual LLM provider calls, and registry package installation must still be checked in an installed DSH runtime; passing component tests alone cannot establish those behaviors.
