# Goal

- Id: RP-05
- Status: complete 2026-07-22; visual review passed
- Priority: high
- Estimated effort: M
- Parent specification:
  [Wide table discoverability](../../technical/release-polish-wide-table-discoverability-spec.md)
- Depends on: compact text readability and visual regression suite

## Tavoite

Tee leveiden taulukoiden sivuttaisvieritys, rivin identiteetti ja ensisijaiset
rivitoiminnot löydettäviksi kapeilla näytöillä.

## Aloita tästä

Lue parent-specin lisäksi:

- Dense/Compare pane and table CSS
- Loot table/view-model ownerit
- setup import/review and Workspace review table ownerit
- `src/app/styles.css`
- visual regression spec and current baselines

Inventoi ensin kaikki horizontal overflow -table wrapperit ja päätä per table,
tarvitaanko cue, sticky identity, sticky action vai ei muutosta.

## Toteutusvaatimukset

- Lisää vain tarvittaviin taulukoihin näkyvät overflow-cuet.
- Pidä rivin identiteetti näkyvissä Dense/Loot/setup-review/Workspace-review
  poluissa, joissa konteksti muuten katoaa.
- Pidä primary action keyboard-reachable.
- Todista ettei dokumenttiin synny horizontal overflowta.

## Rajaukset

Älä vaihda taulukoita korteiksi, poista kolumneja, muuta sortteja, laskentoja,
row groupingeja, import reviewtä, persistenceä tai compact-landscape scroll
owner -sopimusta.

## Pakolliset testit

```sh
npm run test -- src/tests/compare-duel-panes.test.ts src/tests/loot-pane.test.ts src/tests/setup-import-review.test.tsx src/tests/workspace-backup-panel.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Dense|Loot|setup transfer|Workspace backup"
npm run test:e2e:visual
git diff --check
```

## Evidence

- Dense, Loot, setup/Duel review and Workspace review table wrappers now have
  horizontal scroll cues and sticky identity columns where row context can
  otherwise disappear.
- Passed:
  `npm run test -- src/tests/compare-duel-panes.test.ts src/tests/loot-pane.test.ts src/tests/setup-import-review.test.tsx src/tests/workspace-backup-panel.test.tsx`.
- `npm run typecheck` passed after implementation.
- The combined functional Chromium grep
  `npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer|status|optimizer|Undo|mobile result and navigation loop|Compare|Trip|Loot optimizer|Loadout optimizer|Dense|Loot|hiscores"`
  passed 59/59 after implementation fixes.
- The allowed visual review inspected all 37 Darwin expected/current image
  pairs. It found and rejected one initial Loot-mobile candidate where the
  outer sticky row name occluded nested child identities.
- The open Loot detail now owns the opaque foreground stacking layer; a
  focused read-only rerun verified visible Guam-through-Dwarf-weed child labels
  before the scoped Loot baseline update.
- The explicit baseline update completed 26/26, and two following complete
  read-only runs passed 26/26 and 26/26.

## Done

- [x] Sideways-scroll on näkyvä silloin kun lisäsisältöä on.
- [x] Row identity/action eivät katoa käyttökelvottomiksi.
- [x] Keyboard/focus ja 390/620/768/844x390/Desktop containment säilyvät
      table-ownerien unit/CSS-polun mukaan.
- [x] Visual diffit katselmoitiin, nested Loot -occlusion korjattiin ennen
      hyväksyntää ja kaksi lopullista read-only-ajoa läpäisi 26/26.
- [x] Dokumentit ja backlog päivitetään toteutusevidencellä.
