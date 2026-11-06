# Development rules

Maintain a lightweight DSH Git panel and a shared Host service. Git mutations come from explicit Commit, Push or Merge-and-delete requests; background status reads must not mutate the repository. Automatic pushing, destructive conflict recovery and a separate Git server are outside scope.

- Preserve the Git index, hook and failure semantics documented in [Architecture](docs/ARCHITECTURE.md); never report a failed Git operation as successful. Treat model notices as advisory.
- Keep `package.json.name`, the browser-loader registration and bundle identity consistent; the Host service remains `gitCommit`.
- Use DSH's Host/Client extension APIs. Keep Session routing tied to the requesting Session, and secrets out of model inputs, logs and public reports.
- [Development](docs/DEVELOPMENT.md) owns setup and validation; [Configuration](docs/CONFIGURATION.md) and [API](docs/API.md) own their contracts. Update affected consumers and documents together. Preserve unrelated changes.

开发、构建与交付遵循父目录 [统一规范](../docs/plugin-development.md)。`src/` 是编辑源，`lib/` 由显式构建生成并与源码一同交付。
