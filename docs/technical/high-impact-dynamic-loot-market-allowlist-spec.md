# High-impact dynamic-loot market allowlist expansion specification

- Status: implemented
- Date: 2026-07-12
- Owner: `src/data/market-source-mapping.ts`
- Product surface: scheduled market coverage for active gem/mega and ultra-rare loot valuation
- Related decisions: D-062, D-085, D-086 and D-087

## Purpose

Admit the source-reviewed identified items found by the D-086 dependency audit
to the scheduled market allowlist without guessing unsupported unidentified-herb
identities or changing any loot formula.

## Reviewed boundary

D-086 found 49 unique active dynamic-loot price dependencies. The prior
allowlist mapped 27 and omitted 22. The omitted set separated into:

- twelve identified, tradeable gem/mega or ultra-rare components with public
  item pages; and
- ten species-specific `unidentified_*` herb ids not exposed by the current
  market source.

On 2026-07-12, a bounded public item-page review returned a supported page for
all twelve identified candidates. The existing item-page parser then completed
a no-write live dry-run for the same twelve mappings with eight updated and
four retained/skipped rows, including page-internal source-slug validation.
The ten non-guam unidentified-herb page paths returned 404 and remain outside
the allowlist.

No raw page, listing, username or response body was written or committed.

## Accepted mappings

| Runtime item id   | Market source slug |
| ----------------- | ------------------ |
| `adamant_javelin` | `adamant_javelin`  |
| `dragon_med_helm` | `dragon_med_helm`  |
| `dragon_spear`    | `dragon_spear`     |
| `dragonshield_a`  | `dragonshield_a`   |
| `rune_2h`         | `rune_2h_sword`    |
| `rune_battleaxe`  | `rune_battleaxe`   |
| `rune_javelin`    | `rune_javelin`     |
| `rune_kiteshield` | `rune_kiteshield`  |
| `rune_spear`      | `rune_spear`       |
| `rune_sq_shield`  | `rune_sq_shield`   |
| `runite_bar`      | `runite_bar`       |
| `silver_ore`      | `silver_ore`       |

The explicit `rune_2h` mapping is required because the runtime identity and
market slug differ. The twelve-row set is exported as
`HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES`, uses a dated review note and is
included in the same validated mapping schema as the original catalog-audited
allowlist.

## Resulting coverage

The allowlist grows from 80 to 92 mappings. Dynamic-loot readiness changes from
27/49 mapped with 22 missing to 39/49 mapped with ten missing:

| Tag         | Dependencies | Missing mappings |
| ----------- | -----------: | ---------------: |
| `casket`    |            7 |                0 |
| `gem`       |           12 |                0 |
| `herb`      |           22 |               10 |
| `ultrarare` |           26 |                0 |

The remaining set is exactly `unidentified_avantoe`,
`unidentified_cadantine`, `unidentified_dwarf_weed`,
`unidentified_harralander`, `unidentified_irit`, `unidentified_kwuarm`,
`unidentified_lantadyme`, `unidentified_marentill`, `unidentified_ranarr` and
`unidentified_tarromin`. D-085's visible generic-unid proxy behavior remains
the supported fallback for those identities.

## Price and provenance behavior

This change adds refresh targets; it does not commit values from the live
dry-run and does not change weights, quantities, fallback constants, GP/kill or
GP/hour.

Six admitted ids already have numeric rows in `prices.json`. Their committed
provenance changes from `outside-market-allowlist` to a reviewed source id/slug
with `legacy-metadata-unavailable`. They remain `legacy-static`,
`not-evaluated` and `unknown`; no observation or evaluation timestamp is
invented. Admitted ids without a committed numeric row continue to use their
explicit generated object-cost fallback until a later scheduled writer run
accepts enough current observations.

If D-099 is explicitly reversed, the next restored scheduled run may update or
retain these mappings under the existing D-062/D-085 quality and freshness
rules. This specification does not claim a successful configured cron run for
the expanded 92-row allowlist.

## Acceptance evidence

- exact mapping count is 92 and the expansion set is exactly twelve rows;
- the source exception `rune_2h → rune_2h_sword` is test-locked;
- live no-write parsing accepted all twelve pages and reported eight updated
  plus four retained/skipped rows;
- generated readiness reports 39/49 mapped, ten missing and zero unrecognized
  active tags;
- gem, casket and ultra-rare tables have zero missing mappings;
- the remaining ten ids are exactly the unsupported unidentified herbs;
- committed provenance records the six newly mapped static rows without
  fabricating timestamps; and
- all numeric simulation and golden behavior remains unchanged.

Final repository validation passes 614/614 Vitest tests, 19/19 legacy golden
tests, typecheck, production build, ESLint, Prettier and diff checks. Generated
runtime readiness has no blocker. After rebasing the latest scheduled price
snapshot, the verified nine-file/two-asset deployment artifact contains eleven
history snapshots and has SHA-256
`b4f1813512d9f43e43a82e15eeffb9b31c42abbc149ff11119b8569cb728e83b`.

## Validation commands

```sh
npm run typecheck
npm run test -- src/tests/market-sync-items.test.ts src/tests/live-integrations.test.ts src/tests/generated-runtime-adapter.test.ts src/tests/data-economy.test.ts src/tests/market-writer.test.ts
npm run runtime:readiness -- --example-limit 5
npm run test:golden
npm run lint
npm run format:check
git diff --check
```

## Open questions

- Will the market source later expose distinct pages for the ten non-guam
  unidentified herbs? Add them only after a fresh source review and successful
  parser dry-run.
- When will an adopter collect the first successful configured cron evidence
  for the complete 92-row allowlist? Until then, scheduled-current deployment
  copy remains gated by D-067.
