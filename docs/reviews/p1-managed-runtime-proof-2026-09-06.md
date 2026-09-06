# P1 published managed-runtime proof

PR #139 merged to `main` as `de001ee`; required CI and the guarded release job
passed. npm and tag `latest` both resolved to `0.14.0-alpha.236`.

The published package was installed from a neutral temporary directory for
Codex and Copilot CLI separately. Both registrations resolve the same immutable
runtime:

- Node: `/Users/macbook/.asdf/installs/nodejs/24.13.0/bin/node`
- Entrypoint: `/Users/macbook/.astrograph/runtime/versions/0.14.0-alpha.236/node_modules/astrograph/dist/astrograph.js`
- Tool catalog: all 14 supported tools

A fresh MCP client against a newly initialized repository observed
`not-ready`, ran `index_folder`, then observed `deep-retrieval-ready` and
`fresh`. Symbol search found `publishedRuntimeProof`; diagnostics were healthy;
the opt-in profile completed successfully in 154 ms with zero failed or
incomplete operations. The temporary index was removed afterward.

Maintainer note: from inside the Astrograph package repository,
`npx astrograph@0.14.0-alpha.236` selected the existing workspace `.235` binary.
The canonical published-artifact check therefore runs from a neutral directory.
Making exact-version npm execution immune to workspace-bin shadowing remains a
separate backlog item.
