# Hit distribution comparison visualization

Status: implemented on 2026-07-12 under D-083.

## Purpose

Replace the tall horizontal hit-bucket list with one compact discrete
probability chart. The chart should make the normal attack distribution easy to
scan and, when a separate special weapon is selected, make the two attack
events directly comparable without implying continuous damage values.

This specification extends the existing source-detail distribution work in
[stats-source-distribution-spec.md](stats-source-distribution-spec.md). That
document remains the source of truth for the currently implemented per-hit
special and per-cannonball detail distributions. This document owns the
implemented main comparison presentation and whole-special event contract.

## User questions the chart must answer

- What exact damage outcomes can the normal attack produce?
- How likely are a miss, an accurate zero and each positive damage value?
- How does a selected special weapon change the damage distribution?
- What is the expected damage of each attack event?
- What is the chance to deal at least a selected amount of damage?
- Can one normal attack or one complete special defeat the current full-HP
  target, and with what probability?

## Accepted presentation

Use a vertical discrete bar chart, not a connected probability line.

The user-facing section is named `Damage distribution` and lives at the end of
the dynamically labelled active setup tab (`Melee setup`, `Ranged setup` or
`Magic setup`), after the Special attack section. It is an outcome of that
setup, not a separate Stats input or a Trip/Economy result. Stats retains the
deeper combat-roll, XP-routing, Trip/banking and source-detail analysis.

- The horizontal axis contains the ordered categories `Miss`, `0`, `1`, `2`,
  and so on through the largest modeled outcome.
- The vertical axis is the probability of that exact outcome and always starts
  at zero.
- Normal attack uses filled teal bars.
- A selected special attack uses a gold outline or patterned bar over the same
  damage categories. It must remain distinguishable without color.
- Both series use one shared horizontal domain and one shared linear
  probability scale. Do not normalize either series independently.
- Bar gaps must preserve the fact that outcomes are discrete. Do not connect
  probability bars with a line or interpolate between integer outcomes.
- Axis labels may be thinned responsively, but every integer outcome remains a
  distinct interactive and accessible bucket.
- `Peak bucket` is removed from the summary. A simulation-noise peak is not a
  useful summary for an otherwise flat distribution.

When no supported special weapon is selected, render only the normal series.
Do not reserve empty space for a special series and do not infer a special from
the main weapon. The legend must identify an active special as a separate
weapon switch, for example `Special: Dragon dagger (switch)`.

## Event and probability contract

### Normal attack

The normal series represents one complete normal player attack.

Buckets represent uncapped modeled roll damage, matching the existing
expected-DPS contract. Target HP adds KO context but does not collapse overkill
outcomes into an applied-damage cap.

- `Miss` means the accuracy roll failed.
- `0` means the accuracy roll succeeded and the damage roll produced zero.
- Positive integer buckets represent their exact damage values.
- The probabilities of `Miss`, `0` and every positive bucket must sum to one
  within the domain's accepted floating-point tolerance.
- The displayed expected damage is the probability-weighted mean of all
  buckets, including miss and zero.

The current combined `Miss / 0` bucket must therefore be split in the domain or
view-model data before this presentation is implemented. The UI must not split
an already combined value by guesswork.

### Special attack

The comparison target is one complete activation of the separately selected
special weapon, not one component hit.

As with the normal series, the whole-special series represents uncapped modeled
roll potential. A target dying to an earlier component hit does not rewrite the
probability series; the target-HP threshold separately answers whether the
activation is lethal.

- A single-hit special uses the same bucket rules as a normal attack.
- A multi-hit special uses the distribution of the summed damage from all
  component hits in that activation.
- `Miss` means that no component accuracy roll succeeded.
- `0` means that at least one component accuracy roll succeeded but the summed
  damage remained zero.
- The maximum horizontal outcome is the maximum whole-special damage, not the
  existing per-hit maximum.
- The series probabilities and the expected whole-special damage must each
  agree with the accepted combat result within tolerance.

Pinned Revision 274 source verifies the supported multi-hit behavior used by
the current runtime. Dragon dagger and magic shortbow invoke their hit
procedures twice, and each procedure performs its own accuracy and damage
random rolls. Dragon halberd likewise performs two separate full-scale hit
procedure calls against a selected target only when NPC size is greater than
one; size-one targets retain one selected-target hit. D-083 therefore accepts
independent component rolls for the whole-special convolution. The existing
explicitly labelled `Per special hit` source detail remains available alongside
the whole-event comparison.

### Cannon

Cannon is not overlaid by default. One fired cannonball, one normal attack and
one complete special have different cadence and user meaning. The existing
explicitly scoped cannon detail remains available. A future
`Normal / Special / Cannon` view selector may reuse the chart only if its active
event scope stays visible and it never presents differently scoped series as a
single combined distribution.

## Summary and annotations

Keep the summary compact and derived from the same series data:

- `Hit chance`
- `Expected damage / attack` for the normal series
- `Max hit` as an integer
- active special name and `Expected damage / special` when applicable

Render a thin vertical expected-damage marker for each visible series. Markers
must use the same series label, color and non-color style as their bars. Because
an expected value can lie between integer outcomes, the marker may sit between
bars; it does not create a new damage bucket.

If target full HP is available, render a labelled target-HP threshold and shade
the outcomes at or above that threshold as the one-event KO region. Show a
separate KO probability for each visible series. If target HP exceeds the chart
domain, show `KO chance 0%` without extending the damage axis or drawing a false
in-range threshold. Do not label full monster HP as current remaining HP unless
the product later gains a real remaining-HP input.

Do not show a cumulative line by default. A second probability scale would add
visual ambiguity to the exact-outcome comparison.

## Interaction

Pointer hover or keyboard focus on a numeric bucket shows:

- series and event scope;
- exact damage;
- probability of exactly that damage;
- probability of at least that damage; and
- KO status against the displayed target-HP threshold, when applicable.

The `Miss` bucket shows its exact probability but no misleading `at least Miss`
value. A shared bucket interaction must expose both normal and special values
without requiring precise pointer placement on overlapping marks.

Tooltips are supplementary. The chart provides the same exact probabilities in
an on-demand `Show exact probabilities` table, and every interactive bucket has
a useful accessible name. Keyboard focus order follows the visual damage order.
Focus indicators, patterns and labels do not rely on color alone. Animation is
optional and must respect reduced-motion preferences.

## Responsive behavior

- Keep the category order and shared scale on every viewport.
- Prefer fewer printed axis labels before merging or binning exact outcomes.
- Preserve a practical pointer/focus target even when bars become narrow.
- If an extreme maximum hit cannot remain legible at the available width, use
  a bounded horizontal chart viewport with visible overflow affordance. Do not
  silently group exact integer outcomes into wider ranges.
- Summary metrics may wrap above the chart, but the plot and legend must not
  overlap or clip.

## State and architecture boundaries

- The chart consumes derived probability-series view models; React must not
  duplicate combat formulas.
- The main weapon and optional special weapon remain separate state. Changing
  the main weapon does not imply that it owns or clears the special weapon.
- No new persistence, import/export, network, provider or backend contract is
  required for the visualization itself.
- Invalid, unsupported or non-finite series fail closed. Render no fabricated
  zero distribution.
- The whole-special distribution belongs in the combat domain once its roll
  behavior is verified. The view model may format and combine chart metadata
  but must not invent probability mechanics.

## Validation

Domain and view-model tests must cover:

- separate miss and accurate-zero probabilities;
- probability sums and expected values for normal and single-hit special
  events;
- verified whole-special distributions for every supported multi-hit behavior
  class;
- shared axis and scale construction when normal and special maxima differ;
- cumulative `at least` values, including the maximum bucket;
- target-HP thresholds and zero/non-zero KO probabilities;
- absent, unsupported and invalid special states; and
- cannon remaining outside the default comparison.

Component and browser tests must cover:

- normal-only and normal-plus-special rendering;
- filled versus outline/pattern differentiation;
- hover and keyboard bucket detail;
- accessible names and non-color identification;
- responsive label thinning without outcome binning;
- target HP outside the plotted domain; and
- no unexpected horizontal page overflow at supported viewport fixtures.

Run at minimum:

```sh
npm run typecheck
npm run test -- src/tests/domain-core.test.ts src/tests/*-view-model.test.ts
npm run test:e2e -- --workers=1 -g "hit distribution"
git diff --check
```

Add or update the focused domain test path when the whole-special distribution
owner is implemented. Visual baseline changes require the repository's normal
explicit review workflow; they are never automatic failure recovery.

## Done criteria

- The tall horizontal bucket list is replaced by the discrete vertical bar
  chart.
- Miss and accurate zero are truthful separate outcomes.
- Normal attack is the only default series.
- A selected special weapon adds a clearly labelled whole-special comparison
  series using the D-083 verified component-roll contract.
- Expected-damage, cumulative tooltip and optional target-HP/KO values derive
  from the same probability data.
- Cannon remains separately scoped.
- Accessibility, responsive and focused calculation/browser checks pass.

## Open questions

- What maximum plotted bucket count remains legible before the bounded chart
  viewport is preferable on compact screens?
