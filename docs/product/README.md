# Product and domain overview

## Purpose

2004scape Combat Simulator helps compare combat setups, monsters, loot, supply costs, trip efficiency and training direction for Revision 274-era gameplay.

## Primary user workflows

- Choose combat type, levels, weapon, gear, monster and boosts.
- Compare effective XP/hr, GP/hr, DPS, supply use and trip behavior.
- Inspect loot value and alch/bury/keep/drop choices.
- Compare monsters under the current setup.
- Use the planner to estimate training order and gear unlock impact.
- Import or sync market prices when the relevant path is available.
- Look up player hiscores and apply combat levels once the accepted live integration path is implemented.

Visible legacy-vs-rewrite coverage is tracked in [feature-inventory.md](feature-inventory.md).

## V1 replacement scope

The rewrite can replace the current app for users only when these workflows are usable in the new architecture:

- combat simulator
- result summary
- monster compare
- loot/economy
- trip calculation
- planner

Hiscores is a required v1 product capability. D-061 accepts the first-party API and D-066 implements the Cloudflare Worker hosting model; account connection and deployed evidence remain pending.

## Domain areas

- Combat math: hit chance, max hit, attack speed, prayers, potions, specials, cannon and XP.
- Game data: monsters, drops, item values, alch values and source revision notes.
- Equipment: gear slots, bonuses and requirements.
- Trip model: food, potions, inventory slots, stackability, banking time and incoming damage.
- Economy: price snapshots, live/imported prices, alch values and price history.
- Planner: training order and gear unlock optimization.

## Functional boundaries

Current app does not provide:

- user accounts or auth
- database-backed saves
- authoritative server API
- repo-owned backend or deploy process

Accepted future product features:

- repo-owned hiscores lookup integration
- repo-owned live market sync integration

The implementation target for those live integrations is [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md).

## Data confidence

The repo contains a mix of generated-looking data, inline provenance comments, placeholder prices, scraped price snapshots and manual approximations. When changing data, preserve source notes and update [../technical/architecture.md](../technical/architecture.md) or [../project/decisions.md](../project/decisions.md) if the source-of-truth policy changes.

Target data direction: use the current accepted LostCityRS/Content game revision as the primary game-content source when verified, generate one validated normalized current `GameDataSnapshot` for the app, and surface uncertain or approximated values as lightweight warning/info markers in the UI. The snapshot scope is only simulator-consumed domain data, not raw upstream content. Revision bumps are reviewed development changes through the accepted manual `npm run data:generate` workflow, not scheduled refreshes or a generated snapshot archive.

## Rewrite product-scope notes

- Trip, loot and supply rules now have a pure rewrite-domain owner in `src/domain/trip`.
- Training planner rules now have a pure rewrite-domain owner in `src/domain/planner`.
- The root Vite rewrite UI now covers a selected parity slice: combat setup, result summary, loot/economy, trip, monster compare and planner.
- The legacy UI is archived at `legacy/index.html` and still has source files in `views.jsx`, `planner.jsx` and `planner-core.js` for reference/parity work.
- Current feature coverage and missing legacy workflows are tracked in [feature-inventory.md](feature-inventory.md).

## Product open questions

- Which v1 workflows need exact legacy UI parity versus improved UI with the same end-user capability?
- Which known bugs should become documented intentional deltas instead of parity targets?
- Which custom domain, if any, should be added after the Cloudflare provider preview and live Hiscores evidence pass?
- Should saved setups survive the rewrite through migration?
- Should future/hypothetical planner gear be exposed at all before it exists in canonical data?
- Should legacy browser setup keys be migrated into the rewrite UI, or left as legacy-only state?
