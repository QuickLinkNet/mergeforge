# Contributing to MERGEFORGE

MERGEFORGE grows through reviewed, backwards-compatible pull requests. The MVP boundary and technical foundation are approved; implementation proceeds through focused issues and pull requests into `dev`.

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

## Before opening an implementation PR

Read the current handoff, decision log and project bible. Do not introduce a competing framework, silently change locked gameplay values or invalidate existing saves. Run `npm run check` and `git diff --check` before requesting review.

## Who may change what

- Nobody pushes to `main` or `dev` directly. Every change is a pull request, including the maintainer's own.
- New accounts are **contributors**: fork the repository, open a pull request against `dev`, and wait for the maintainer's review. The first CI run of a new contributor is started by the maintainer.
- A pull request needs green CI (`verify`, `release-route`), resolved conversations and the maintainer's approval (`.github/CODEOWNERS`). The maintainer is the only exception and may merge own pull requests without a second reviewer.
- A gameplay module should be a pure data pull request that only touches `modules/<id>/`; core changes need a decision-log entry and a stricter review.
- CI runs on `pull_request` without any secrets. Deployment credentials never exist in the repository or in CI.
