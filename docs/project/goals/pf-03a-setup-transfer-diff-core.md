# Goal

- Id: PF-03A
- Status: completed 2026-07-21
- Priority: high
- Estimated effort: M
- Parent specification:
  [Setup transfer complete change review](../../technical/setup-transfer-change-review-spec.md)
- Depends on: implemented setup-file parser, contextual compatibility,
  replacement Apply/Dismiss/Undo and active-setup diff formatters
- Followed by:
  [PF-03B](pf-03b-setup-transfer-review-surfaces.md), which closes shared-link
  and saved-row paths

## Tavoite

Rakenna yksi exhaustive, allowlisted ja DOM-vapaa setup change -ydin sekä ota
se käyttöön combat setup -tiedoston tuontikatselmuksessa. Käyttäjän tulee nähdä
kaikki tiedoston apply-scopeen kuuluvat `Current → Incoming` -muutokset ennen
Applyta, ja vanhentunut katselmus on estettävä sekä renderissä että synkronisessa
Apply-tarkistuksessa.

Tämä on parent-speksin ensimmäinen toteutusosa. Älä merkitse koko speksiä
valmiiksi tässä goalissa.

## Feature-inventory-tarkistus

`Basic combat setup` ja setup import/export ovat `Valmis`. Nykyinen import
validoi, katselmoi, Applyaa ja Undoaa jo turvallisesti, mutta katselmus näyttää
vain target/style/mode/count/sort-yhteenvedon. Tämä goal syventää jo olemassa
olevan tiedostopolun informed-consent-katselmusta eikä muuta formatteja tai
transaktiota.

## Aloita tästä

Lue standardin aloituksen lisäksi:

- `docs/technical/setup-transfer-change-review-spec.md`
- `docs/technical/setup-replacement-review-undo-spec.md`
- `docs/technical/game-revision-transfer-context-spec.md`
- `src/app/state/ui-state.ts`
- `src/app/state/active-setup-reset.ts`
- `src/app/view-models/setup-import-review.ts`
- `src/app/controllers/setup-file-transfer.ts`
- setup import/review conditional componentit ja `App`-compositio
- `src/tests/setup-import.test.ts`
- `src/tests/setup-file-transfer-controller.test.ts`
- `src/tests/setup-import-review.test.tsx`
- `src/tests/active-setup-reset.test.ts`
- `src/tests/saved-setup-changes.test.ts`
- setup-importin nykyinen Playwright-polku

Inventoi `CombatSetupFormSchema` ja `SavedSetupSchema` jokainen leaf ja nykyiset
semantic formatterit. Älä aloita geneerisellä object walkerilla.

## Toteutusvaatimukset

### 1. Shared diff core

- Luo pure owner typed group/field/value -malleille, canonical normalizationille,
  opaque current/incoming fingerprintille ja change countille.
- Lisää eksplisiittinen field registry, joka kattaa parent-specin kaikki form-
  leafit sekä SavedSetupState-kokoelmat.
- Käytä source-backed entity-labelia ja nykyisiä `Auto`/`None`/unit/boolean-
  formatteja; älä näytä raw id:tä, schema pathia tai sentinel-arvoa.
- Lisää schema-drift guard: uusi leaf failaa testin kunnes se on luokiteltu
  näkyväksi, normalisoiduksi toisen kentän kanssa tai dokumentoidusti pois.
- Normalisoi set-like-kentät semanttisesti ja säilytä järjestys vain, jos
  nykyinen domain pitää sitä merkityksellisenä.

### 2. Setup file groups

Toteuta parent-specin 13 ryhmää samassa järjestyksessä. Custom setup- ja cannon-
kokoelmissa näytä Added/Removed/Changed/Unchanged per exact monster id ja anna
Changed-entrylle täydellinen nested diff.

Älä capaa underlying reviewta. Pidä DOM bounded renderöimällä collection index
ja vain avoinna olevan entryn leaf-rivit.

Dense preferences näyttää sortin sekä lisätyt/poistetut hidden/irrelevant-
monsterit, ei vain counttia.

### 3. Candidate/stale lifecycle

- File parse tuottaa edelleen nykyisen validated candidate -objektin.
- Valmistelussa capturea exact included-scope current fingerprint ja complete
  review ilman mutaatiota.
- Included-scope live-muutos tekee reviewsta stale; PriceSet tai muu excluded
  muutos ei tee.
- Stale UI säilyttää incoming candidaten, disabloi Applyn ja tarjoaa
  `Refresh comparison` sekä `Dismiss`.
- Refresh käyttää samaa parsed candidatea ja uusinta current statea.
- Apply tekee synkronisen fingerprint-recheckin ennen candidaten consumea.
- `No changes` disabloi Applyn eikä tee persistenceä tai Undo-slotia.
- Changed Apply delegoi muuttumattomaan kuuden familyjen persistence/Undo-
  transaktioon.

### 4. Review UI

- Säilytä nykyinen shell-level conditional review ja focus-return.
- Näytä context, included/excluded scope ja total change count ennen detailia.
- Changed-ryhmät auki, unchanged-ryhmät kiinni; käytä semanttisia disclosureja.
- Pidä Apply/Dismiss saavutettavana ilman tuhansien rivien läpikäyntiä, mutta
  content tulee lukujärjestyksessä ennen actioneita.
- Mobiilissa stackaa `Current` ja `Incoming`; älä tee overflow-taulukkoa.

## Rajaukset

Tässä goalissa älä:

- muuta setup/share/saved-row envelopea, parseria tai schema-versiota;
- muuta compatibility-, Apply-, persistence-, Dismiss- tai Undo-politiikkaa;
- laske DPS/XP/GP/Risk-impactia reviewssa;
- toteuta shared-link- tai saved-row-UI-integraatiota (PF-03B);
- näytä raw JSONia, storage keytä, source pathia, filenamea tai fingerprintiä;
- lisää backendia, accountia tai cross-device-synkkaa; tai
- merkitse parent-speksiä/backlog-korttia `Done`-tilaan.

## Pakolliset testit

```sh
npm run test -- src/tests/setup-import.test.ts src/tests/setup-file-transfer-controller.test.ts src/tests/setup-import-review.test.tsx src/tests/active-setup-reset.test.ts src/tests/active-setup-reset-review.test.tsx src/tests/saved-setup-changes.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "reviews every setup file change"
npm run verify
git diff --check
```

Lisää fixture, joka muuttaa jokaisen form-leafin, inactive per-style loadoutin,
Tripin, Planner-targetin, defaultin, custom setupit, cannonin ja Dense-
preferenssit. Todista jokaisen ilmestyvän täsmälleen kerran oikeaan ryhmään.

Lisää Playwright-tapaus setup-importin nykyiseen omistajaan. Sen tulee testata
complete disclosure, included/excluded stale-ero, Refresh, no-op, Apply ja Undo
sekä 390 px / compact-landscape containment.

Aja relevantti visual suite read-only, jos ympäristö tukee sitä. Älä kirjoita
baselineja ilman erillistä katselmusta.

## Dokumentaatiopäivitykset

PF-03A:n valmistuessa:

- muuta parent-specin status `partially implemented` -tilaan;
- lisää PF-03A:n todelliset files/checks ja nimeä PF-03B ainoaksi jäljellä
  olevaksi toteutusosaksi;
- muuta backlog-kortti `Partial`-tilaan samalla rajalla;
- päivitä setup importin current-state-teksti vain toteutetun file-reviewn osalta;
- merkitse tämä goal `completed`; ja
- älä muuta PF-03B-goalia tai parent-speksiä valmiiksi.

## Done

- shared diff core ja schema-drift guard ovat käytössä;
- setup file review näyttää kaikki changed arvot ja collection-entryt;
- included-scope muutos staleaa, excluded-scope muutos ei;
- sync Apply guard estää race-Applyn;
- no-op ei mutatoi eikä luo Undoa;
- existing Apply/persistence/Undo säilyy;
- focused-, browser-, verify-, architecture- ja diff-checkit läpäisevät; ja
- dokumentaatio merkitsee parentin tarkasti osittain toteutetuksi.

## Completion evidence · 2026-07-21

- `src/app/state/setup-transfer-changes.ts` owns the DOM-free typed review
  model, canonical semantic fingerprint and explicit field registries. A
  schema-drift test compares the registry with every parsed physical
  `CombatSetupFormSchema` leaf; active top-level loadout mirrors are explicitly
  normalized to the active per-style cache so each semantic value appears once.
- Setup-file review now renders all 13 required groups in order. Added, removed,
  changed and unchanged custom/cannon entries are classified by exact monster
  id, Dense changes list exact sort/filter/irrelevant transitions, and the full
  underlying diff is retained while only one collection entry's leaf DOM is
  materialized at a time.
- The setup transfer controller captures only normalized `SavedSetupState` in
  its opaque current fingerprint. Applicable setup changes stale the review;
  PriceSet and every other excluded family do not. Refresh reuses the same
  parsed candidate, and `consumeReview` performs the synchronous final
  fingerprint check.
- No-op review disables Apply and creates no persistence or Undo action. Changed
  Apply still delegates to the unchanged six-family persistence-aware
  transaction, and the browser transaction proves complete Apply and Undo.
- The required focused line plus the new exhaustive suite pass 45/45. The named
  Chromium transaction passes 1/1 and covers all groups, exclusive collection
  disclosure, excluded/included stale behavior, Refresh, no-op, keyboard
  actions, Apply/Undo, 390 px mobile and compact landscape containment.
  Typecheck, lint and the 174-module/160-client-reachable architecture check
  pass.
- The clean cumulative `npm run verify` gate passes 115/115 Vitest files and
  1,102/1,102 tests, 19/19 goldens, formatting, build and artifact validation.
  The 28-file artifact has 21 JavaScript chunks, a 276,038 raw / 83,401 gzip
  direct entry, 2,419,361 total bytes and SHA-256
  `75581ad5c6ab09c63501182ece97724fd7eb23b5949d150e06c41009e8f51621`.
- No visual baseline was written. There is no setup-import scenario in the
  current visual owner; the owned browser test provides the required responsive
  containment evidence.
- At PF-03A completion, PF-03B remained the exact outstanding parent scope:
  integrate this registry and lifecycle into shared-link review and saved-row
  Load review, including their loot/cannon scope, stale/no-op behavior and
  combined regression evidence. PF-03B's own goal now records that later
  completion.

## Lopuksi

Raportoi field-registry/exhaustiveness-menetelmä, 13 ryhmän coverage, stale-
fingerprintin scope, no-op/Apply/Undo-evidence ja PF-03B:lle jäävä täsmällinen
raja.
