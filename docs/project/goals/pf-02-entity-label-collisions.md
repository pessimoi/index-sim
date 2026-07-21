# Goal

- Id: PF-02
- Status: completed 2026-07-21
- Priority: high
- Estimated effort: M
- Parent specification:
  [Entity label collision disambiguation](../../technical/entity-label-collision-disambiguation-spec.md)
- Depends on: current generated snapshot and existing source-name-first
  presentation; manual VoiceOver/NVDA gate remains separate

## Tavoite

Toteuta collision-aware entity- ja row-labelit niin, että eri item-id:t tai eri
toiminnalliset Loot-rivit eivät koskaan näytä tai kuulosta samalta samassa
valinta-/toimintakontekstissa.

Säilytä source-backed nimi ensisijaisena, käytä tunnetuille törmäyksille
katselmoitua semanttista descriptoria ja käytä epävarmassa tapauksessa selvästi
nimettyä exact-id-fallbackia. Älä muuta generated dataa tai domain-identiteettiä.

## Feature-inventory-tarkistus

`Basic combat setup`, `Loot/economy summary`, `Market price sync` ja `Planner`
ovat `Valmis`. Tämä on niiden erillinen identity/accessibility-laatuaukko.
Automaattinen saavutettavuustyö voidaan toteuttaa tässä goalissa, mutta avoin
VoiceOver/NVDA-manuaalinen release gate ei sulkeudu ilman oikeaa manuaaliajoa.

## Aloita tästä

Lue standardin aloituksen lisäksi:

- `docs/technical/entity-label-collision-disambiguation-spec.md`
- `docs/technical/user-facing-language-units-information-hierarchy-spec.md`
- `docs/technical/assistive-technology-accessibility-spec.md`
- `src/app/view-models/presentation-language.ts`
- `src/app/components/form-fields.tsx`
- `src/app/view-models/loot.ts`
- `src/app/view-models/price-data.ts`
- `src/app/view-models/planner.ts`
- `src/data/generated/game-data.json`
- nykyiset selector-, Loot-, Economy-, Planner- ja accessibility-testit

Generoi/read-only-inventoi aktiivisen snapshotin normalisoidut item- ja monster-
name-collisionit ennen koodausta. Varmista ainakin key-half-, dragonhide-, Guam
leaf- ja toistuvat Coins-row -tapaukset.

## Toteutusvaatimukset

1. Lisää pure snapshot-explicit collision index. Älä käytä aktiiviseen runtimeen
   sidottua globaalia singletonia.
2. Lisää typed, bounded semantic descriptor -rekisteri vähintään:
   `loop_half_key`, `tooth_half_key`, `dragonhide_black`, `dragonhide_blue`,
   `dragonhide_green` ja `dragonhide_red`.
3. Toteuta parent-specin precedence: unique base name → semantic descriptor →
   labelled exact id → nykyinen humanized fallback.
4. Päivitä searchable selector -view model ja komponentti niin, että näkyvä
   label/hint sekä eksplisiittinen accessible label muodostavat yksiselitteisen
   option-nimen. Haku löytää base-nimen, descriptorin ja exact id:n.
5. Päivitä Economy-, Loot-, Planner- ja contextual action -labelit käyttämään
   yhteistä resolveria.
6. Toteuta row-collision-vaihe: quantity/chance ennen deterministic source-order
   ordinalia. Älä käytä nykyistä table-sort-järjestystä ordinalin lähteenä.
7. Lisää active-snapshot audit -testi, joka listaa collision groupit ja estää
   uuden collisionin ilmestymisen ilman descriptor/fallback-katselmusta.
8. Todista testeissä, että React key, persistence, calculation, price lookup ja
   domain request käyttävät edelleen exact entity/row id:tä.

`guam_leaf`/`herb_guam`-suhdetta ei saa päätellä yhtä suuren nimen, hinnan tai
sourceRefin perusteella. Käytä exact-id-fallbackia, ellei tässä työssä löydy
koodista/lähde-evidencestä yksiselitteistä semanttista omistajaa; dokumentoi
löydös avoimena kysymyksenä.

## Rajaukset

Älä:

- muuta generated item/monster/drop -nimiä tai schemaa;
- mergeä item-identiteettejä tai Loot-rivejä;
- muuta price alias -karttaa, drop chancea, quantitya tai expected GP:tä;
- käytä hintaa, hintaa vastaavaa aria-hidden-sisältöä tai hintaa ilman
  accessible-nimeä ainoana erotteluna;
- väitä manuaalista AT-porttia suoritetuksi ilman oikeaa ajoa; tai
- päivitä visual baselineja automaattisesti.

## Pakolliset testit

```sh
npm run test -- src/tests/presentation-language.test.ts src/tests/searchable-select-field.test.tsx src/tests/loot-view-model.test.ts src/tests/loot-pane.test.ts src/tests/price-data-view-model.test.ts src/tests/economy-settings-pane.test.ts src/tests/planner-ui-adapter.test.ts src/tests/accessibility-manifest.test.ts
npm run typecheck
npm run architecture:check
npm run test:a11y
npm run test:e2e -- --workers=1 --grep "disambiguates colliding entity labels"
npm run verify
git diff --check
```

Lisää e2e-tapaus, joka valitsee molemmat key-half-id:t ja kaikki neljä
dragonhide-id:tä näppäimistöllä, tarkistaa Economy/Loot-action-nimet ja todistaa
toistuvien Coins-rivien säilyvän laskennallisesti erillisinä. Sisällytä desktop,
compact landscape, 390 px ja 320 CSS px / 200% text -evidence.

Aja relevantti visual suite read-only. Kirjaa VoiceOver/NVDA `not run`, ellei
oikea manuaaliproseduuri suoritettu.

## Dokumentaatiopäivitykset

- merkitse parent-spec toteutetuksi vasta complete automated evidence jälkeen;
- päivitä backlog-kortti `Done`-tilaan;
- päivitä feature inventoryn entity-label/current workflow -teksti;
- päivitä active collision audit -määrät/tulokset toteutusevidencenä;
- pidä manual AT gate avoimena ja linkitä sen rerun-tarve; ja
- merkitse tämä goal completed-tiedolla ja todellisilla checkeillä.

## Done

- samassa listboxissa ei ole kahta samaa accessible option -nimeä;
- samassa action-kontekstissa ei ole kahta erottamatonta row-action-nimeä;
- tunnetut key-half/dragonhide-törmäykset käyttävät semanttista descriptoria;
- epävarma collision käyttää exact-id-fallbackia ilman arvausta;
- haku, keyboard select ja exact-id-mutaatio toimivat;
- laskenta, persistence, price lookup ja generated data ovat muuttumattomia;
- focused-, a11y-, browser-, verify- ja diff-tarkistukset läpäisevät; ja
- manuaalisen AT-portin tila raportoidaan totuudenmukaisesti.

## Completion evidence · 2026-07-21

- Snapshot-explicit collision resolution now covers Loadout, monster, Loot,
  Economy and Planner presentation without changing generated names, exact ids,
  React/storage keys, calculations, PriceSet aliases or persistence schemas.
- The active audit freezes 25 item collision groups and zero monster groups.
  The six required ids use `loop half`, `tooth half`, `black`, `blue`, `green`
  and `red`; every unreviewed group, including `guam_leaf`/`herb_guam`, uses a
  labelled exact-id fallback rather than inferred meaning.
- Repeated actionable rows use quantity/chance and then deterministic
  source-order ordinals. Hobgoblin (armed)'s seven Coins actions are unique and
  retain separate stable row ids and calculations.
- Focused coverage passes 61/61, automated accessibility 13/13, the named
  four-viewport/zoom Chromium transaction 1/1, startup 1/1, typecheck, lint and
  the 173-module/159-client-reachable architecture check. The final artifact is
  276,038 raw / 83,402 gzip direct-entry bytes across 21 JavaScript chunks.
- The final clean cumulative `npm run verify` rerun passes 115/115 Vitest files
  and 1,102/1,102 tests, 19/19 goldens, typecheck, lint, formatting, the
  174-module/160-client-reachable architecture check, build and artifact
  validation. The 28-file artifact has 21 JavaScript chunks, a 276,038 raw /
  83,401 gzip direct entry and SHA-256
  `75581ad5c6ab09c63501182ece97724fd7eb23b5949d150e06c41009e8f51621`.
- Read-only visual evidence matched 5/8 relevant baselines; three expected
  wrapping/layout diffs were inspected and no baseline was written.
  VoiceOver/Safari and NVDA/browser are `not run`.

## Lopuksi

Raportoi collision auditin ryhmät, semantic descriptor -rekisteri, exact-id-
fallbackiin jääneet ryhmät, kaikkien affected surfacejen lista sekä automaattisen
ja manuaalisen saavutettavuusnäytön erilliset tilat.
