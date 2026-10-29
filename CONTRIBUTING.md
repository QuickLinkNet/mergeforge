# Contributing to MERGEFORGE

MERGEFORGE grows through reviewed, backwards-compatible pull requests. The project is still in its design and playable-blueprint phase; implementation tasks will be opened after the MVP boundary is approved.

## Branch flow

```text
feature/* or fix/*  ->  dev  ->  main
```

- `main` contains stable versions only.
- `dev` is the current integration branch.
- Create focused branches such as `feature/hex-map` or `fix/fog-reveal` from `dev`.
- Open ordinary pull requests against `dev`.
- Promote tested milestones through a dedicated pull request from `dev` to `main`.
- Never force-push shared branches.

## Pull-request contract

Each gameplay module must declare:

- a unique module ID and version,
- required and provided capabilities,
- persistence and migration effects,
- server-side validation for rewards and state changes,
- tests for deterministic or seed-based behavior,
- rollback or deactivation behavior,
- compatibility with existing worlds.

The project bible in `docs/MERGEFORGE_Project_Bible_and_Agent_Handoff.md` is the current source of truth.

## Before implementation begins

Design contributions are welcome, but no application framework or competing architecture should be introduced before the playable blueprint and technical foundation have been approved.

