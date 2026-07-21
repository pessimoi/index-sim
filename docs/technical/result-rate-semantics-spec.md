# Result rate semantics specification

- Status: implemented 2026-07-21
- Priority: critical
- Estimated effort: M
- Owner: composed-result presentation view models and Compare/Duel presenters
- Feature-inventory parents: Result summary, Dense spreadsheet comparison,
  Setup comparison, Trip and Planner (`Valmis`)
- Depends on: the current `FullSimulationResult` combat, Trip and XP rate
  contract
- Executable goal:
  [PF-01 · Consistent result rate semantics](../project/goals/pf-01-result-rate-semantics.md)

## Purpose

Give every primary decision surface one consistent whole-cycle interpretation
of hourly rates. A user comparing the headline Result, Dense rows, saved setups,
Trip and Planner must not have to know that adjacent values currently use two
different time bases.

The domain already calculates both rate bases. This work changes selection,
labels and explanatory copy in presentation models; it does not change combat,
Trip, loot, supply, XP or Planner formulas.

## Verified current behavior and problem

`FullSimulationResult` deliberately exposes both pre-banking and effective
rates:

- `rates.killsPerHour` is the modeled combat-site kill-cycle rate before Trip
  banking/travel efficiency. It can already include current combat, cannon and
  scarce-spot constraints.
- `rates.gpPerHour` is gross `GP/kill × killsPerHour` before loot-retention and
  whole-trip efficiency.
- `rates.effectiveKph` is the sustained whole-cycle kill rate after Trip
  efficiency.
- `rates.effectiveGpPerHour` is sustained gross loot after loot-retention and
  whole-trip efficiency.
- `rates.effectiveNetGpPerHour` is sustained net GP after modeled supplies and
  whole-trip efficiency.
- `xp.effectiveXpPerHour` is the sustained whole-cycle player and cannon XP
  rate.

The root metric strip in `createWorkbenchResultViewModel()` currently combines
`killsPerHour` and `gpPerHour` with `effectiveXpPerHour` and
`effectiveNetGpPerHour`. Dense Compare and saved-setup rows repeat that mixed
basis. The Trip pane separately labels `effectiveKph`, while the Stats detail
calls `killsPerHour` a rate “after Trip and banking effects” even though it is
the pre-banking field.

The values are individually valid, but their adjacency and abbreviated labels
make them look directly comparable. This can change which monster or setup a
user selects and is therefore a semantic correctness issue, not only a copy
polish item.

## Feature-inventory boundary

All parent workflows remain `Valmis`. The gap is a newly identified quality
issue over implemented results and comparisons; it is not a partial formula or
missing product feature.

This specification supersedes ambiguous hourly presentation wording only. It
does not supersede:

- `FullSimulationResult` ownership in `src/domain/simulation`;
- Trip efficiency, cannon occupancy or scarce-spot formulas;
- Planner's existing effective-rate optimization inputs;
- Risk distribution ownership; or
- the user-facing unit and abbreviation rules in
  `user-facing-language-units-information-hierarchy-spec.md`.

## Semantic contract

### Rate bases

Use exactly these user-facing concepts:

| Concept               | Domain value                  | Meaning                                                                                   |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| On-site kills/hr      | `rates.killsPerHour`          | Modeled kill-cycle rate while at the combat spot, before banking/travel efficiency        |
| On-site gross GP/hr   | `rates.gpPerHour`             | Gross value at the on-site kill rate, before loot-retention and banking/travel efficiency |
| Effective kills/hr    | `rates.effectiveKph`          | Sustained kills over the complete modeled Trip cycle                                      |
| Effective gross GP/hr | `rates.effectiveGpPerHour`    | Sustained retained gross loot over the complete modeled Trip cycle                        |
| Effective net GP/hr   | `rates.effectiveNetGpPerHour` | Sustained retained loot less modeled supplies over the complete modeled Trip cycle        |
| Effective XP/hr       | `xp.effectiveXpPerHour`       | Sustained modeled combat XP over the complete Trip cycle                                  |

“Theoretical” must not be the default label for `killsPerHour`: cannon and
scarce-spot constraints can already make it more specific than a pure combat
maximum. “On-site” is the required contrast with “effective”.

“GP/hr” without a qualifier is not sufficient when both bases can appear in the
same pane. A compact visible abbreviation may use `Eff.` only when its accessible
name expands to the complete label.

### Primary versus diagnostic values

Primary decision surfaces use the effective whole-cycle set:

- Effective kills/hr
- Effective XP/hr
- Effective gross GP/hr
- Effective net GP/hr

On-site rates remain available as diagnostic detail in Stats. They must not be
removed from the domain result or made impossible to inspect.

Per-kill values retain their existing basis because they do not imply elapsed
banking time. DPS, max hit, hit chance and TTK retain their existing combat
meaning and labels.

## Required presentation changes

### Result and mobile context result

The primary Result metric strip must read:

- `Effective kills/hr` from `effectiveKph`;
- `Effective XP/hr` from `effectiveXpPerHour`;
- `Effective gross GP/hr` from `effectiveGpPerHour`; and
- `Effective net GP/hr` from `effectiveNetGpPerHour`.

The compact visible forms may be `EFF. K/HR`, `EFF. XP/HR`, `EFF. GP/HR` and
`EFF. NET GP/HR`. Their accessible names must use the full labels above.

The player-adjacent mobile context result must use the same values and naming.
It may keep its smaller subset, but every hourly value in that subset must be
effective.

Risk detail attached to net GP remains attached to effective net GP. The TTK
risk range remains a kill-time distribution and does not acquire an effective
hourly label.

### Stats

Stats remains the detailed place where both bases can be inspected:

- rename the current roll-detail `Kills/hr` row to `On-site kills/hr`;
- correct its note to say that it is before banking/travel efficiency;
- keep the existing effective-kills presentation, but spell it out as
  `Effective kills/hr` rather than an unexplained `K/hr` pill;
- if both GP bases are shown in the same group, label them `On-site gross
GP/hr` and `Effective gross GP/hr`; and
- update summary notes so they never claim on-site values mirror post-banking
  output.

Stats must not recompute a rate. It reads both values from the composed result.

### Trip and Cannon

Trip already owns the whole-cycle explanation. Rename compact `Effective K/hr`
to `Effective kills/hr` and keep it sourced from `effectiveKph`.

Cannon's combined effective XP and net GP values remain unchanged. Any visible
kills/hr value that represents whole-user output must use `effectiveKph`; a
cannon-only or on-site diagnostic must name that narrower basis explicitly.

### Dense Compare

The visible and sortable Dense columns currently identified by persisted sort
ids `killsPerHour` and `gpPerHour` must compare:

- `effectiveKph` for the kills column; and
- `effectiveGpPerHour` for the gross GP column.

Keep the persisted sort identifiers readable to avoid a storage migration.
Presentation view models should expose explicit effective field names
internally and adapt the stable sort ids at the Dense preference boundary.

Column labels and accessible sort-button names must say `Effective kills/hr`
and `Effective gross GP/hr`. Existing effective XP and effective net GP values
remain unchanged. Best markers and row ordering must use the displayed values.

### Saved setup comparison and Duel matrix

Saved setup rows must use `effectiveKph` for kills/hr. Their XP, net GP and
GP/XP values already use effective inputs and remain unchanged. Update headings,
sort labels, best markers and deltas together.

The all-monster matrix has no kills or gross-GP metric today. Its effective XP,
effective net GP and GP/XP metrics remain as-is; their visible labels should
include `Effective` where space permits and use a full accessible label in all
cases.

No saved snapshot schema changes. Stored setup data does not contain calculated
rates.

### Planner

Planner already optimizes and reports `effectiveXpPerHour` and
`effectiveNetGpPerHour`. Keep the calculation path unchanged and make visible
headings/tooltips explicit about `Effective` when the surrounding copy does not
already establish the basis.

## Architecture and ownership

- `src/domain/simulation` remains the sole composed-result owner and keeps all
  existing rate fields.
- `src/app/view-models/app-shell.ts` selects effective fields for headline and
  mobile context metrics.
- `src/app/view-models/stats.ts` owns the diagnostic on-site/effective labels
  and corrected notes.
- `src/app/view-models/compare.ts` and `src/app/view-models/duel.ts` own the
  displayed comparison values, deltas and best-value inputs.
- `src/app/state/dense-compare.ts` retains compatible persisted sort ids.
- pane components render prepared labels and values; they do not select a
  different rate field locally.
- the shared presentation-language owner expands compact labels into complete
  accessible names.

Do not introduce a second rate calculator in `src/app`.

## Accessibility and responsive behavior

- A visible compact abbreviation must have a full accessible label containing
  both `Effective` or `On-site` and the unit meaning.
- Table sort controls must announce the same semantic basis as the displayed
  column.
- A best marker must describe the displayed effective value, not a hidden
  on-site value.
- Do not rely on color, table position or a tooltip alone to distinguish the
  bases.
- Mobile metric wrapping may abbreviate the visible text but must not drop the
  basis word from the accessible name.

## Required tests

### Unit and view-model tests

- Freeze a fixture where banking/travel efficiency makes
  `killsPerHour !== effectiveKph` and `gpPerHour !== effectiveGpPerHour`.
- Prove Result and mobile context select the effective fields.
- Prove Stats exposes the on-site field with correct pre-banking copy and the
  separate effective field.
- Prove Dense sort, rendered values and best marker use the same effective
  kills/gross-GP values while old persisted sort ids still parse.
- Prove saved-setup values, deltas, sort and best markers use `effectiveKph`.
- Prove Planner and the all-monster matrix retain their existing effective
  numeric inputs.
- Add a vocabulary test that rejects bare ambiguous hourly labels in the named
  Result, Stats, Compare, Duel, Trip, Cannon and Planner models.

### Browser tests

Use a deterministic scenario with visible banking or scarce-spot efficiency:

1. record the on-site and effective values from Stats/Trip;
2. prove the Result strip matches the effective values;
3. prove the selected Dense row and saved live row match the same effective
   values;
4. sort by effective kills/hr and effective gross GP/hr and verify row order;
5. inspect compact/mobile accessible names; and
6. confirm changing Trip banking inputs changes every effective surface while
   the Stats on-site value remains on its own basis.

The browser case must not assert that a formula changed; it proves common
selection and language over the existing result.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused result/stats/compare/duel view-model suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "effective hourly rates"
npm run test:golden
git diff --check
```

Run the relevant read-only visual cases because metric widths and table headings
change across desktop, compact landscape and mobile. Baseline changes still
require the existing visual-regression review policy.

## Acceptance criteria

- No named primary decision surface mixes on-site kills/gross GP with effective
  XP/net GP.
- Result, Dense, saved setup, Trip and Planner hourly decision values use the
  complete whole-cycle basis.
- Stats retains clearly labelled on-site diagnostics and no longer describes
  them as post-banking.
- Display, sorting, deltas and best markers consume the same numeric field.
- Existing Dense preferences and all persisted/setup/share schemas remain
  compatible.
- Combat, Trip, economy, XP, Planner and Risk formulas are unchanged.
- Focused unit, browser, golden, architecture and diff checks pass.

## Implementation evidence

Implemented on 2026-07-21 without changing `FullSimulationResult`, simulation
formulas or persisted schemas.

- `src/app/view-models/app-shell.ts`, `compare.ts`, `duel.ts`, `stats.ts` and
  `trip.ts` now select and name the specified effective or on-site fields.
- `src/app/state/planner.ts` and the Planner, Compare, Duel, Stats, Cannon and
  shell components render explicit visible or accessible rate bases. Dense
  keeps the persisted `killsPerHour` and `gpPerHour` sort ids as compatibility
  adapters while its displayed values, ordering and best markers use the
  effective fields.
- The frozen `ranged_magic_shortbow_dagannoth_cannon` fixture records distinct
  on-site and whole-trip values: `356.795683` versus `350.022327` kills/hr and
  `31,138.335147` versus `30,547.21` gross GP/hr.
- Focused result/view-model coverage passes 59/59, all 19 golden cases pass,
  typecheck and the 173-module zero-cycle architecture check pass, and the
  production-preview `effective hourly rates` transaction proves Result,
  Stats, Trip, Dense, saved setups, sorting and mobile accessible labels.
- The complete functional Chromium run passed 135/139 before four expected
  copy assertions were updated; all four targeted reruns then passed. The
  final six-case rate, result-update, Stats-XP and mobile transaction also
  passes after the compact-label bundle adjustment.
- The clean repository gate passes 1,088/1,088 unit tests, 19/19 goldens,
  typecheck, architecture, production build, artifact, lint, format and diff
  checks. The final entry artifact is 229,983 gzip bytes under the 230,000-byte
  budget; the sandboxed dependency audit is the gate's documented network-only
  skip.
- The read-only Darwin visual run completed without baseline writes: 11/26
  existing baselines matched and 15/26 produced reviewed, expected diffs on
  surfaces whose labels, markers or wrapping changed. The generated actuals
  showed no clipping or structural breakage. A final four-viewport mobile
  rerun reproduced only the expected label/layout diffs; baseline acceptance
  remains a separate reviewed action.

## Open questions

None. `FullSimulationResult` already exposes the required values, and the
primary-versus-diagnostic presentation boundary is fully specified here.
