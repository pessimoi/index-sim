# Goal

- Id: RP-04
- Status: completed 2026-07-22
- Priority: high
- Estimated effort: M
- Parent specification:
  [Recommendation and optimizer Undo contract](../../technical/release-polish-recommendation-optimizer-undo-spec.md)
- Depends on: existing global one-slot Undo and feature-local mutation owners

## Tavoite

Yhtenäistä Trip recommendation-, Loot optimizer- ja Loadout optimizer -toimintojen
changed/no-op/Undo-sopimus.

## Aloita tästä

Lue parent-specin lisäksi:

- `src/app/App.tsx`
- `src/app/components/panes/trip-pane.tsx`
- Loot optimizer view-model/state paths
- Loadout optimizer apply/status paths
- current global Undo component tests

## Toteutusvaatimukset

- Trip recommendation ottaa exact preimagen muuttamistaan kentistä ja rekisteröi
  global Undon vain changed-tilassa.
- Loot optimizer no-op ei muuta state identityä tarpeettomasti eikä korvaa
  pending Undoa.
- Loadout optimizer copy ja no-op-polku linjataan samaan vocabularyyn.
- Kaikki restoret kulkevat nykyisten feature ownerien kautta.

## Rajaukset

Älä muuta optimointialgoritmeja, scoringia, requirement-politiikkaa, Trip/Loot
kaavoja, PriceSet-käyttöä, generated dataa, persistence-skeemoja tai Undo-
historiaa.

## Pakolliset testit

```sh
npm run test -- src/tests/trip-pane.test.ts src/tests/trip-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/loadout-view-model.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Trip|Loot optimizer|Loadout optimizer|Undo"
git diff --check
```

## Evidence

- Trip recommendations now register exact one-step Undo only on changed fields;
  Loot optimizer no-op gives visible feedback without replacing pending Undo.
- Passed:
  `npm run test -- src/tests/trip-pane.test.ts src/tests/trip-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/loadout-view-model.test.ts src/tests/app-shell-components.test.tsx`.
- `npm run typecheck` passed after implementation.

## Done

- [x] Changed Trip recommendation, Loot optimizer ja Loadout optimizer antavat
      yhden näkyvän exact Undon.
- [x] No-opit antavat näkyvän palautteen eivätkä tuhoa hyödyllistä Undoa.
- [x] Restore-copy on näkyvä ja raw-error-free.
- [x] Ei formula-, schema- tai provider-muutoksia.
- [x] Dokumentit ja backlog päivitetään toteutusevidencellä.
