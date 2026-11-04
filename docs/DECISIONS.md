# MERGEFORGE — Decision Log

Short records of confirmed project-level decisions. Newer approved records supersede older pitch material.

## D-001 — Visual direction

- **Status:** Accepted
- **Decision:** Use Style A, “Diorama Lite”.
- **Reason:** Strong identity and readable terrain while remaining feasible with AI-assisted asset production.

## D-002 — Player identity

- **Status:** Accepted for MVP planning
- **Decision:** Every player receives an internal immutable MERGEFORGE ID. The MVP links it to the stable numeric GitHub user ID; the GitHub username is display metadata only.
- **Consequence:** Additional login methods can be added later without migrating game ownership.

## D-003 — Contributor identity

- **Status:** Superseded in part by D-018 (playing now requires being a contributor)
- **Decision:** Contributor is a separate role, not a prerequisite for playing. A merged pull request can create a contribution record and cosmetic recognition, but grants no game resources or administrative rights.

## D-004 — GitHub integration

- **Status:** Accepted for MVP planning
- **Decision:** Prefer a GitHub App with minimal permissions for user authentication and pull-request webhooks. Register it once callback and webhook URLs exist.

## D-005 — License

- **Status:** Accepted
- **Decision:** Release MERGEFORGE under the MIT License.
- **Consequence:** The software may be reused, modified and redistributed under the license terms, including preservation of the copyright and permission notice.

## D-006 — Prologue time model

- **Status:** Accepted for the playable blueprint
- **Decision:** The first seven “days” are objective-driven chapters, not calendar days. Active actions resolve immediately; production and construction use a 10-minute world pulse with offline progress up to storage capacity.

## D-007 — Branch model

- **Status:** Accepted
- **Decision:** `main` contains only stable versions. `dev` is the integration branch for ongoing development. Feature and fix branches open pull requests into `dev`; release pull requests promote a tested state from `dev` to `main`.
- **Protection:** `main` requires a pull request, linear history and resolved conversations. Deletion and force pushes are blocked.

## D-008 — Playable blueprint design lock

- **Status:** Accepted on 2026-10-30
- **Decision:** The project owner approved `MERGEFORGE_Playable_Blueprint_v1.md`, the first-15-minute flow, the four-screen UI direction and the deterministic world contract as the implementation baseline.
- **Consequence:** M1 planning and implementation issues may begin. Changes to locked gameplay values require a new decision record rather than silent deviation.

## D-009 — M1 technical foundation

- **Status:** Accepted on 2026-10-30
- **Decision:** Use Node.js 24 LTS, pnpm workspaces, strict TypeScript, React with Vite for the application shell and PixiJS 8 with WebGL for the map. Keep domain and world generation independent from browser and renderer concerns. Use Vitest, fast-check and Playwright for automated verification.
- **Consequence:** Issue M1.1 may begin on `feature/m1-1-hexworld-view`. Additional frameworks require a concrete issue and pull-request justification.

## D-010 — Backend and deployment boundary

- **Status:** Accepted on 2026-10-30
- **Decision:** Do not require or create a local PHP server. A later backend targets the owner-provided online environment. Once FTP target and credentials exist, `npm run deploy` must perform the complete upload; integration tests may run against the approved online API.
- **Security:** Credentials and target secrets never enter the repository. Missing deployment configuration must fail safely and must not fall back to a guessed destination.

## D-011 — Save schema 6 migrates schema 5

- **Status:** Accepted on 2026-11-03
- **Decision:** Chapter 7 raises the game-state schema to 6. Schema-5 local saves are migrated on load instead of being reset; a schema-5 save with finished chapter 6 stays at chapter 6 and can scan for the far signals (chapter 7 is never granted by migration). Older schemas remain incompatible.
- **Consequence:** Existing worlds stay playable ("a PR must not silently invalidate existing world states"). Far signals are derived data and are validated against regeneration; only a compass sector and a coarse distance band are stored.

## D-012 — Data modules and missing-module saves

- **Status:** Accepted on 2026-11-03
- **Decision:** Contributor modules use pure JSON manifests under `modules/<id>/` and are loaded at build time. Generic core support and the Harzsammler example remain separate pull requests.
- **Persistence:** If a required module is missing or version-incompatible, loading returns `blocked`, identifies the missing ID/version and preserves the stored save unchanged. It must never silently remove module buildings or reset that world.
- **Initial limits:** Costs are 0–50 per existing resource, production is 1–5 units per world pulse, construction is 1–24 whole pulses, and icons are safe local SVG basenames; the loader additionally enforces existence and a maximum size of 8 KB.

## D-013 — Module buildings are generic core, content stays data

- **Status:** Accepted on 2026-11-03
- **Decision:** The core knows one generic building type `module`. Placement (terrain, road), cost, build time and production come only from the module manifest via `startModuleBuilding`; the production rule is frozen into the building at build start, so settling time never needs a manifest. No module-specific code exists in the core or UI.
- **Persistence:** Every module building must be covered by a module reference of the same version; where the manifest is available, the frozen production and the placement must still match it, otherwise the save is rejected as corrupt. Missing modules still block the save unchanged (D-012).
- **Consequence:** A module PR (for example the Harzsammler) only adds `modules/<id>/module.json` and an icon. The single global build slot and the one-building-per-tile rule apply to module buildings.

## D-014 — Player registry and start sectors

- **Status:** Accepted on 2026-11-03
- **Decision:** Players are keyed by the numeric GitHub user ID and receive an immutable internal ID `mf_` + 32 hex characters, assigned once by the server. The GitHub login is refreshed on every login but never identifies. Each new player takes the next sector on a hex spiral (`sectorForIndex`); the world seed is derived per sector (`sectorSeed`), so no two players share a world.
- **Scope:** Pure domain logic only. Real GitHub login, API and storage wait for the owner-provided domain, GitHub App and FTP target (D-004, D-010).

## D-015 — Hosting, deploy and live API

- **Status:** Accepted on 2026-11-03
- **Decision:** The game is served at `https://mergeforge.red-it.org`; on the server it lives in `/html/apps/mergeforge` (frontend) with the PHP API in `/html/apps/mergeforge/api`. `npm run deploy` builds and uploads both over FTPS with curl (no extra dependency); `npm run live:check` smoke-tests the live frontend and `GET /api/health`. Integration tests run against the live API, no local server needed (D-010).
- **Security:** FTP login and target live only in the git-ignored `.env.deploy` (template: `.env.deploy.example`). The script refuses any target not ending in `/mergeforge`, never uploads `api/config.local.php` or `api/data/`, and deletes only stale hashed bundles in `assets/`.

## D-016 — GitHub login in the PHP API

- **Status:** Accepted on 2026-11-03
- **Decision:** The API (`api/`) signs players in with a GitHub App user login (web flow): `GET /api/auth/login` -> GitHub -> `GET /api/auth/callback`. Only the numeric GitHub user ID and login name are used; the access token is discarded immediately. The ID maps to an immutable `mf_` player ID and the next start sector in SQLite (`api/data`, never served or uploaded). The session is an HMAC-signed, HttpOnly, Secure, SameSite=Lax cookie (30 days); logout is a same-origin POST.
- **Secrets:** `api/config.local.php` (git-ignored; `npm run setup:config` creates it with a random session secret, the GitHub client secret is pasted in by the owner) is uploaded by `npm run deploy` and never served. The PHP sector spiral is pinned to the TypeScript one by `api/tests/run.php` (also run in CI).
- **Hosts:** Only `mergeforge.red-it.org` and `www.red-it.org` (plus localhost for tests) are accepted; the callback URL is derived from the request and must be registered in the GitHub App.

## D-017 — Online save with optimistic revisions

- **Status:** Accepted on 2026-11-03
- **Decision:** A signed-in player has one server save (`GET/PUT /api/save`, SQLite). Every PUT names the revision it is based on; a stale base answers 409 and the client pauses uploads until the player loads the newer save. The save is stored byte for byte as the client wrote it (no re-encoding). The browser keeps a per-player cache under its own key, separate from the anonymous sandbox save, plus a small meta record (base revision, dirty flag). On sign-in the newer state wins: a clean cache yields to a newer server save, a dirty cache wins only if it was played more recently (`lastAdvancedAtMs`).
- **Worlds:** Sector (0,0) keeps the genesis seed `mergeforge-genesis-001`, so existing saves stay valid and the first player's anonymous browser save is adopted into the account once. Other sectors use `sectorSeed(genesis, sector)`.
- **Limits:** The server checks shape and size (max 1 MB), not game rules; the client is still authoritative. Rule validation on the server is a later step. Uploads are debounced (3 s), the page checks for newer revisions every 30 s.

## D-018 — Playing is for contributors only

- **Status:** Accepted on 2026-11-04 (supersedes the "not a prerequisite for playing" part of D-003)
- **Decision:** Opening the site is not enough to play. Only contributors get the game: GitHub accounts with at least one merged pull request in `QuickLinkNet/mergeforge`. The owner (GitHub user ID 33082510) is always allowed.
- **How:** After the GitHub login the API checks the merged-PR search once (`github_is_contributor`) and decides with `may_play`. Allowed are: the owner, IDs in `allowed_github_user_ids` (`api/config.local.php`, for testers), already registered players (grandfathered, also when GitHub is down), and contributors. Everyone else gets a session without a player; `/me` reports `contributor: false` and `/save` answers 403. If GitHub cannot answer for a new person, they are not let in and may retry.
- **Client:** `OnlineGate` shows an access page (sign in / how to become a contributor / sign out) instead of the game for visitors, non-contributors and an unreachable server. Only on localhost the anonymous sandbox remains for development.
- **Consequences:** The MVP goal of two test players needs a second GitHub account that is a contributor or is listed in `allowed_github_user_ids`. A new contributor signs in again after their pull request is merged.
- **Governance (MVP mode):** While the MVP is built, the branch rulesets require a pull request and green CI but no approving review, so the maintainer can merge quickly. Deletion, force pushes and direct pushes stay blocked. Strict mode (1 approval + code owner review) returns before the public launch.
