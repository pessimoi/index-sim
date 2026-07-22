# Goal

- Id: RP-06
- Status: completed 2026-07-22
- Priority: medium
- Estimated effort: S
- Parent specification:
  [Hiscores fallback readability](../../technical/release-polish-hiscores-fallback-readability-spec.md)
- Depends on: implemented Hiscores lookup controller and Apply Undo

## Tavoite

Tee Hiscores disabled/error fallbackista kokonaan luettava ja lisää suora
fokusreitti manuaalisiin Player level -kenttiin.

## Aloita tästä

Lue parent-specin lisäksi:

- `src/app/components/topbar/hiscores-panel.tsx`
- `src/app/state/hiscores.ts`
- PlayerSidebar/app shell focus routing
- Hiscores mocked e2e path

## Toteutusvaatimukset

- Poista fallback/status-copylta merkityksellinen ellipsis-clipping.
- Lisää `Edit Player levels manually` -tyyppinen action tai vastaava suora
  focus-safe route.
- Focusoi Player level group tai ensimmäinen relevantti level input.
- Säilytä lookup disabled/unavailable, preview Apply, freshness ja Undo.

## Rajaukset

Älä muuta provideria, tee live upstream -testejä, lisää authia/account storagea,
muuta Apply snapshotia, player persistenceä tai Planner reconciliationia.

## Pakolliset testit

```sh
npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "hiscores"
git diff --check
```

## Evidence

- Hiscores disabled/error copy wraps without ellipsis and the topbar fallback
  action focuses the existing `Player levels` group.
- Passed:
  `npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/app-shell-components.test.tsx`.
- Passed:
  `npm run test:e2e -- --workers=1 --grep "hiscores"`.
- `npm run typecheck` passed after implementation.

## Done

- [x] Pitkä disabled/error-teksti wrapaa luettavasti.
- [x] Manual-level fallback action siirtää fokuksen oikeaan paikkaan.
- [x] Hiscores lookup/Apply/Undo-sopimukset säilyvät.
- [x] Compact/mobile containment on todistettu mocked Hiscores Chromium
      -polulla.
- [x] Dokumentit ja backlog päivitetään toteutusevidencellä.
