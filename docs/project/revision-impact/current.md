# Current Game Revision Impact

Status: foundation report.

## Source

- Source ref: LostCityRS/Content fixture / fixture-revision-274 / 0000000000000000000000000000000000000274
- Source path: `src/tests/fixtures/data-generator/lostcity-content`
- Generated at: 2026-07-08T00:00:00.000Z
- Generator version: foundation-1
- Generator command: `npm run data:generate -- --source-dir src/tests/fixtures/data-generator/lostcity-content --output-root . --generated-at 2026-07-08T00:00:00.000Z`

## Runtime Status

- Runtime bootstrap: legacy adapter.
- The Vite app still loads the validated legacy adapter snapshot until a separate goal switches runtime bootstrap to generated data.
- This report does not accept generated snapshot values as runtime truth by itself.

## Validation Status

- `GameDataSnapshotSchema`: pass
- `source-pin.json`: generated
- `revision-impact/current.md`: generated
- Diff baseline: valid at `src/data/generated/game-data.json`
- Calculation-impact suite: not run in this foundation slice

## Snapshot Diff Summary

| Section | Added | Removed | Changed |
| --- | ---: | ---: | ---: |
| items | 0 | 0 | 0 |
| monsters | 0 | 0 | 0 |
| weapons | 0 | 0 | 0 |
| ammo | 0 | 0 | 0 |
| spells | 0 | 0 | 0 |
| equipment | 0 | 0 | 0 |

No schema-level snapshot changes detected.

## Calculation Impact

- Full hybrid calculation-impact suite: not implemented in this foundation slice.
- Representative DPS, kills/hr, XP/hr, GP/hr and GP/XP diffs are not produced yet.
- No changed calculation outputs are accepted as intentional deltas by this report.

## Known Limitations

- Foundation input uses a normalized manifest fixture; authoritative LostCityRS/Content file parsing is not implemented yet.
- Generated item requirement extraction is not implemented yet.
- NPC-size, dragon halberd behavior and final special-case source truth are not decided here.
- Market prices and market price history are outside this game-data snapshot workflow.
- Historical generated snapshot archives are intentionally not committed.

## Open Questions

- What exact upstream fields should populate the final normalized simulator-consumed `GameDataSnapshot`?
- What concrete case files and item/spell/equipment ids should implement the accepted hybrid calculation-impact suite?
- How should generated planner/loadout requirements be represented without changing the current manual requirement policy in this slice?
- Which future PR should switch the browser bootstrap from the legacy adapter to `src/data/generated/game-data.json`?
