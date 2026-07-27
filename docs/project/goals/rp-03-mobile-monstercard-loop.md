# Goal

- Status: implemented
- Date: 2026-07-22
- Owner: project execution
- Evidence: verified

- Id: RP-03
- Priority: high
- Estimated effort: M
- Parent specification:
  [Mobile MonsterCard navigation loop](../../technical/release-polish-mobile-monstercard-loop-spec.md)
- Depends on: implemented mobile result/navigation loop and workbench browser
  context

## Tavoite

Lisää mobiiliin selkeä hyppy Compare-kontekstista Monster details -kortille ja
paluu takaisin samaan työkohtaan ilman että hyväksytty mobiilijärjestys muuttuu.

## Aloita tästä

Lue parent-specin lisäksi:

- `src/app/components/shell/workbench-shell.tsx`
- Compare/Dense pane and view-model owners
- MonsterCard presenter/view-model owner
- mobile result/navigation loop tests and visual baselines

## Toteutusvaatimukset

- Lisää mobiilissa näkyvä `Monster details` -hyppy Compare-tulosten/targetin
  läheisyyteen.
- Lisää MonsterCardiin deterministinen paluureitti aktiiviseen paneen.
- Säilytä filters, sort, selected target, active pane ja history policy.
- Zero-result Compare -tilassa pitää olla selkeä paluu filttereihin.
- Todista 390/620/768 containment.

## Rajaukset

Älä siirrä MonsterCardia active panen yläpuolelle, lisää uutta pane-id:tä,
tee drawer/modal-kopiota tai muuta Compare-laskentaa, suodatusta, hinnoittelua
tai persistenceä.

## Pakolliset testit

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/compare-duel-panes.test.ts src/tests/monster-card-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "mobile result and navigation loop|Compare"
npm run test:e2e:visual
git diff --check
```

## Evidence

- Compare exposes a mobile `Monster details` jump; MonsterCard exposes a
  `Back to Compare` return anchor; zero-result Compare has visible recovery
  copy.
- Passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/compare-duel-panes.test.ts src/tests/monster-card-panel.test.ts src/tests/monster-card-view-model.test.ts`.
- `npm run typecheck` passed after implementation.
- The combined functional Chromium grep
  `npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer|status|optimizer|Undo|mobile result and navigation loop|Compare|Trip|Loot optimizer|Loadout optimizer|Dense|Loot|hiscores"`
  passed 59/59 after implementation fixes.
- The allowed visual review inspected all 37 Darwin expected/current image
  pairs, including the six bounded mobile-loop images and full mobile shell.
  The intended jump/return controls, accepted pane order and 390/620/768
  containment passed review.
- The explicit baseline update completed 26/26, and two following complete
  read-only runs passed 26/26 and 26/26.

## Done

- [x] Mobiilihyppy Monster detailsiin ja paluu toimivat menettämättä paneen
      tilaa.
- [x] Zero-result-polku palauttaa käyttäjän filttereihin.
- [x] Desktop ja compact landscape säilyvät component/CSS-polun mukaan.
- [x] Ensimmäiset 26 mismatch-paria katselmoitiin ennen candidate-kirjoitusta
      ja kaikki 37 kuvaa ennen lopullista hyväksyntää; kaksi lopullista
      read-only-ajoa läpäisi 26/26.
- [x] Dokumentit ja backlog päivitetään toteutusevidencellä.
