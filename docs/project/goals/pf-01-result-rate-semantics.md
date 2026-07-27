# Goal

- Status: implemented
- Date: 2026-07-21
- Owner: project execution
- Evidence: verified

- Id: PF-01
- Priority: critical
- Estimated effort: M
- Parent specification:
  [Result rate semantics](../../technical/result-rate-semantics-spec.md)
- Depends on: no new implementation; use the existing `FullSimulationResult`
  rate fields

## Tavoite

Toteuta yhtenäinen tuntinopeuksien semantiikka niin, että Result, mobiilin
tuloskonteksti, Dense Compare, tallennettujen setupien vertailu, Trip ja Planner
käyttävät ensisijaisissa päätösarvoissa samaa koko Trip-syklin effective-pohjaa.
Säilytä on-site-arvot Statsin selvästi nimettyinä diagnostisina arvoina.

Valmis toteutus ei muuta yhtään combat-, Trip-, loot-, supply-, XP-, Planner-
tai Risk-kaavaa.

## Feature-inventory-tarkistus

`Result summary`, `Dense spreadsheet view`, `Setup comparison`, `Trip controls`
ja `Planner` ovat `Valmis`. Tämä goal ei rakenna niitä uudelleen, vaan korjaa
niiden välisen erillisen semanttisen laatuvirheen: nykyinen UI yhdistää on-site
`killsPerHour`/`gpPerHour`-arvot effective XP/net GP -arvoihin kuin ne jakaisivat
saman aikapohjan.

## Aloita tästä

Lue standardin aloituksen lisäksi kokonaan:

- `docs/technical/result-rate-semantics-spec.md`
- `docs/technical/user-facing-language-units-information-hierarchy-spec.md`
- `src/domain/simulation/index.ts`
- `src/app/view-models/app-shell.ts`
- `src/app/view-models/stats.ts`
- `src/app/view-models/compare.ts`
- `src/app/view-models/duel.ts`
- `src/app/view-models/trip.ts`
- `src/app/state/dense-compare.ts`
- vastaavat pane-komponentit ja nykyiset focused-testit

Tee ennen muokkausta `rg`-inventaario kaikista `killsPerHour`, `effectiveKph`,
`gpPerHour`, `effectiveGpPerHour`, `effectiveXpPerHour` ja
`effectiveNetGpPerHour` -kuluttajista. Luokittele jokainen primary-, diagnostic-
tai domain-only-kuluttajaksi.

## Toteutusvaatimukset

1. Lisää testifixture, jossa banking/travel efficiency tekee
   `killsPerHour !== effectiveKph` ja `gpPerHour !== effectiveGpPerHour`.
2. Vaihda Resultin ja mobiilikontekstin ensisijaiset tuntiarvot käyttämään
   `effectiveKph`, `effectiveXpPerHour`, `effectiveGpPerHour` ja
   `effectiveNetGpPerHour` yhdessä.
3. Korjaa Statsin nykyinen `Kills/hr` on-site-arvoksi, nimeä ja kuvaa se
   pre-banking-arvona sekä säilytä erillinen `Effective kills/hr`.
4. Vaihda Dense Comparen näkyvä arvo, sorttaus ja best-marker käyttämään
   effective kills/gross GP -arvoja. Säilytä nykyiset persistoidut sort-id:t
   yhteensopivina; älä lisää storage-migraatiota.
5. Vaihda saved-setup-rivien kills/hr-arvo, delta, sorttaus ja best-marker
   käyttämään `effectiveKph`.
6. Tarkista Duel-matriisin ja Plannerin nykyiset effective-arvot. Muuta vain
   puuttuvat näkyvät/accessibility-labelit; älä vaihda niiden laskentalähteitä.
7. Päivitä Tripin/Cannonin mahdolliset lyhenteet niin, että effective- tai
   on-site-pohja on aina näkyvä tai täydellisessä accessible-nimessä.
8. Lisää regressiotesti, joka estää paljaan semanttisesti epäselvän `KILLS/HR`,
   `GP/HR` tai `K/hr` -labelin nimetyissä primary-pinnoissa.

Komponentit saavat valmiit labelit ja arvot view modeleilta. Älä valitse domain-
kenttää uudelleen komponentissa.

## Rajaukset

Älä:

- muuta `FullSimulationResult`-kenttiä tai niiden kaavoja;
- muuta Trip efficiency-, cannon occupancy-, scarce spot-, loot- tai supply-
  laskentaa;
- muuta Plannerin optimointikaavoja tai Risk-jakaumia;
- muuta setup-, Dense-, share- tai persistence-skeemaversioita;
- poista on-site-arvoja Statsista; tai
- päivitä visual baselineja ilman erillistä katselmusta ja lupaa.

## Pakolliset testit

Lisää focused-unit/view-model-testit vähintään olemassa oleviin omistajiin ja
aja:

```sh
npm run test -- src/tests/full-simulation-result.test.ts src/tests/app-shell-view-model.test.ts src/tests/stats-view-model.test.ts src/tests/compare-view-model.test.ts src/tests/duel-view-model.test.ts src/tests/trip-view-model.test.ts src/tests/planner-domain.test.ts
npm run typecheck
npm run architecture:check
npm run test:golden
npm run test:e2e -- --workers=1 --grep "effective hourly rates"
npm run verify
git diff --check
```

Lisää production-preview Playwright -tapaus nimellä, jonka grep löytää. Sen
tulee todistaa Result/Stats/Trip/Dense/saved-setup-arvojen yhteinen pohja,
Trip-inputin vaikutus effective-arvoihin ja mobiilin täydelliset accessible-
nimet.

Aja `npm run test:e2e:visual` read-only-tilassa, jos ympäristö tukee Darwin-
baselineja. Jos ei tue, merkitse se `not run`; älä päivitä baselineja.

## Dokumentaatiopäivitykset

Kun kaikki pakollinen näyttö on valmis:

- merkitse parent-spec toteutetuksi ja lisää todelliset tiedostot/testit;
- muuta backlogin PF-01-kortti `Done`-tilaan;
- päivitä Result/Stats/Dense/Setup comparison/Trip/Planner -nykytilateksti vain
  muuttuneen semantiikan osalta;
- päivitä tämä goal `completed`-tilaan ja lisää päivätty näyttö; ja
- älä muuta päätös- tai testausdokumentteja, ellei niiden omistama raja muuttunut.

## Done

Goal on valmis vasta kun:

- kaikki named primary -pinnat käyttävät effective-pohjaa;
- Statsin on-site-arvo on oikealla nimellä ja oikealla kuvauksella;
- display, sort, delta ja best-marker käyttävät samaa arvoa;
- vanhat Dense sort -preferenssit latautuvat;
- kaavat, domain-resultit ja persisted skeemat ovat muuttumattomia;
- focused-, golden-, browser-, verify- ja diff-tarkistukset läpäisevät; ja
- dokumentaatio kuvaa toteutetun nykytilan eikä suunnitelmaa.

## Completion evidence · 2026-07-21

- Result, mobile context, Dense, saved setup, Trip and Planner now use the
  whole-Trip effective rate basis for their primary hourly decisions. Stats and
  cannon source detail retain explicitly named on-site diagnostics.
- The frozen cannon fixture proves the two bases differ: on-site/effective
  kills are `356.795683`/`350.022327`, and on-site/effective gross GP are
  `31,138.335147`/`30,547.21` per hour.
- Dense's existing persisted sort ids remain readable, while displayed values,
  sort order and best markers use effective kills and effective gross GP.
  Saved setup values, deltas, ordering and best markers use effective kills.
- The required focused suites pass 59/59, goldens pass 19/19, typecheck and the
  173-module architecture check pass, and the named production-preview browser
  transaction passes. The complete functional Chromium evidence is 135
  immediately passing cases plus four corrected copy expectations that pass on
  targeted rerun; the final six-case rate/result/mobile rerun also passes.
- The clean `npm run verify` gate passes 1,088/1,088 unit tests, 19/19 goldens,
  typecheck, architecture, production build, artifact, lint, format and diff
  checks. The final entry artifact is 229,983 gzip bytes against the
  230,000-byte budget; only the gate's documented network-disabled dependency
  audit is skipped.
- The Darwin visual suite was run read-only: 11/26 baselines matched and 15/26
  expected label/layout diffs were reviewed. The final four-viewport mobile
  rerun reproduced the expected diffs without clipping or structural breakage.
  No baseline was written.

## Lopuksi

Raportoi erityisesti fixture-arvot, joilla on-site ja effective ero todistettiin,
kaikki pinnat joiden kenttävalinta muuttui sekä visual/browser-evidence, jota ei
voitu ajaa.
