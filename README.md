# dsh-git-commit

A draggable **Git status + AI commit** panel for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It shows the current Session's repository, generates commit messages using a configured DSH model, and offers explicit Push and Merge-and-delete actions.

## Install

For Desktop CLI installation, launch the app once to create its profile, fully quit it, and use the app-provided DSH CLI (Desktop menu **Manage dsh Command…**). Install into the profile you use:

```sh
dsh plugin --profile desktop add @ibobbyts/dsh-git-commit
# For CLI web, use --profile web instead.
```

Or use **Plugins → Add plugin → Git repository** with:

```text
https://github.com/iBobbyTS/dsh-git-commit.git
```

Requires Node **22.22.1+**. Restart the corresponding DSH Host after installation; Desktop requires a full quit and reopen. Remove an old unscoped `dsh-git-commit` installation first to avoid duplicate registration. See [installation and troubleshooting](docs/INSTALLATION.md).

## Use

Open a conversation in a Git worktree. The floating panel shows branch and changed-line counts; its settings support repository/global model selection, commit instructions and position reset.

If changes are already staged, Commit uses only that index. Otherwise it stages all non-ignored worktree changes **before** generating the message; a generation failure leaves them staged for inspection or retry. Git hooks run normally. Commit never pushes automatically. Push and Merge-and-delete are separate user actions; merging switches to the existing local default branch and safely deletes the local source branch. Conflicts are preserved for inspection.

A successful commit can notify the requesting Session's model through its inbox, without waking an idle Agent or adding a user Chat message.

## Documentation

- [Settings and panel behavior](docs/CONFIGURATION.md)
- [Architecture and Git side effects](docs/ARCHITECTURE.md)
- [Host service API](docs/API.md)
- [Development](docs/DEVELOPMENT.md) · [Release procedure](docs/RELEASING.md)
- [Development rules](https://github.com/iBobbyTS/dsh-git-commit/blob/main/AGENTS.md) · [Third-party licenses](THIRD_PARTY.md)

[MIT](LICENSE).
