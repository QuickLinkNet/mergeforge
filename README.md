# MERGEFORGE

**A persistent collaborative browser hexworld expanded through reviewed pull requests.**

> Project status: design and playable-MVP specification. Application development has not started yet.

MERGEFORGE begins as a deliberately small but complete strategy game: found a village, uncover a procedural hex world through roads, secure wood and stone, send out a Pathfinder, restore an ancient relay and receive the first signals from distant settlements.

Every approved extension can add new possibilities to the same living world: buildings, units, resources, automation, events, minigames, PvE, PvP or interface modules.

![Seven chapters on one continuous map](concept-art/phase-3/08-first-seven-days-continuous-map.png)

## Confirmed direction

- Visual style: **Diorama Lite**
- Platform: browser, with desktop and touch input in mind
- World: persistent and procedurally generated
- Expansion: connected road network and fog of war
- MVP resources: wood and stone
- First unit: Pathfinder
- First minigame: Signalworks
- Identity: internal MERGEFORGE player ID linked to GitHub for the MVP
- Contribution model: reviewed pull requests and backwards-compatible modules
- License: MIT

## Source of truth

- [`docs/MERGEFORGE_Project_Bible_and_Agent_Handoff.md`](docs/MERGEFORGE_Project_Bible_and_Agent_Handoff.md)
- [`docs/MERGEFORGE_Economy_Exploration_and_Time_Model.md`](docs/MERGEFORGE_Economy_Exploration_and_Time_Model.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch flow and pull-request contract
- [`docs/MERGEFORGE_Playable_Blueprint_v1.md`](docs/MERGEFORGE_Playable_Blueprint_v1.md) — first 15 minutes and screen contract
- [`docs/MERGEFORGE_World_and_Domain_Contract_v1.md`](docs/MERGEFORGE_World_and_Domain_Contract_v1.md) — deterministic world rules and minimal domain model
- [`docs/MERGEFORGE_MVP_Backlog_v1.md`](docs/MERGEFORGE_MVP_Backlog_v1.md) — small milestone and issue plan
- [`docs/MERGEFORGE_Technical_Foundation_Proposal_v1.md`](docs/MERGEFORGE_Technical_Foundation_Proposal_v1.md) — proposed M1 stack and architecture boundary

Older pitch material is kept for design history. When documents disagree, the hierarchy defined in the project bible applies.

## Current concept art

- [`concept-art/phase-2/04-style-a-diorama-lite.png`](concept-art/phase-2/04-style-a-diorama-lite.png) — confirmed visual direction
- [`concept-art/phase-2/07-minigame-signalwerk.png`](concept-art/phase-2/07-minigame-signalwerk.png) — first modular minigame
- [`concept-art/phase-3/08-first-seven-days-continuous-map.png`](concept-art/phase-3/08-first-seven-days-continuous-map.png) — valid spatial representation of the prologue
- [`concept-art/phase-4/09-playable-blueprint-four-screens.png`](concept-art/phase-4/09-playable-blueprint-four-screens.png) — current START, MAP, BUILD and PATHFINDER screen direction

## Implementation gate

The playable blueprint, MVP boundaries and technical foundation were approved by the project owner on 30 October 2026. Application code starts exclusively through an accepted M1 issue, a feature branch and a pull request into `dev`. M1 requires no local PHP server; a later backend will target the owner-provided online API and deploy through `npm run deploy`.
