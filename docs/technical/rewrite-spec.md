# Rewrite specification

- Status: specification draft
- Owner: technical docs
- Date: 2026-07-06
- Scope: rewrite the current static 2004scape Combat Simulator into a maintainable, tested, typed architecture.

## 1. Purpose

This document is the implementation-grade specification for a future rewrite. It does not describe the current app as an ideal architecture. Current-state details live in [architecture.md](architecture.md); this file describes the target system and the path to get there.

The rewrite should be treated as a new implementation that preserves the same end-user workflows, not as a line-by-line preservation of legacy architecture or legacy calculation decisions. Legacy behavior is regression evidence; the current accepted LostCityRS/Content revision, accepted decisions and documented intentional deltas may supersede it.

The rewrite must preserve the useful user-facing behavior of the existing simulator while replacing the fragile parts:

- runtime JSX/Babel in the browser
- script-order dependencies
- global `window.*` module coupling
- domain logic reading browser state
- price data mutating shared globals
- UI state doubling as simulation input and saved setup data
- lack of repeatable tests

## 2. Current baseline

Verified current facts:

- The root app entrypoint is `index.html`, which mounts the Vite/React rewrite from `src/app/main.tsx`.
- The archived legacy entrypoint is `legacy/index.html`.
- React is bundled from npm dependencies through Vite on the root app path; runtime Babel and CDN React are no longer required for production.
- The archived legacy app uses plain `.js` and `.jsx` files loaded in script order.
- Archived legacy modules attach APIs to `window.GameData`, `window.SimEngine`, `window.TripModel`, `window.Equipment` and `window.SimPlanner`.
- Main UI is in `views.jsx`; planner UI is in `planner.jsx`.
- Data and prices are spread across `gamedata.js`, `prices.json`, `alch.json`, `price-history.json`, market imports and `localStorage`.
- A npm-based TypeScript/Vite/Vitest rewrite implementation owns the root app path in `src/`.
- No CI config, database or backend source exists in this checkout.
- Archived legacy UI references `/api/prices`, `/api/scrape`, `/api/hiscores` and `run_sim.py`. The production rewrite uses typed same-origin live integration endpoints with disabled default providers; `run_sim.py` is absent.

Do not infer a backend, database or deploy target from stale UI text.

## 3. Rewrite goals

The rewritten system should:

- run as a modern static-first web app
- use TypeScript with strict mode
- keep domain logic pure and testable outside the browser
- make data, prices and saved state explicit schemas
- make simulation outputs reproducible for a given input snapshot
- support golden tests against current behavior
- use the current accepted LostCityRS/Content game revision as the primary game-content source when the data can be verified
- support documented intentional deltas when the legacy app conflicts with better source evidence
- isolate browser APIs in adapter modules
- make future AI-agent changes small, bounded and verifiable

## 4. Non-goals for the first rewrite

Do not add these unless a human explicitly accepts the decision:

- user accounts or authentication
- database-backed saved setups
- server-side rendering
- public API
- scheduled backend market jobs
- shared cloud state
- marketplace/hiscores backend behavior beyond the accepted [live integrations spec](live-integrations-spec.md)

The first rewrite should be static-first and provider-agnostic. Do not lock the app to GitHub Pages, Netlify or another host until the live integration constraints are known. Add services only when the product requirement and hosting/runtime decision are confirmed.

## 5. Recommended technology stack

Use this stack unless a human changes the decision in [../project/decisions.md](../project/decisions.md).

| Area            | Choice                 | Why                                                                                                        |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript strict mode | The project needs explicit contracts for simulation input, data snapshots, prices and persisted state.     |
| UI              | React                  | The current UI is already React-like; preserving interaction patterns is easier than changing UI paradigm. |
| Build/dev       | Vite                   | Fits a static web app and provides dev server plus production bundling without a heavier framework.        |
| Unit tests      | Vitest                 | Good fit with Vite/TypeScript and fast domain tests.                                                       |
| Browser tests   | Playwright             | Covers smoke and end-to-end flows.                                                                         |
| Runtime schemas | Zod                    | Validates generated data, price snapshots, imports and saved state.                                        |
| Property tests  | fast-check, optional   | Use only for math invariants where generated cases add value.                                              |

Reference docs:

- [Vite guide](https://vite.dev/guide/)
- [React TypeScript guide](https://react.dev/learn/typescript)
- [TypeScript docs](https://www.typescriptlang.org/docs/)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright intro](https://playwright.dev/docs/intro)
- [Zod docs](https://zod.dev/)

## 6. Package and command specification

Preferred package manager: npm is used for the initial scaffold because no human preference was given and npm was the lowest-assumption default. Changing package manager remains an explicit future decision.

Required scripts:

```json
{
  "scripts": {
    "dev": "$NODE node_modules/vite/bin/vite.js --config vite.config.ts",
    "build": "$NODE node_modules/typescript/bin/tsc -b && $NODE node_modules/vite/bin/vite.js build --config vite.config.ts",
    "preview": "$NODE node_modules/vite/bin/vite.js preview --config vite.config.ts",
    "test": "$NODE node_modules/vitest/vitest.mjs run --config vitest.config.ts",
    "test:golden": "$NODE node_modules/vitest/vitest.mjs run --config vitest.config.ts src/tests/legacy-golden.test.ts",
    "test:watch": "$NODE node_modules/vitest/vitest.mjs --config vitest.config.ts",
    "fixtures:capture": "$NODE node_modules/vite-node/vite-node.mjs --config vitest.config.ts scripts/capture-legacy-golden.ts",
    "test:e2e": "playwright test",
    "typecheck": "tsc -b",
    "lint": "$NODE node_modules/eslint/bin/eslint.js .",
    "format:check": "$NODE node_modules/prettier/bin/prettier.cjs --check ."
  }
}
```

If linting/formatting tools are deferred, document that in [testing.md](testing.md) and do not claim the scripts exist.

## 7. Target source layout

Recommended layout:

```text
src/
  app/
    App.tsx
    routes/
    state/
    view-models/
  domain/
    combat/
    equipment/
    trip/
    economy/
    planner/
    shared/
  data/
    snapshots/
    schemas/
    generated/
  adapters/
    browser/
    market/
    storage/
  tests/
    fixtures/
    helpers/
public/
  data/
docs/
```

Rules:

- `src/domain/**` must not import from `src/app/**` or `src/adapters/**`.
- `src/domain/**` must not read `window`, DOM, `localStorage`, `fetch` or current time directly.
- `src/app/**` may depend on domain modules and browser adapters.
- `src/adapters/**` owns browser APIs, file import/export, fetch and local persistence.
- `src/data/**` owns schemas, generated snapshots and provenance metadata.

## 8. Architecture boundaries

### Domain core

Owns deterministic computation.

Inputs:

- `SimulationRequest`
- `GameDataSnapshot`
- `PriceSet`
- optional calculation options

Outputs:

- `SimulationResult`
- debug/intermediate values needed by UI
- structured warnings

Forbidden:

- reading or writing `localStorage`
- mutating shared game data
- fetching network resources
- depending on React
- depending on current browser globals

### Data layer

Owns game data snapshots and validation.

Target source:

- LostCityRS/Content is the primary source for generated game content when its files expose the needed truth.
- The app tracks one current accepted game revision at a time. It must not silently follow the latest available upstream revision.
- A `GameDataSnapshot` must identify the game revision, upstream source reference, generator version and generation time.
- A full 100% truth source is not assumed; gaps must be represented through provenance, warnings or open questions.
- The v1 `GameDataSnapshot` scope is staged: include calculation-required data for combat, loot, economy, trip and planner first, and keep the format extensible for later content areas.
- The committed `GameDataSnapshot` is a normalized, purpose-built runtime snapshot for this simulator. It must not mirror raw LostCityRS/Content files or carry source areas that are not needed by the accepted app scope.
- V1 included scope: monster definitions, item identity/stackability/equipment metadata needed by app workflows, equipment registry, weapons, ammo, spells, drop rows and nested drop expansions, planner/loadout item requirements, and provenance/warning metadata for generated, manual, approximate or uncertain values.
- V1 excluded scope: raw upstream file bodies, source-only NPC/dialog/quest/world/map content, historical revisions, unused future content areas, speculative fields not consumed by current domain/UI workflows and market price history. Current prices remain owned by `PriceSet` and the market price workflow, not by the generated game-data snapshot.
- The accepted generator entrypoint is `npm run data:generate`. It should read the pinned local `.sources/lostcity-content/` checkout and overwrite `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`.
- Keep only the current accepted generated snapshot in the working tree. Do not add historical generated snapshot files; older accepted snapshots remain available through git history and PR diffs.
- Game revision bumps are development changes. They must happen through a reviewed PR with generated snapshot diffs, validation, test/golden impact and explicit accepted calculation deltas.
- Do not add scheduled or automatic main-branch game-data updates.

`docs/project/revision-impact/current.md` report requirements:

- old accepted source revision/commit and new source revision/commit
- generator version, command and generated-at timestamp
- added, removed and changed monsters, items, equipment, weapons, ammo, spells, drop rows and nested drop expansions
- planner/loadout requirement changes
- provenance, manual-value, approximation and warning changes
- representative calculation diffs for DPS, kills/hr, XP/hr, GP/hr and GP/XP from the merge-blocking hybrid suite
- informational broad all-monster scan summary and notable outliers
- explicit list of accepted intentional deltas
- validation commands and pass/fail status
- unresolved questions or required follow-up code/test changes

Revision bump merge gate:

- The revision-impact report must be committed in the PR.
- Generated data, source pin and report must refer to the same source revision.
- Any changed calculation output must be either accepted as an intentional delta in the report/decision log or fixed in code/tests before merge.
- The broad all-monster scan is informational by default; it blocks merge only when a reviewer promotes a finding to a required fix or accepted decision.
- A failed validation command blocks merge unless a human records a scoped exception as an accepted decision.

Hybrid calculation-impact suite:

- Merge-blocking representative suite starts from the current combat/trip/economy golden fixtures and planner golden fixtures.
- Add focused generated-data cases when the existing fixtures do not cover cannon, recoil, alch, loot-heavy, high-defence and low-level behavior.
- Report DPS, kills/hr, XP/hr, GP/hr and GP/XP deltas for each representative case.
- Informational scan runs exactly one fixed simple melee, one fixed simple ranged and one fixed simple magic baseline setup across all generated monsters.
- Informational scan baselines are explicit review fixtures, not best-in-slot search, optimizer output or gear progression.
- Informational scan notable outliers are DPS, kills/hr or XP/hr changes over 10%, GP/hr or GP/XP changes over 25%, missing required combat/drop/economy data, warning-count increases and monsters entering or leaving the scan.
- The exact case file format and concrete item/spell/equipment ids for the baseline setups are implementation details still to build, but the blocking/informational split and threshold policy are accepted.

Responsibilities:

- monster definitions
- item definitions
- equipment definitions
- drop tables
- source metadata
- confidence/provenance flags
- schema validation

Each data record that is not fully generated from a verified source should be able to carry:

```ts
type DataProvenance = {
  source: "generated" | "manual" | "scraped" | "approximation" | "hypothetical";
  sourceRef?: string;
  revision?: string;
  verifiedAt?: string;
  notes?: string;
};
```

### Economy layer

Owns prices and alch values.

Accepted target source:

- Use `markets.lostcity.rs` as the target source for live/current market prices.
- The accepted history direction is to keep a latest `PriceSet` plus retained 12-hour price history snapshots.
- Market refresh is scheduled-only repo automation. It writes `prices.json`, `alch.json` and `price-history.json`, validates them and commits only real diffs.
- The scheduler is GitHub Actions cron at 00:15 and 12:15 UTC, using the repository `GITHUB_TOKEN` with `contents: write` and no `workflow_dispatch` manual trigger.
- Do not add databases, user-triggered upstream refresh or deploy-specific shared storage for market prices.
- The writer implementation and exact upstream response contract are not present yet.

Core model:

```ts
type PriceSet = {
  id: string;
  label: string;
  source: "bundled" | "imported" | "scraped" | "manual";
  createdAt: string;
  itemPrices: Record<ItemId, number>;
  alchValues: Record<ItemId, number>;
  provenance?: DataProvenance;
};
```

Rules:

- Simulation must receive a `PriceSet`; it must not discover one from browser state.
- Imported prices must be validated before use.
- Missing prices must produce structured warnings, not silent global fallback mutation.
- Shared price history snapshots are file-backed in `price-history.json`; the concrete scheduled writer is not implemented yet.

Current implementation note: `src/data/schemas` validates `GameDataSnapshot`, item/drop/equipment data, `PriceSet` imports and committed price history. `src/data/legacy-adapter.ts` can adapt the current legacy runtime objects into a validated snapshot. `src/domain/economy` provides pure lookup helpers that return structured missing-price or missing-alch warnings without mutating the `PriceSet`.

### Browser adapter layer

Owns:

- `localStorage` reads/writes
- persisted state migration
- file imports and exports
- optional market fetch
- browser-specific bootstrapping

Persisted data must be versioned:

```ts
type PersistedEnvelope<T> = {
  version: number;
  savedAt: string;
  data: T;
};
```

### UI layer

Owns interaction, layout and presentation.

Rules:

- UI form state is not the same type as `SimulationRequest`.
- Saved setup state is not the same type as current UI state.
- View models should adapt domain results for display.
- Uncertain, missing or approximated data should be shown as lightweight info/warning markers near affected results, with details available in a tooltip or details panel.
- Expensive compare/planner work should run through a worker-compatible calculation runner boundary. The first implementation may run on the main thread with memoization and debouncing, but it must be movable to a Web Worker if performance budgets fail.

## 9. Core contracts

These are conceptual contracts. Final fields should be refined while porting behavior.

```ts
type CombatStyle = "melee" | "ranged" | "magic";

type SimulationRequest = {
  combatStyle: CombatStyle;
  levels: PlayerLevels;
  monsterId: MonsterId;
  loadout: Loadout;
  boosts: BoostSelection;
  prayers: PrayerSelection;
  lootPolicy: LootPolicy;
  tripPolicy: TripPolicy;
  economy: {
    priceSetId: string;
  };
};

type SimulationContext = {
  gameData: GameDataSnapshot;
  priceSet: PriceSet;
};

type SimulationResult = {
  dps: number;
  killsPerHour: number;
  xpPerHour: XpBreakdown;
  grossGpPerHour: number;
  netGpPerHour: number;
  supplyCostPerHour: number;
  trip: TripResult;
  loot: LootResult;
  warnings: SimulationWarning[];
  debug?: SimulationDebug;
};
```

Current implementation note: `src/domain/shared/index.ts` now defines the first typed contracts. The implemented `SimulationResult` is a combat/equipment slice result. `src/domain/trip` now produces a separate typed `TripLootSupplyResult` for trip, loot, supply and effective GP outputs. `src/domain/planner` now produces a typed `PlannerPlan` using those domain slices. `src/app/view-models` composes these slices for the first React UI parity path. A single final domain-level full simulator result remains open.

Acceptance rule: for a fixed `SimulationRequest`, `GameDataSnapshot` and `PriceSet`, the result must be deterministic.

## 10. Feature parity requirements

V1 replacement scope requires the user to complete these current workflows:

- combat setup and simulation
- result summary
- monster compare
- loot/economy evaluation
- trip modeling
- planner recommendations

The rewrite should preserve or intentionally replace these current capabilities inside that scope:

- melee, ranged and magic simulation
- weapon stance and attack type handling
- prayers, boosts, potions and specials
- cannon and ammo cost modeling
- monster comparison
- loot valuation and action policies
- alch value handling
- trip/inventory/banking model
- price import/snapshot behavior
- planner training recommendations
- saved local setup behavior, if migration is accepted

Hiscores lookup is also a v1 product requirement, but its final upstream API, direct-fetch/proxy model and production hosting remain open. Keep hiscores behind the adapter/API boundary in [live-integrations-spec.md](live-integrations-spec.md) until the upstream answer is known.

Known bugs from `PROJECT_REVIEW_NOTES.md` should be triaged before golden fixtures are captured. Decide whether each bug is:

- preserved temporarily for parity
- fixed before fixture capture
- documented as an accepted behavioral change

## 11. Testing specification

Minimum test suites for the rewrite:

### Golden current-behavior tests

- Capture 15 to 30 representative cases from current `SimEngine.simulate()`.
- Include melee, ranged, magic, cannon, alch, high-value loot, low-value loot, trip-limited and inventory-limited cases.
- Store fixture inputs and expected core outputs with numeric tolerances.

Current captured baseline:

- `src/tests/fixtures/legacy-golden.json` contains 18 cases.
- Case definitions live in `src/tests/fixtures/legacy-case-definitions.ts`.
- The VM adapter lives in `src/tests/helpers/legacy-sim.ts`.
- Run with `npm run test:golden`.
- Regenerate only after an accepted baseline change with `npm run fixtures:capture`.
- Known current bugs are triaged in [../project/bug-triage.md](../project/bug-triage.md).

### Unit tests

Required areas:

- hit chance and max hit formulas
- stance/attack type selection
- prayer and potion modifiers
- equipment bonus summing
- loot policy decisions
- stackability
- trip duration and supply consumption
- price-set lookup and missing-price warnings
- planner gear eligibility and scoring

Current implemented unit coverage includes combat/equipment rules in `src/tests/domain-core.test.ts`, data/economy validation in `src/tests/data-economy.test.ts`, trip/loot/supply rules in `src/tests/trip-loot-supply.test.ts`, planner rules in `src/tests/planner-domain.test.ts`, Planner UI state/adapters in `src/tests/planner-ui-state.test.ts` and `src/tests/planner-ui-adapter.test.ts`, and rewrite UI/adapters in `src/tests/ui-view-model.test.ts` and `src/tests/ui-adapters.test.ts`.

### Schema tests

Validate:

- bundled game data snapshot
- price snapshots
- imported price files
- persisted setup envelope
- planner state envelope

Current implemented schema coverage:

- `src/tests/data-economy.test.ts` validates the adapted legacy game-data snapshot.
- The same test validates committed `prices.json`, `alch.json` and `price-history.json`.
- The same test rejects malformed imported `PriceSet` JSON and checks missing-price warnings.
- `src/tests/planner-ui-state.test.ts` validates the versioned rewrite Planner UI state envelope, default state, invalid/version fallback and gear-pool id cleanup against the active planner pool.
- `src/tests/ui-adapters.test.ts` validates the new rewrite setup envelope, invalid envelope/data rejection and version-mismatch behavior.
- `src/tests/legacy-migration.test.ts` validates legacy storage detection, invalid legacy setup state handling, safe `sim_input_v3` setup mapping, compatible legacy hiscores player import, compatible legacy price/alch `PriceSet` creation, malformed/oversized/unknown price skips, price-history detection without mutation and known-key clearing behavior.
- `src/tests/e2e/scaffold.spec.ts` covers the user-facing legacy import/keep/clear flow, including setup, last-player and explicit `PriceSet` import while preserving legacy setup, price, history and hiscores keys.
- Legacy planner/custom setup/loot prefs/compare/cannon/hidden tiers and full price-history migrations remain future work.

### Trip, loot and supply parity tests

- `src/tests/trip-loot-supply.test.ts` compares the new trip/loot/supply domain against all 18 golden fixture cases.
- The parity scope includes GP, supply costs, prayer XP, trip bounds, banking efficiency, incoming damage, top loot rows, cannon occupancy and cannonball supply.
- Planner results, market sync and browser persistence are outside this parity slice.

### Planner golden tests

- `src/tests/planner-domain.test.ts` verifies planner gear eligibility, candidate-weapon stance selection, missing future/unknown weapon handling and deterministic plan summaries.
- `src/tests/fixtures/planner-golden.json` stores 3 golden plan summaries for melee, ranged and magic unlock paths.
- Planner scoring uses `simulateCombat`, combat XP breakdowns and `simulateTripLootSupply`; it must not reimplement hit chance, max hit, equipment bonus or stance truth.
- Planner UI wiring now has a basic workbench tab path for metric, current XP, target levels, skill locks, Recompute, summary and training-order output. Gear pool editor, timeline/chart views, legacy planner state migration, full legacy planner parity and Web Worker performance remain future work.

### Browser tests

Playwright smoke tests cover:

- app loads
- rewrite workbench shell renders
- setup and simulation result regions render
- loot/economy, compare and planner regions render
- changing combat style updates the visible setup path
- Planner tab metric/current-XP/target/skill-lock/Recompute flow renders a training order and persists rewrite-owned Planner UI state

Future Playwright smoke tests should cover:

- user can select monster and loadout
- changing key numeric inputs updates result values
- compare view renders
- price import error path is understandable

### Performance tests and budgets

V1 uses a measurable performance budget:

- normal single-input updates should complete in about 100 ms in representative local runs
- heavy compare/planner work must not block the UI in chunks longer than about 200 ms
- if compare/planner fails this budget, move that work behind the runner boundary into a Web Worker

Tests or instrumentation should cover the level-input path that previously caused visible jank, plus representative compare/planner workloads.

## 12. Migration plan

### Phase 0: freeze and document

- Keep current app running.
- Capture current source map and known issues.
- Decide which known bugs to fix before fixture capture.

### Phase 1: toolchain skeleton

- Add TypeScript, React, Vite, Vitest and Zod.
- Add scripts from this spec.
- Add empty domain modules and test harness.
- Keep current app untouched or mounted behind a legacy route until parity exists.

### Phase 2: golden fixtures

- Build a small adapter that can call current `SimEngine.simulate()`.
- Capture representative fixtures.
- Commit fixtures and tolerance rules.

Current checkout status: Phase 2 baseline exists for `SimEngine.simulate()` fixtures, and planner-domain golden summaries exist for three rewrite unlock paths. New rewrite setup persistence has version tests. Market sync and hiscores same-origin contracts, disabled-provider boundaries, adapters and mocked UI tests exist; production runtime/upstream choices, legacy planner UI state and legacy `localStorage` migration fixtures are still open decisions.

### Phase 3: domain extraction

- Port combat formulas into `src/domain/combat`.
- Port equipment and trip logic into dedicated modules.
- Make `SimulationRequest`, `GameDataSnapshot` and `PriceSet` explicit.
- Run golden tests after each ported slice.

Current checkout status: Phase 3 is partially started. `src/domain/combat` and `src/domain/equipment` contain pure TypeScript logic for the combat/equipment slice and are covered by `src/tests/domain-core.test.ts`. `src/domain/trip` contains pure TypeScript logic for the trip/loot/supply slice, including cannon occupancy/overlay, and is covered by `src/tests/trip-loot-supply.test.ts`. `src/domain/planner` contains pure TypeScript planning logic and is covered by `src/tests/planner-domain.test.ts`. Final full-result composition is not ported yet.

### Phase 4: data and economy

- Move game data into validated snapshots.
- Create source/provenance fields.
- Move price loading into `src/economy` and browser adapters.
- Remove global price mutation from the core path.

Current checkout status: Phase 4 is partially started. Zod schemas, a legacy snapshot adapter, browser sandbox bootstrap, `PriceSet` validation, committed price-file validation, validated rewrite price-file import, typed same-origin market sync validation and pure missing-price warning helpers exist. Legacy `market.js` remains archived evidence; the authoritative generated data workflow is still open.

### Phase 5: UI rebuild

- Build React UI against view models.
- Keep workflows familiar but split state types.
- Add persisted state migration or explicit reset.
- Add Playwright smoke tests.
- For full replacement, follow [ui-parity-spec.md](ui-parity-spec.md) so layout, tab order and workflow discoverability match the legacy workbench.

Current checkout status: Phase 5 has a first selected parity UI. `src/app` renders combat setup, result summary, special attack controls/metrics, loot/economy, trip, monster compare, planner and service-aware hiscores/market controls through `src/app/view-models`, but its layout and workflow grouping do not yet match the legacy workbench. The full UI parity target is now documented in [ui-parity-spec.md](ui-parity-spec.md), and feature coverage is tracked in [../product/feature-inventory.md](../product/feature-inventory.md). The rewrite uses new versioned keys such as `index-sim:rewrite-setup`, `index-sim:hiscores:last-player` and `index-sim:price-history`. It now detects known legacy keys and shows a user-facing import/keep/clear flow. Import writes only rewrite-owned setup, last-player, accepted-price-history and dismissed state and keeps legacy keys; keep writes only rewrite-owned dismissed state; clear removes only known legacy keys after explicit confirmation. Legacy planner/custom setup/loot prefs/compare/cannon/hidden tiers and full price-history migrations remain future work.

### Phase 6: legacy removal

- Remove runtime Babel/CDN dependency.
- Remove `window.*` compatibility layer.
- Remove stale `ArchitectureBoard` or replace it with a docs link.
- Update docs and decisions.

Current checkout status: Phase 6 is partially complete. Root `index.html` is now the Vite rewrite entrypoint, the old CDN/Babel HTML is archived at `legacy/index.html`, and the stale `ArchitectureBoard` content in `views.jsx` has been replaced with docs links. The production app path no longer requires runtime Babel, CDN React or real script-order `window.*` loading. Legacy source files remain in the repo because golden fixtures and the current browser bootstrap still use trusted bundled legacy sources to produce the validated data snapshot. Deleting those files requires a separate acceptance decision after full parity and an authoritative generated data workflow exist.

## 13. Acceptance criteria

The rewrite is architecturally acceptable when:

- `npm run build` passes.
- `npm run typecheck` passes.
- `npm run test` passes.
- Playwright smoke tests pass.
- Golden fixtures pass or documented intentional deltas are accepted.
- The v1 replacement workflows work: combat, result summary, monster compare, loot/economy, trip and planner.
- The measurable performance budget passes or the worker upgrade is completed for the failing workload.
- Security checks and dependency audit pass or residual risks are documented.
- Domain code has no browser API dependencies.
- Data and price imports are schema-validated.
- Current state, target plan, accepted decisions and open questions are updated in docs.

Current acceptance status: the 2026-07-06 consolidated release-evidence pass is recorded in [rewrite-parity-report.md](rewrite-parity-report.md). Build, typecheck, unit tests, golden fixtures, Playwright smoke, dependency audit, static security searches and release-copy classification passed for the current rewrite path, with classified residuals and explicit `not run` scope for live upstream calls and full visual regression. Re-run the same gate after each release-impacting change. Full user replacement remains gated by feature coverage in [../product/feature-inventory.md](../product/feature-inventory.md), deeper legacy migration decisions, authoritative generated data workflow, production live market/hiscores runtime and provider wiring, deploy/security-header acceptance and any broader all-fixture browser-display or visual-regression evidence that a future release decision requires.

## 14. Open decisions

- Initial scaffold uses npm; changing away from npm remains an open future decision.
- Backend/runtime: still required for accepted hiscores if direct browser APIs are not viable, but concrete framework, hosting, cache and deployment shape remain undecided. Market price refresh uses scheduled static JSON instead of a user-triggered backend sync path.
- Database: no database for market price refresh; broader database use is still undecided.
- Live integrations: implement hiscores and market price refresh according to [live-integrations-spec.md](live-integrations-spec.md); hiscores waits for the authoritative API answer.
- Price history: 12-hour retained snapshots live in `price-history.json`; the GitHub Actions scheduled writer and exact upstream response contract are not implemented yet.
- Data generator implementation: `npm run data:generate` is the accepted target entrypoint, output path policy and high-level snapshot scope, but the generator script and exact normalized field schema are not implemented yet.
- Game revision updates: the PR/review policy, report format and hybrid calculation-impact suite shape are accepted, but the generator implementation, case file format and concrete item/spell/equipment ids for the fixed scan baselines are not present yet.
- Local storage: migrate old keys or reset on rewrite?
- Cannon UI parity: where should cannon settings and overlay metrics live in the final workbench?
- Full result composition: how should combat/equipment, trip/loot/supply and economy slices be exposed to the future React view models?
- Planner item requirements: manual policy for now, or generated from authoritative item configs?
- Future weapons: keep hidden until present in canonical data, or expose behind an explicit product toggle with hypothetical provenance?
- UI language: keep English UI or localize?
- Historical revisions: keep one current accepted revision only, or later support user-selectable historical revisions?

## 15. AI-agent implementation rules

Future agents implementing this rewrite should:

- start from [../../AGENTS.md](../../AGENTS.md)
- read this spec and [architecture.md](architecture.md)
- keep changes in small vertical slices
- add tests before replacing a behavior-heavy module
- never introduce a backend/database/auth system without a recorded decision
- update this spec when a target contract changes
- update [testing.md](testing.md) when commands become real
- update [../project/decisions.md](../project/decisions.md) when a recommendation becomes accepted
