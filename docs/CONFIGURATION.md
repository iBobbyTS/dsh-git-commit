# Settings and floating panel

`Git commit settings` is rendered in DSH's native right sidebar. The page automatically saves changes; there is no Save button or Saved notice. Save failures are shown.

The fields are ordered as follows:

1. **Global commit instruction** — shared prompt convention for commit-message generation.
2. **Model** — a configured DSH LLM route, or the DSH default.
3. Divider.
4. **Inherit global instruction** — per-repository checkbox, checked by default.
5. **Repository commit instruction** — scoped to the canonical repository root.
6. Canonical repository path.
7. Divider.
8. **Automatically hide floating window in non-git projects** — global; off by default.
9. **Show token details** — global; off by default.
10. **Countdown color** — global color picker, orange `#f59e0b` by default.
11. Divider, then **Reset floating window position** — restores the lower-right default immediately.

In a non-Git directory, the repository fields are replaced by **Not a git repository**; global fields and the position reset remain accessible if the settings tab is already open.

## Position and layout

The expanded panel grows to fit the branch, added/deleted line counts, and its two 36 × 36 px icon buttons, up to **216px** wide. Its compact state is 44 × 44 px. The first collapse fixes the current top-right corner so expanding does not change the anchored corner. Both the main drag handle and compact Git icon are draggable.

All four sides respect a 6px visible inset. The plugin measures the actual panel dimensions and the visible intersection between the containing DSH overlay and the browser window. On window resizing, container resizing, and panel size changes (including the confirmation panel), any out-of-bounds position is moved to the nearest valid location.

The initial position is `right: 24px; bottom: 98px`. Each completed drag and automatic off-screen correction saves the **global** panel position in `$DSH_HOME/dsh-git-commit.json`, under `global.floatingPosition = {right, top}`. `null` means default position. The reset button restores `null` rather than storing the current window size. No settings are written inside a Git repository. Existing v1 settings files without this field remain compatible.

## Status and commit feedback

- Row 1: branch with a tooltip containing its full name; fold button at the right.
- Row 2: `+added` and `−deleted` relative to HEAD, plus trackable untracked text files.
- Row 3: left-aligned icon buttons, Commit and Settings.
- On success, for **10 seconds**: first line `Committed <hash> · +<additions> −<deletions>` (monospace), second line **only** the commit subject (UI font), optional third monospace metrics line, and a configurable countdown bar.
- Optional metrics: `↓ <input> · ↑ <output> | <TTFT>s · <decode speed>t/s`. Input includes uncached, cache-read and cache-write tokens; unknown values show `—`.

For non-Git directories the expanded panel says **Not a git repository** and has a fold button. In the compact state the Git icon has a red cross. Neither state allows committing or opening settings. With automatic hiding enabled, neither state is shown.
