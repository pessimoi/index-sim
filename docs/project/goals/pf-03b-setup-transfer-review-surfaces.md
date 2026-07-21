# Goal

- Id: PF-03B
- Status: completed 2026-07-21
- Priority: high
- Estimated effort: M
- Parent specification:
  [Setup transfer complete change review](../../technical/setup-transfer-change-review-spec.md)
- Depends on: completed
  [PF-03A shared diff core and setup file review](pf-03a-setup-transfer-diff-core.md)

## Tavoite

Ota PF-03A:n exhaustive setup change -ydin käyttöön shared-link-reviewssa ja
saved in-app setup Load -reviewssa. Toteuta molemmille accurate included/excluded
scope, complete `Current → Incoming` -muutokset, no-op ja stale/Refresh/sync-
guard. Sulje tämän jälkeen parent-speksi yhdistetyllä file/share/saved-row-
evidencellä.

## Feature-inventory-tarkistus

`Setup sharing`, `Basic combat setup` ja `Setup comparison` ovat `Valmis`.
Shared-link ja saved-row Load validoivat, katselmoivat ja Undoavat jo. PF-03B ei
lisää uutta sharing- tai snapshot-featurea, vaan viimeistelee niiden nykyisen
replacement-reviewn samalla kenttärekisterillä kuin PF-03A.

## Aloita tästä

Varmista ensin, että PF-03A on oikeasti toteutettu, testattu ja dokumentoitu.
Lue lisäksi:

- parent-spec kokonaan ja PF-03A:n implementation evidence;
- `docs/technical/shareable-setup-permalink-spec.md`;
- `docs/technical/duel-setup-diff-spec.md`;
- `src/app/state/shareable-setup.ts`;
- `src/app/view-models/app-shell.ts` shared review -osuus;
- `src/app/components/shell/shared-setup-review.tsx`;
- saved setup Load/review -state, view model, pane ja App-transaction;
- `src/tests/shareable-setup.test.ts`;
- `src/tests/saved-setup-changes.test.ts`;
- `src/tests/duel-view-model.test.ts` ja pane/action-testit;
- `src/tests/e2e/shareable-setup.spec.ts` ja
  `src/tests/e2e/planner-duel.spec.ts`.

Jos PF-03A:n diff API ei kata tätä scopea ilman copy-pastea, korjaa shared API
ennen surface-integraatiota. Älä luo toista field registryä.

## Toteutusvaatimukset

### Shared link

1. Vertaa exact share apply -scope: full active form, current-monster cannon,
   loot actions ja loot settings.
2. Näytä form-ryhmät PF-03A:n rekisteristä, current-monster cannon sekä
   stable-row-id-pohjaiset loot action/settings -muutokset.
3. Näytä excluded scope täsmälleen parent-specin mukaan: recipient PriceSet,
   history/manual prices, saved collection, other-monster state, Planner UI,
   Hiscores player ja calculated output.
4. Säilytä compatibility-normalisoinnissa pudotettujen loot-rivien nykyinen
   warning; älä näytä niitä applied incoming -muutoksina.
5. Toteuta included-scope stale/Refresh/sync Load guard ja no-op. Excluded
   PriceSet-muutos ei stalea.
6. Delegoi changed Load nykyiseen form+cannon+loot Apply/Undo-polkuun.

### Saved in-app row

1. Käytä samaa `CombatSetupFormState` field registryä row Load -reviewssa.
2. Rajaa diff vain snapshotiin tallennettuun formiin.
3. Nimeä current target, cannon, loot policy ja prices shared/excluded contextiksi,
   ei incoming changeiksi.
4. Säilytä nykyinen calculated Duel impact erillisenä; älä yhdistä sitä field-
   diffin syy-seurausväitteeksi.
5. Toteuta stale/Refresh/sync Load guard ja no-op nykyistä saved row id:tä vasten.
6. Delegoi changed Load nykyiseen replacement persistence/Undo-transaktioon.

### Cross-flow consistency

- File, share ja saved-row käyttävät yhtä formatter/field registryä.
- Saman fieldin label ja semantic value on sama kaikissa kolmessa flowssa.
- Jokainen flow näyttää oman included/excluded scopensa eikä unionia kaikista.
- Dismiss palauttaa fokuksen nykyiselle origin-controlille.
- Conditional chunks eivät vedä whole reviewta initial entryyn ilman aktiivista
  candidaten gatea.

## Rajaukset

Älä:

- muuta share v1/v2-, setup- tai saved snapshot -schemaa/payloadia;
- lisää shareen PriceSetiä, saved collectionia tai other-monster statea;
- muuta calculated Duel impact -kaavoja;
- muuta persistenceä, Undo-scopea, compatibilitya tai fragment capturea;
- renderöi raw id:tä, payloadia, filenamea tai fingerprintiä; tai
- jätä parent-speciä `Partial`-tilaan, jos kaikki required evidence oikeasti
  läpäisee.

## Pakolliset testit

```sh
npm run test -- src/tests/setup-import-review.test.tsx src/tests/shareable-setup.test.ts src/tests/saved-setup-changes.test.ts src/tests/duel-view-model.test.ts src/tests/duel-pane-actions.test.tsx src/tests/app-shell-view-model.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "reviews every setup transfer change"
npm run test:golden
npm run verify
git diff --check
```

Lisää/ laajenna Playwright-evidence niin, että yksi combined grep kattaa:

- file import complete diff + Apply/Undo;
- shared link levels/Trip/cannon/loot complete diff + Load/Undo;
- saved row complete form diff + Load/Undo;
- included state stale/Refresh jokaisessa relevantissa flowssa;
- PriceSet-only excluded change ei stalea file/share-reviewta;
- no-op ei luo Undoa; ja
- keyboard/focus, 390 px ja compact-landscape containment.

Aja relevantit visual baselinet read-only. Baseline-kirjoitus vaatii erillisen
katselmuksen.

## Dokumentaatiopäivitykset

Kun combined evidence läpäisee:

- merkitse parent-spec toteutetuksi ja lisää PF-03A+PF-03B implementation
  evidence;
- muuta backlog-kortti `Done`-tilaan;
- päivitä Basic setup, Setup comparison ja Setup sharing -current-state-tekstit;
- merkitse PF-03B completed ja säilytä PF-03A:n historiallinen evidence;
- päivitä architecturea vain, jos uusi shared owner muuttaa living boundarya;
  ja
- älä muuta transfer schema-/decision-dokumentteja ilman todellista muutosta.

## Done

- file/share/saved-row käyttävät yhtä exhaustive registryä;
- jokainen flow näyttää kaikki oman apply-scopensa muutokset;
- included/excluded scope, no-op, stale, Refresh ja sync guard toimivat;
- existing Apply/Load/Dismiss/persistence/Undo/compatibility säilyvät;
- conditional loading ja focus behavior säilyvät;
- combined unit/browser/golden/verify/architecture/diff evidence läpäisee; ja
- parent-spec sekä backlog ovat totuudenmukaisesti `Done`.

## Completion evidence · 2026-07-21

- `src/app/state/setup-transfer-changes.ts` now assembles setup-file,
  shared-link and saved-row reviews from the same eight-group
  `CombatSetupFormState` registry and semantic formatters. Shared review adds
  only incoming-target cannon, exact stable-row-id loot actions and loot
  settings; source-backed collision labels keep repeated rows distinct.
- Shared links capture only form/cannon/loot/settings as their stale baseline.
  An applicable change exposes Refresh and the Load callback rechecks the
  fingerprint synchronously. Recipient PriceSet changes remain outside the
  fingerprint, compatibility-dropped loot stays in the existing warning and
  no-op links disable Load without creating Undo.
- Saved-row Load compares the active form with the current saved row id while
  preserving the active target. Live-form or source-row form replacement makes
  the review stale, Refresh resolves the same id again and the final Load guard
  rechecks both fingerprints. The existing calculated `Review diff` remains a
  separate non-causal impact panel.
- Changed shared and saved-row loads delegate to their unchanged existing
  Apply/persistence/Undo composition. Dismiss clears the shared candidate and
  returns focus to Share; saved-row Dismiss returns focus to that row's Load
  control. No envelope, payload, browser-storage version, compatibility rule,
  formula or calculated-output contract changed.
- The required focused line passes 53/53. The combined one-worker Chromium
  transaction `reviews every setup transfer change across file, shared-link
and saved-row Load` passes 1/1 and covers all three scopes, applicable stale
  plus Refresh, file/share PriceSet exclusion, no-op, Apply/Load/Undo, keyboard
  focus, 390 x 844 and 844 x 390 containment. The retained share regression
  passes 3/3.
- The clean cumulative `npm run verify` gate passes 115/115 Vitest files and
  1,106/1,106 tests, 19/19 goldens, typecheck, lint, formatting, the
  174-module/160-client-reachable zero-cycle architecture check, build and
  artifact validation. The 29-file artifact has 22 JavaScript chunks, a
  276,038 raw / 83,401 gzip direct entry, 2,430,050 total bytes and SHA-256
  `a20d2edb6b2d22cdba57b35a379cb4b948c8cd187230d4af7918e2ab406a41cb`.
- The visual owner has no conditional file/share/saved-Load review baseline;
  none was written. Responsive evidence remains owned by the named browser
  transaction.

## Lopuksi

Raportoi kolme apply-scopea rinnakkain, field registry reuse -evidence, stale-
sourcejen exact luettelo, no-op/Undo-tulokset ja kaikki schema/persistence/
compatibility-rajat, jotka säilyivät.
