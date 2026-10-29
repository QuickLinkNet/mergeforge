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

- **Status:** Accepted for MVP planning
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
