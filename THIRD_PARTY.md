# References and third-party licenses

The plugin is originally authored under [LICENSE](LICENSE). The repositories below were used as references; no upstream source tree has been copied into this repository. License and copyright information is provided for attribution and future contributors who may choose to port code.

- **luigiinred/dsh-git-status-pill**, https://github.com/luigiinred/dsh-git-status-pill — MIT, Copyright (c) 2026 dsh-git-status-pill contributors. Reference for floating DSH `shell.overlay` UI.
- **dennisrongo/dsh-plugins** (`plugins/dsh-git`), https://github.com/dennisrongo/dsh-plugins — MIT, Copyright (c) 2026 Dennis Rongo. Reference for DSH Git status services and `ctx.llm`.
- **MantisWare/commit-ai**, https://github.com/MantisWare/commit-ai — MIT, Copyright (c) MantisWare, https://github.com/MantisWare. Historical reference for large-diff synthesis.
- **SunParis/GitCommitGenerator**, https://github.com/SunParis/GitCommitGenerator — MIT, Copyright (c) 2026 Yuchen Sun. Reference for deterministic diff input filtering.
- **@visulima/redact**, https://github.com/visulima/visulima/tree/main/packages/data-manipulation/redact — MIT, Copyright (c) Visulima contributors / Daniel Bannert. **Runtime dependency**; `stringAnonymize` and `credentialRules` are imported from the published package, not copied or reimplemented. The installed npm package includes its own MIT license.
- **deepseek-ai/deepseek-harness**, https://github.com/deepseek-ai/deepseek-harness — canonical host/client API documentation and implementation reference; the plugin uses those APIs via its peer dependencies.

This release removes the former **@mcarvin/smart-diff** runtime dependency. Prior versions used its public diff utilities; no smart-diff source is included in this release.

The MIT license permits copying/modification/distribution subject to preservation of the license and copyright notices. For references used as a basis for future source-level porting, preserve the complete upstream license notice in the relevant copied/derived files or a dedicated `licenses/` directory before redistribution.
