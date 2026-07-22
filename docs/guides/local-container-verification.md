# Local Container Verification

GitHub Actions runs the fast Ubuntu gate only. The former hosted Windows job is
intentionally disabled to avoid paid runner minutes.

Run the full local container suite when you want an isolated verification:

```bash
sh ./scripts/run-container-ci.sh
```

This requires Docker Desktop or another local Docker engine. It builds a Node
22 Debian container and runs type lint, the Vitest suite, and the packed-package
smoke. Docker on macOS or Linux does not emulate Windows;
use a real Windows machine to validate Windows-specific behavior before making
or supporting a Windows compatibility claim.
