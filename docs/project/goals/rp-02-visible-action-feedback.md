# Goal

- Id: RP-02
- Status: completed 2026-07-22
- Priority: high
- Estimated effort: M
- Parent specification:
  [Visible action feedback](../../technical/release-polish-visible-action-feedback-spec.md)
- Depends on: existing global status and pending Undo surface

## Tavoite

Tee user-triggered actioneille näkyvä, deduplikoitu palaute silloin kun ne
nykyisin päätyvät vain visually hidden global status -polkuun.

## Aloita tästä

Lue parent-specin lisäksi:

- `src/app/App.tsx`
- `src/app/components/shell/app-shell.tsx`
- Loadout, Loot ja Trip pane/view-model ownerit
- nykyiset status/Undo component-testit

Tee ensin `rg`-inventaario kaikista global status -kutsuista ja jaa ne
parent-specin luokkiin.

## Toteutusvaatimukset

- Lisää näkyvä palaute vain niihin tapauksiin, joilla ei ole nykyistä visible
  noticea tai pending Undo -pintaa.
- Säilytä yksi polite live-region ja estä näkyvä duplikaatio.
- No-op ei saa korvata hyödyllistä pending Undoa.
- Pidä copy fixed/raw-error-free ja 390 px:ssä wrapattavana.

## Rajaukset

Älä lisää toast stackia, persisted notification historiaa, uusia reset targeteja
tai muutoksia laskentoihin, optimointiskooppeihin, storage-skeemoihin tai Undo-
omistajiin.

## Pakolliset testit

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/loadout-pane.test.ts src/tests/loot-view-model.test.ts src/tests/trip-pane.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "status|optimizer|Undo"
git diff --check
```

## Evidence

- Global status outcomes now render through one visible polite `ActionStatus`
  strip when no local notice or pending Undo already owns the same message.
- Passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/loadout-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/trip-pane.test.ts`.
- `npm run typecheck` passed after implementation.

## Done

- [x] Kaikki global status -callerit on luokiteltu.
- [x] Tarvittavat no-op/failed/success-palautteet näkyvät kerran.
- [x] Hyödyllinen pending Undo säilyy no-opissa.
- [x] Focus ja mobile containment on todistettu component/CSS-polulla;
      manuaalista AT-evidenssiä ei ajettu.
- [x] Dokumentit ja backlog päivitetään toteutusevidencellä.
