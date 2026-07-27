# Stats source distribution specification

- Status: implemented
- Date: 2026-07-11
- Owner: technical documentation
- Evidence: verified
- Contract: closed

The implemented event-scoped source-detail histograms in this document remain
current-state truth. The discrete vertical normal-versus-special main
comparison and the D-083 whole-special event contract are implemented as
specified in
[hit-distribution-visualization-spec.md](hit-distribution-visualization-spec.md).

## Purpose

Add the bounded next phase of the existing `Valmis` Stats source-detail workflow:
probability distributions for supported special attacks and an actively firing
cannon. This closes the explicit `later` item in the UI parity and rewrite
parity documents without introducing a second combat formula path.

## Existing behavior

- The active setup tab ends with the normal-versus-selected-special main
  `Damage distribution`; Stats keeps the separately scoped source-detail
  distributions owned by this document.
- Special source detail already exposes hit chance, per-hit max hit, hit count
  and expected damage per special through `SpecialAttackResult`.
- Cannon source detail already exposes the player hit chance used by the
  overlay, cannon maximum ball hit, balls per second and cannon DPS.
- `src/domain/combat.createHitDistribution()` owns the accepted single-event
  probability bucket model.
- Inactive or unsupported special/cannon detail currently carries a `null`
  histogram.

## Distribution contract

### Supported special attack

The histogram represents **one hit within the selected special attack**.

- Hit chance comes from `SpecialAttackResult.hitChance`.
- Maximum hit comes from `SpecialAttackResult.maxHit`.
- Average damage per hit is `SpecialAttackResult.expPerSpec / hits` when the hit
  count is positive.
- The existing `createHitDistribution()` function builds the buckets.
- Multi-hit specials retain their visible hit count, but this goal does not
  convolve independent hit rolls or claim a whole-special total-damage
  distribution.

### Active cannon

The histogram represents **one fired cannonball**.

- Hit chance is the current combat hit chance already used by the cannon
  overlay.
- Maximum hit is `CannonOverlayResult.maxBall`.
- Average damage per fired ball is `cannonDps / ballsPerSec` when balls per
  second is positive.
- The existing `createHitDistribution()` function builds the buckets.
- This goal does not model a kill-level, trip-level or hourly cannon damage
  distribution.

### Unavailable states

- No selected/supported DPS special: special histogram remains `null`.
- Cannon off or idle with no fired cannonballs: cannon histogram remains
  `null`.
- A partial special result may show its modeled per-hit distribution while
  retaining the existing partial warning and status.
- Invalid or non-finite inputs fail closed to `null`; the UI must not render a
  fabricated zero distribution.

## View-model and UI

- `StatsSourceDetailViewModel.histogram` remains the transport contract.
- Source detail cards render a compact histogram only when `histogram` is not
  `null`.
- The panel copy must name its event scope: `Per special hit` or
  `Per fired cannonball`.
- Summary values show hit chance, average damage and max hit.
- Bucket rows retain accessible probability labels and max-hit markers.
- The normal-player histogram remains unchanged and continues to use the same
  reusable presentation component.

## State and security boundaries

- No persistence, import/export or `SimulationRequest` change.
- No raw provenance, source paths or parser issues are exposed.
- No network, provider, auth, tenant, database or user-triggered refresh work.
- Histogram values are transient derived view-model output only.

## Tests

- View-model tests cover active melee/ranged specials, multi-hit per-event
  scope, active cannon, probability totals and inactive/idle null states.
- Focused Playwright verifies visible scoped special and cannon histograms in
  Stats without depending on live upstream services.
- Run typecheck, focused unit tests, `git diff --check` and the full repository
  verification gate before delivery.

## Documentation

- Update the feature inventory Stats note while keeping status `Valmis` because
  this is a bounded extension of the existing workflow.
- Close the special/cannon distribution `later` row in UI/rewrite parity and
  backlog evidence.
- Record the event-scope decision in `docs/project/decisions.md`.

## Done criteria

- Supported special and active cannon source details show truthful event-scoped
  histograms from existing domain results.
- Inactive and invalid states remain non-fatal and do not show fake data.
- Normal attack distribution behavior remains unchanged.
- Tests and owning documents pass, then the goal is committed and pushed before
  Goal 3 begins.
