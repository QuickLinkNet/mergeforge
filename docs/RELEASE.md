# Release flow

MERGEFORGE accepts reviewed pull requests only. The enforced branch route is:

```text
feature/*, fix/*, docs/* or ci/*  ->  dev  ->  main
```

## Integration pull requests

1. Create a focused branch from the current `origin/dev`.
2. Run `npm run validate:modules`, `npm run check` and `git diff --check` locally.
3. Open the pull request against `dev` and wait for the required CI checks and review.
4. Merge normally after approval; do not force-push shared branches.

The CI workflow validates every `modules/<id>/` directory. It uses the domain manifest validator and rejects invalid JSON, invalid manifests, folder/ID mismatches, duplicate or core-building IDs, missing icons, icons above 8 KB, and SVGs containing scripts or inline event handlers. A repository without `modules/` is valid until its first data module is added.

## Stable releases

1. Open a dedicated pull request with `dev` as its source and `main` as its target.
2. CI rejects a pull request to `main` from any other source branch.
3. Require the green `verify` CI job, review approval and resolved conversations before merging the release PR.
4. Merge linearly, then tag or publish only from the resulting `main` commit.

Repository branch protection remains the owner-controlled GitHub setting: `main` should require pull requests, linear history, the `verify` status check and resolved conversations; deletion and force pushes remain disabled.

## Deployment boundary

This repository intentionally contains no deployment target or credentials. No workflow reads deployment secrets and no CI job deploys. Until the owner provides the FTP/API target and configures secrets outside Git, a release ends at the verified `main` merge. A future deployment workflow must fail before connecting or uploading when any required configuration is missing; it must never guess a target or fall back to an implicit destination.
