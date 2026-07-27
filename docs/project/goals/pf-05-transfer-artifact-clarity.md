# Goal

- Status: implemented
- Date: 2026-07-21
- Owner: project execution
- Evidence: verified

- Id: PF-05
- Priority: medium
- Estimated effort: M
- Parent specification:
  [Transfer artifact scope and filename clarity](../../technical/transfer-artifact-scope-filenames-spec.md)
- Depends on: existing file-transfer schemas/outcomes; run after PF-03B because
  setup transfer copy overlaps

## Tavoite

Tee kaikki viisi nykyistä JSON-artifactia erotettaviksi ennen toimintoa ja
tiedostonimen perusteella. Ota käyttöön parent-specin exact action/help-copy ja
yksi bounded contextual UTC-sortable filename helper combat setupille, saved
setup collectionille, PriceSetille, Workspace backupille ja metadata-only
recovery reportille.

Älä muuta tiedostojen sisältöä, schemaa, parseria, transaktiota tai Undoa.

## Feature-inventory-tarkistus

`Basic combat setup`, `Setup comparison`, `Market price sync`, `Workspace backup
and restore` ja local-state recovery ovat `Valmis`. Nykyiset `Import setup`,
`Export setup`, `Import setups` ja `Export setups` ovat kuitenkin keskenään
epäselviä, ja setup/collection-filenamet ovat kiinteitä. Tämä on existing
transfer UX -clarity, ei uusi transfer-feature.

## Aloita tästä

Varmista PF-03B:n valmistuminen ja lue standardin lisäksi:

- `docs/technical/transfer-artifact-scope-filenames-spec.md`
- `docs/technical/file-export-outcome-feedback-spec.md`
- setup/saved/PriceSet/Workspace/recovery artifact builderit ja controllerit
- `src/app/components/shell/app-header.tsx`
- `src/app/components/panes/duel-pane.tsx`
- Workspace- ja recovery-panelit
- PriceSet Advanced tools -surface
- `src/tests/browser-download.test.ts`
- kaikki viiden flow'n controller/component/e2e-testit

Inventoi jokainen `downloadJsonFile`-call site ja nykyinen file-input/action-
label ennen editointia. Viisi nykyistä artifactia muodostavat closed scopeen;
uusi export ei tule implisiittisesti mukaan.

## Toteutusvaatimukset

### 1. Exact artifact language

Toteuta parent-specin exact labels:

- `Review combat setup file` / `Export combat setup`
- `Review saved setup collection` / `Export saved setup collection`
- `Review PriceSet file` / `Export active PriceSet`
- `Review Workspace backup file` / `Download full Workspace backup`
- `Export metadata-only recovery report`

Lisää adjacent/`aria-describedby` scope-copy, joka kertoo included ja tärkeät
excluded tiedot. Recovery reportin tulee sanoa, ettei se sisällä raw values eikä
voi restorea Workspacea. Workspace-copy säilyttää required area countin ja
Hiscores privacy opt-inin.

### 2. Shared filename helper

- Toteuta pure helper muodolle
  `2004scape-<artifact>[-<context>][-rev-<revision>]-YYYYMMDDTHHmmssZ.json`.
- Käytä exact artifact slugeja parent-specistä.
- Capturea yksi `now` ja käytä sitä sekä envelope timestampiin että filenameen.
- Combat context on validated source-backed target name; PriceSet context sen
  validated id; collection/Workspace eivät lisää targetia; recovery ei keksi
  revisionia.
- Lowercase/sanitize variable segment: ASCII a-z/0-9/single hyphen, max 48.
- Koko filename max 160 including `.json`; ei separatoria, controlia, leading
  dotia, repeated dotia tai raw source pathia.
- Unicode-only context käyttää fixed fallbackia; UI/file content säilyttää oikean
  source-nimen.

### 3. Controller integration and compatibility

- Käytä helperia kaikissa viidessä exportissa ja passaa sama nimi typed download
  adapterille ja outcome-copylle.
- Filename failure normalisoituu nykyiseen fixed failure outcomeen eikä clearää
  review/reset statea.
- Import parser selection pysyy content/schema-pohjaisena.
- Todista vanhojen fixed-name- ja user-renamed-filejen import toimivaksi.
- Älä renderöi imported local filenamea trusted review/error contentina.

## Rajaukset

Älä:

- muuta envelope kind/version/content/byte capia tai parseria;
- laajenna combat setupia Workspaceksi tai saved collectionia active setupiksi;
- muuta generated-high-alch-, manual-price-, history-, persistence- tai Undo-
  omistusta;
- lisää File System Access APIa, cloud uploadia tai download historyä;
- lisää player namea, levels/gear/prices/raw ids/local pathia filenameen;
- väitä `download started` -tulosta filesystem-saveksi; tai
- muuta PF-03:n complete change review -scopea.

## Pakolliset testit

```sh
npm run test -- src/tests/browser-download.test.ts src/tests/setup-file-transfer-controller.test.ts src/tests/duel-file-transfer.test.ts src/tests/price-set-transfer-controller.test.ts src/tests/workspace-backup-controller.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/app-shell-components.test.tsx src/tests/duel-pane-actions.test.tsx src/tests/workspace-backup-panel.test.tsx
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "names and explains transfer artifacts"
npm run test:e2e:cross-browser
npm run verify
git diff --check
```

Pure filename-testit freezeavat ajan ja kattavat jokaisen example-shapen,
empty/long/whitespace/punctuation/slash/backslash/dot/control/Unicode-only-
contextin sekä 48/160 rajat.

Browser-testissä dispatchaa kaikki viisi downloadia, tarkista suggested
filenamet ja exact labels/scope copy, importtaa validit vanhat fixed-name setup/
collection filet ja tarkista long filename wrapping desktop/compact/mobile.
Laajenna nykyisen cross-browser-manifestin CB-06-siirtotapausta uusilla
nimillä/filenamella sen sijaan, että lisäät manifestiin nimeämättömän uuden
journeyn.

## Dokumentaatiopäivitykset

- merkitse parent-spec toteutetuksi todellisilla file/controller/test-löydöillä;
- muuta backlog-kortti `Done`-tilaan;
- päivitä setup, saved collection, PriceSet, Workspace ja recovery current copy
  feature inventoryssa vain toteutuneelta osalta;
- päivitä architecture vain, jos helper muodostaa uuden living ownerin;
- merkitse tämä goal completed-checkeillä.

## Done

- [x] Kaikki viisi artifactia ovat nimetty ja scope-kuvattu yksiselitteisesti.
- [x] Kaikki uudet exportit käyttävät common bounded filename contractia.
- [x] Outcome näyttää exact generated filenamen ja pysyy truthful.
- [x] Vanhat/user-renamed valid files importtautuvat contentin perusteella.
- [x] Schema/content/transactions/persistence/Undo eivät muutu.
- [x] Sensitive/untrusted dataa ei tule filenameen.
- [x] Unit-, selain-, arkkitehtuuri- ja diff-evidence läpäisee; lopullinen
      repository gate on kirjattu testing evidenceen.
- [x] Living docs kuvaa nykyisen toteutuksen.

## Lopuksi

Raportoi viiden artifactin included/excluded-matriisi, example-filenamet yhdellä
frozen timestampilla, old-name compatibility, truthful download outcomes ja
kaikki ympäristökohtaiset checkit joita ei voitu ajaa.
