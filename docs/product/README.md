# Product and domain overview

## Purpose

2004scape Combat Simulator helps compare combat setups, monsters, loot, supply costs, trip efficiency and training direction for Revision 274-era gameplay.

## Primary user workflows

- Choose combat type, levels, weapon, gear, monster and boosts.
- Read long selected setup values without losing them to compact control clipping.
- Open one selector and filter monsters, loadout items, spells, food, risk drops and
  Economy history choices from the search field inside its popup.
- Compare effective XP/hr, GP/hr, DPS, supply use and trip behavior.
- Compare player-plus-cannon spot rates with theoretical cannon-only DPS while
  keeping actual cannonball cost in the combined supply and net-GP result.
- Inspect and sort current-monster drops by name, action, hourly impact, expected
  value, chance, quantity or price before choosing alch/bury/keep/drop behavior;
  expanded random-table contents can also be sorted by their useful child and
  numeric columns.
- Value a random-herb `Loot` action from identified herb prices and an `Unid`
  action from the source-weighted unidentified item identities; when the active
  PriceSet lacks species-specific unid prices, show that the generic unid price
  is an approximation.
- Value an ordinary fishing casket as the expected value of opening its exact
  Revision 274 reward table, show all eight weighted content bands and keep the
  parent casket market/object price out of that opened value.
- Compare monsters under the current setup.
- Compare saved setups for the current monster and across all monsters, then
  sort the comparison by setup, monster or the visible outcome metric.
- Inspect modeled kill-time, food, trip and timed-profit ranges plus drop/GP target probabilities beside deterministic averages.
- Use the planner to estimate training order and gear unlock impact.
- Import or sync market prices when the relevant path is available.
- Look up player hiscores from the global header and apply previewed combat levels.

Visible legacy-vs-rewrite coverage is tracked in [feature-inventory.md](feature-inventory.md).

## V1 replacement scope

The rewrite can replace the current app for users only when these workflows are usable in the new architecture:

- combat simulator
- result summary
- monster compare
- loot/economy
- trip calculation
- planner

Hiscores is a required v1 product capability. D-061 accepts the first-party API and D-066 implements the Cloudflare Worker hosting model. D-067 accepts this repository implementation and its deployment runbook as complete; a future adopter must still collect deployed evidence before describing a specific instance as live.

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
- stateful simulation backend

Implemented optional integrations:

- repo-owned Hiscores lookup with local Vite and Cloudflare production adapters
- repo-owned market snapshot writer with numeric, item-provenance and versioned history outputs; D-099 currently disables its GitHub Actions schedule

The implementation target for those live integrations is [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md).

## Data confidence

The repo contains a mix of generated-looking data, inline provenance comments, placeholder prices, scraped price snapshots and manual approximations. When changing data, preserve source notes and update [../technical/architecture.md](../technical/architecture.md) or [../project/decisions.md](../project/decisions.md) if the source-of-truth policy changes.

Target data direction: use the current accepted LostCityRS/Content game revision as the primary game-content source when verified, generate one validated normalized current `GameDataSnapshot` for the app, and surface uncertain or approximated values as lightweight warning/info markers in the UI. The snapshot scope is only simulator-consumed domain data, not raw upstream content. Revision bumps are reviewed development changes through the accepted manual `npm run data:generate` workflow, not scheduled refreshes or a generated snapshot archive.

Random-herb identity and price confidence are separate. Revision 274 source
defines eleven weighted `unidentified_*` item identities. Exact active-PriceSet
prices for those identities take precedence. The scheduled market catalog
currently exposes only `unidentified_guam`, so missing species-specific unid
prices use that value as a shared proxy with a visible informational warning.

Active item prices retain numeric compatibility but now carry a separate
validated origin/freshness row. Economy distinguishes snapshot capture time
from item observation and refresh-evaluation times, shows observed quality,
retained/static/imported/generated counts and explains the selected item.
Retained, legacy and generated-fallback values remain usable; used values emit
bounded, deduplicated confidence notes instead of silently appearing fresh.
Only missing or explicit fallback values consumed by the current monetary
calculation create a compact Result issue. Loot keeps alternative-price context
beside the affected row, while Economy exposes every active issue and note in
one collapsed `Price data notes` disclosure. Exact one-GP coins and configured
but unused supplies do not create aggregate price noise.

Dynamic loot tables also publish their exact price dependency set from the
same Trip-domain descriptors that calculate their value. Market diagnostics
therefore show unmapped identified/unidentified herb, gem/mega, casket and
ultra-rare components instead of silently dropping them from coverage. D-087
adds the twelve source-reviewed identified gem/mega and ultra-rare components
to scheduled refresh, while the ten unsupported species-specific unidentified
herbs remain on the visible generic-unid proxy path. This changes refresh
coverage, not loot formulas or current numeric baselines.

Ordinary casket value is component-derived rather than a direct item price. The
current `Loot` action means open and value the contents; exact active component
prices flow through at calculation time, and generated source-cost fallback is
visible when a component price is missing. Whether to add a separate
`Sell unopened` action remains an open product decision.

## Rewrite product-scope notes

- Trip, loot and supply rules now have a pure rewrite-domain owner in `src/domain/trip`.
- Training planner rules now have a pure rewrite-domain owner in `src/domain/planner`.
- The root Vite rewrite UI now covers a selected parity slice: combat setup, result summary, loot/economy, trip, monster compare and planner.
- On desktop, the root workbench uses the accepted legacy-console shape: one viewport-bound three-zone shell with compact Player controls, the active workbench pane and MonsterCard scrolling independently. The narrower Player sidebar owns player inputs plus a read-only active weapon, stance/ammo/spell, effective-level, prayer, boost and requirement-status summary with navigation to the dynamically named Melee/Ranged/Magic setup tab and Stats. The selected-monster context bar owns the persistent DPS, effective XP/hr and net GP/hr summary, while Stats owns the detailed player/cannon XP routing. Tablet and mobile retain normal document flow.
- Three compact quick-navigation summaries distinguish active prayers/combat boosts from Trip-owned potion carry and prayer restore, show current values and jump directly to the owning setup, Trip or Loot pane. The redundant `Where to edit` intro copy is omitted. Negative net GP results explain the supply-vs-loot gap and link to the relevant controls.
- The legacy UI is archived at `legacy/index.html` and still has source files in `views.jsx`, `planner.jsx` and `planner-core.js` for reference/parity work.
- Current feature coverage and missing legacy workflows are tracked in [feature-inventory.md](feature-inventory.md).

## Product open questions

- Should a future release raise the accepted V1 parity bar beyond the completed visible workflows, and for which exact user path?
- Which known bugs should become documented intentional deltas instead of parity targets?
- Which custom domain, if any, should be added after the Cloudflare provider preview and live Hiscores evidence pass?

Setup/custom/Cannon/Duel migration and compatible preference/price import are
implemented under the accepted D-042 boundary. D-048 keeps legacy Planner state
review-only, D-049 does the same for full legacy price history and D-047 keeps
future/hypothetical Planner gear out of V1. Reopening any of those boundaries
requires a new explicit decision; they are not current product questions.
