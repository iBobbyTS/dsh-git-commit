# Settings and floating panel

`Git commit settings` is rendered in DSH's native right sidebar. The page automatically saves changes; there is no Save button or Saved notice. Save failures are shown.

The settings page has two tabs at its top:

- **Repository** (default when a Git project is active): **Model** (default **Inherit Global (provider / model)**, or select a repository-specific model), **Inherit global instruction** (checked by default), **Repository commit instruction**, and the canonical Git repository path. The model dropdown's inherit option has the *fixed value* `inherit-global`, even as its label updates when the global model changes. Model inheritance and instruction inheritance are independent. Choosing an explicit model affects only this repository.
- **Global**: **Global commit instruction**, **Model** (explicit DSH provider/model, or DSH default), **Automatically hide floating window in non-git projects** (off by default), **Show token details** (off by default), and **Countdown color** (orange `#f59e0b` by default).

In a non-Git directory the Global tab is selected automatically, while Repository displays **Not a git repository** if opened. The position-reset action lives separately under **Plugins → dsh-git-commit**, so it remains available without any active Session or Git repository.

Repository models are persisted in each Git root's `repositories[root].model`. A missing model or `null` means **inherit Global**; an existing settings file keeps its previous global `model` value and every repository continues to inherit it until explicitly overridden. The effective provider/model is resolved immediately before each commit as **repository override → global override → DSH default → first configured model**, so this setting affects both large-Diff decisions and final commit generation.

## Position and layout

The expanded panel grows to fit the branch, added/deleted line counts, and its two 36 × 36 px icon buttons, up to **216px** wide. Its compact state is 44 × 44 px. The first collapse fixes the current top-right corner so expanding does not change the anchored corner. Both the main drag handle and compact Git icon are draggable.

All four sides respect a 6px visible inset. The plugin measures the actual panel dimensions and the visible intersection between the containing DSH overlay and the browser window. On window resizing, container resizing, and panel size changes (including the confirmation panel), any out-of-bounds position is moved to the nearest valid location.

The initial position is `right: 24px; bottom: 98px`. Each completed drag and automatic off-screen correction saves the **global** panel position in `$DSH_HOME/dsh-git-commit.json`, under `global.floatingPosition = {right, top}`. `null` means default position. The **Reset floating window position** button on the plugin's own details page restores `null` rather than storing the current window size. No settings are written inside a Git repository. Existing v1 settings files without this field remain compatible.

## Status and commit feedback

- Row 1: branch with a tooltip containing its full name; fold button at the right.
- Row 2: `+added` and `−deleted` relative to HEAD, plus trackable untracked text files.
- Row 3: left-aligned icon buttons, Commit and Settings.
- On success, for **10 seconds**: first line `Committed <hash> · +<additions> −<deletions>` (monospace), second line **only** the commit subject (UI font), optional third monospace metrics line, and a configurable countdown bar.
- Optional metrics: `↓ <input> · ↑ <output> | <TTFT>s · <decode speed>t/s`. Input includes uncached, cache-read and cache-write tokens; unknown values show `—`.

For non-Git directories the expanded panel says **Not a git repository** and has a fold button. In the compact state the Git icon has a red cross. Neither state allows committing or opening settings. With automatic hiding enabled, neither state is shown.

## Language

The plugin follows DSH's Client locale service (`@deepseek-ai/dsh-client-locale`) automatically. It provides Simplified Chinese (`zh`) and English (`en`) dictionaries. Changing **DSH Settings → General → Language** updates the plugin's floating panel and settings page without a reload. Other DSH languages fall back to English. There is no separate plugin language setting, and the Git commit message/model output is not translated.
