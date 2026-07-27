# Arkkitehtuuriauditointi 2026-07-14

- Status: historical
- Date: 2026-07-14
- Owner: project documentation
- Evidence: verified

Tämä raportti kuvaa repositoryn nykyisen Vite/React-, Web Worker-, data- ja
Cloudflare Worker -tuotantopolun lähdekoodiin perustuvan auditoinnin. Nykyisen
arkkitehtuurin totuuslähde on
[`docs/technical/architecture.md`](../technical/architecture.md). Historiallinen
2026-07-13 toteutus- ja refaktorointisnapshot säilyy tiedostossa
[`ARCHITECTURE_AUDIT.md`](../../ARCHITECTURE_AUDIT.md).

Auditoinnin alussa tarkastettu HEAD oli
`c6796f057209d2ba67c2954333f2de7995ca51d2`. Työpuussa oli ennestään
tietoturva-auditin muutoksia; ne säilytettiin ja huomioitiin yhteisessä
validoinnissa.

Toteutuspäivitys 2026-07-14: käyttäjä aktivoi ARCH-2026-01:n ja ARCH-2026-02:n
auditin jälkeen. MonsterCard- ja target-option-vastuut siirrettiin speksin
mukaiseen suoraan omistajaan ilman compatibility-re-exportteja tai toista
composed-polun combat-simulaatiota. Legacy-migraation julkinen omistaja säilyi,
mutta exact-key-sopimus, raportti, setup-mapper sekä setup-, preference- ja
price/review-inspektorit saivat erilliset sisäiset omistajat. Toteutuspäivityksen
auditointihetken moduuligraafi oli 121/109. App-, Trip-, generaattori- ja
Worker-rajat on lisäksi suljettu
omilla retention/trigger-speksillään, ja tarkat nykytilatiedot ovat
[`architecture.md`](../technical/architecture.md)-dokumentissa.

## Yhteenveto

- P0- tai P1-tasoista arkkitehtuurivirhettä ei löytynyt.
- Auditointihetken tuotantograafissa oli 121 lähdemoduulia, joista 109 oli client-entrypointista
  saavutettavia. Graafissa ei ole syklejä, kiellettyjä kerrossuuntia,
  dokumentoituja poikkeuksia, selittämättömiä orpoja tai vanhentuneita
  entrypoint-luokituksia.
- `src/domain` ei riipu Reactista, app-, adapteri-, data- tai serverikerroksesta
  eikä lue selain- tai verkkoglobaaleja. Selainvaikutukset pysyvät Appin,
  ohjainten, komponenttien tai adapterien eksplisiittisissä rajoissa.
- Root-tuotantopolku käyttää source-backed Revision 274 -snapshotia.
  `legacy-runtime` ja `static-runtime` eivät ole client-entrypointista
  saavutettavia.
- Aiemman auditin suurimmat UI-keskittymät on purettu. Auditissa speksattu
  `simulation.ts`-raja toteutettiin jälkikäteen; App-, Trip-, generaattori- ja
  Worker-rajat olivat auditointihetkellä hyväksyttyjä tai ehdollisia.
- Auditissa ei muutettu laskentaa, persistenssiskeemoja, API-sopimuksia,
  käyttäjäpolkuja tai deployment-muotoa.

## Löydökset

| Tunnus       | Vakavuus    | Tila                       | Löydös ja vaikutus                                                                                                                                                                                                                                                                                                                                                                                           | Toimenpide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARCH-2026-01 | Keskitaso   | Toteutettu auditin jälkeen | `src/app/view-models/simulation.ts` oli 476-rivinen cross-feature-koostaja, joka omisti pääsimulaation sopimuksen lisäksi MonsterCard-presentaatioperheen ja target-option builderin. Se ei kahdentanut domain-laskentaa, mutta piti kahden esitysvastuun muutos- ja export-pinnan yhdessä.                                                                                                                  | [`simulation-monster-card-view-model-refactor-spec.md`](../technical/simulation-monster-card-view-model-refactor-spec.md) on toteutettu. `simulation.ts` on 213 riviä, `monster-card.ts` 278 riviä, `FullSimulationResult` säilyy numeerisena totuutena eikä compatibility-re-exportteja lisätty.                                                                                                                                                                                                                    |
| ARCH-2026-02 | Matala      | Toteutettu auditin jälkeen | `src/app/state/legacy-storage-migration.ts` keskitti 1 799 riviin exact-key-politiikan ja setup-, Duel-, Dense-, hidden-tier- sekä loot-mappingin. Laaja tiedosto kasvatti review-pintaa, jos useita migraatioperheitä muutettiin yhtä aikaa. Käyttäjä aktivoi aiemmin ehdollisen jaon erillisenä goalina.                                                                                                   | [`legacy-migration-internal-split-spec.md`](../technical/legacy-migration-internal-split-spec.md) on toteutettu. 92-rivinen julkinen fasadi säilyttää yhden metadata-only inspectionin, exact clear -allowlistin, precedence-säännöt, D-048/D-049-rajat ja caller-owned atomic Applyn; kuusi sisäistä omistajaa ja neljä feature-testisviittiä rajaavat review-pintaa.                                                                                                                                               |
| ARCH-2026-03 | Matala      | Hyväksytty seurantaraja    | `src/app/App.tsx` on nykyisin 2 573-rivinen composition root ja omistaa 46 React-state-solua. Phase 4 -evidenssi osoittaa, että jäljellä olevat runtime-bootstrap-, persistenssi-, global Undo/status- ja cross-feature-transaction-vastuut ovat tarkoituksellisesti samassa omistajassa. Auditissa ei löytynyt uutta rinnakkaista laskentatotuutta, komponenttien suoria adapterikutsuja tai kerrosrikettä. | [`app-composition-root-retention-spec.md`](../technical/app-composition-root-retention-spec.md) hyväksyy nykyisen rajan ja määrittää konkreettiset defect-, change-scatter-, test-isolation-, dependency- ja performance-triggerit uudelleenavaamiselle. Broad reducer/context/catch-all-hook ei ole oletusratkaisu.                                                                                                                                                                                                 |
| ARCH-2026-04 | Matala      | Ehdollinen                 | `src/domain/trip/index.ts` (3 097 riviä) ja `scripts/game-data-generator-core.ts` (3 170) ovat suuria, mutta D-096-evidenssissä niillä ei ole osoitettua defect-, cycle-, dependency-, churn- tai test-isolaatio-ongelmaa.                                                                                                                                                                                   | Pidä jaot ehdollisina. Tripin toteutettu [`trip-domain-retention-spec.md`](../technical/trip-domain-retention-spec.md) säilyttää facade-, PriceSet-, warning-, tulos-, numeric- ja golden-sopimukset; generaattorin toteutettu [`game-data-generator-core-retention-spec.md`](../technical/game-data-generator-core-retention-spec.md) säilyttää parser-suunnan, path/output-hygienian ja deterministiset artifact-sopimukset. Aktivoi vain konkreettisesta evidenssistä.                                            |
| ARCH-2026-05 | Matala      | Toteutettu auditin jälkeen | Funktionaalinen Playwright-owner oli 5 046 riviä, yhdistetty view-model-testitiedosto 3 562 riviä ja testing-dokumentti 1 892 riviä. Tuotantokäyttäytyminen oli hyvin suojattu, mutta paikallinen review- ja testinavigointi oli raskasta.                                                                                                                                                                   | [`feature-test-suite-split-spec.md`](../technical/feature-test-suite-split-spec.md) on toteutettu: Playwright-testit on jaettu kahdeksaan feature-speciin yhteisen fixture-moduulin taakse, view-model-testit kahdeksaan feature-sviittiin oman fixture-moduulinsa taakse ja päivätty testing-historia [`testing-evidence.md`](testing-evidence.md)-omistajalle. Kaikki 78 Chromium-skenaariota ja 90 entistä yhdistettyä view-model-testiä säilyvät nimillään; `testing.md` säilyy nykyisten komentojen omistajana. |
| ARCH-2026-06 | Informaatio | Ulkoinen evidenssiraja     | Repository omistaa Cloudflare Worker -adapterin, asset/API-reitityksen ja deploy-validaattorit, mutta checkout ei todista preview-/production-instanssin reititystä, tiliasetuksia tai rollbackia.                                                                                                                                                                                                           | Käsittele live-väitteet adopter-operaatioina [`public-deployment-spec.md`](../operations/public-deployment-spec.md)-runbookin mukaan. Älä lisää uutta backendia, stateful-palvelua tai hosting-muotoa ilman päätöstä.                                                                                                                                                                                                                                                                                                |
| ARCH-2026-07 | Matala      | Hyväksytty seurantaraja    | Dense-, Planner-, Duel- ja Risk-taskit käyttävät mitattua one-shot Worker -rajaa. Raw-protokollan pelkkä `kind`-match on turvallinen vain yhden requestin Workerissa, ja synkronisen laskennan aktiivinen peruutus toimii Workerin terminoinnilla. Nykyinen evidenssi ei osoita persistent Worker -tarvetta.                                                                                                 | [`calculation-worker-retention-spec.md`](../technical/calculation-worker-retention-spec.md) säilyttää neljä controller-lifecyclea, 30 sekunnin hard-cancel-rajan ja mitatun overhead-evidenssin. Persistent-työ avataan vain kvantifioidusta budget-, repeated-demand-, clone- tai resource-triggeristä; tuleva protokolla tarvitsee version, context/request-id:t, generation-tarkistukset ja terminointiin perustuvan aktiivisen peruutuksen.                                                                      |

## Varmennetut rajat

- `index.html` käynnistää `src/app/main.tsx`:n; raskaat Dense-, Planner-, Duel-
  ja Risk-tehtävät kulkevat tyypitetyn calculation Worker -entrypointin kautta.
- Wrangler käynnistää `src/server/cloudflare-worker.ts`:n, ja Vite-kehityspolun
  kaksi middlewarea ovat erillisiä dokumentoituja ulkoisia entrypointeja.
- Kerrossäännöt estävät domainin ulospäin suuntautuvat riippuvuudet sekä appin ja
  serverin keskinäisen vuodot. Orpo- ja stale-entrypoint-tarkistus täydentää
  TypeScriptin unused-tarkistuksia.
- Presentaatiokomponentit saavat arvot ja intent-callbackit propsien kautta.
  Ne eivät käynnistä laskentaa, lue storagea tai kutsu adaptereita. Muutamat
  controller-importit ovat vain UI:n käyttämien tyypitettyjen outcome/notice-
  sopimusten compile-time-riippuvuuksia.
- `FullSimulationResult` on combat-, Trip-, XP- ja economy-tulosten yhteinen
  numeerinen koostetotuus. UI-view-modelit muotoilevat tuloksia eivätkä ylläpidä
  rinnakkaisia kaavoja.
- Generated runtime ladataan asynkronisen bootstrap-rajan takaa. Arkistoidut
  root-JS/JSX- ja legacy-adapterit ovat regression/reference-evidenssiä, eivät
  tuotantoentrypointteja.
- Nykyinen one-shot Worker -malli on mitattu ja sen
  [`retention/persistent-trigger-sopimus`](../technical/calculation-worker-retention-spec.md)
  on toteutettu. Persistent Worker ei ole perusteltu ilman kvantifioitua
  budget-, repeated-demand-, clone- tai production-resource-evidenssiä.

## Auditointievidenssi

Tarkastus kattoi entrypointit, TypeScript-resoluoidun moduuligraafin,
app/controller/state/component/view-model-omistajat, domain- ja datakerrokset,
generated-runtime-polun, Worker-protokollan, serveri- ja deploy-rajat,
TypeScript-projektit, suuret tuotanto- ja testiomistajat sekä nykyiset
arkkitehtuuri-, testaus-, backlog- ja päätösdokumentit.

Suoritetut tarkistukset:

- `npm run architecture:check`: 114 source-moduulia, 102 client-reachable,
  seitsemän dokumentoitua ulkoista entrypointia, ei cyclea, poikkeusta, orpoa
  tai stale-luokitusta
- domain-, selain-globaali-, kerros- ja app-sublayer-importtien staattiset
  `rg`-tarkistukset: ei uutta kiellettyä runtime-riippuvuutta
- `npm run test -- src/tests/legacy-migration-*.test.ts`:
  44/44
- `npm run typecheck`: läpäisty
- `npm run verify`: 65 testitiedostoa / 764 testiä, 19 erillistä goldenia,
  arkkitehtuuri, typecheck, build, artefaktitarkistus, lint, Prettier ja
  `git diff --check` läpäisty; dependency audit ohitettiin portin dokumentoidun
  network-disabled-sandbox-politiikan vuoksi
- tuotantoartefakti: 10 tiedostoa, 2 assettia, 1 977 623 tavua, entry
  720 793 raw / 208 770 gzip tavua ja SHA-256
  `8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`

Auditin jälkeinen ARCH-2026-02-toteutusevidenssi:

- fokusoitu migraatiokartta läpäisee 44/44 ja Import/Keep/Clear Chromium 3/3
- täysi Chromium-portti läpäisee 78/78
- `npm run verify` läpäisee 71 tiedostoa / 770 testiä sekä 19 goldenia
- arkkitehtuurigraafi on 121/109 ilman cyclea, poikkeusta tai orpoa
- tuotantoartefakti on 1 977 466 tavua; entry 720 528 raw / 208 747 gzip ja
  SHA-256 `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`

ARCH-2026-03:n hyväksytyn rajan jälkitarkastus vahvisti Appista 46 state-solua
ja yhdeksän effectiä: seitsemän suoraa persistenssiomistajaa, bootstrap-Applyn
ja minuuttikellon. Kuusi fokusoitua shell/controller-sviittiä läpäisee 57/57 ja
full verify 71 tiedostoa / 770 testiä sekä 19 goldenia. Lähdekoodia ei muutettu,
koska defect-, dependency-, test-isolation-, change-scatter- tai performance-
triggeriä ei löytynyt.

ARCH-2026-07:n jälkitarkastus vahvisti neljän request-kindin raw-protokollan,
30 sekunnin timeoutin, kaikissa settlement-polussa terminoinnin sekä Dense-,
Planner-, Duel- ja Risk-controllerien erilliset freshness/cancel-vastuut.
Fokusoitu task/controller/performance-portti läpäisee 22/22 ja arkkitehtuuri
121/109 ilman cyclea tai poikkeusta. Numeric-audit läpäisee 5 958/5 958,
goldenit 19/19 ja full verify 71 tiedostoa / 770 testiä sekä 19 erillistä
goldenia. Production-lähdekoodia ei muutettu.

ARCH-2026-05:n toteutuksen jälkitarkastus vahvisti testinimien säilymisen
75/75 funktionaaliselle scaffold-rajalle ja 90/90 yhdistetylle
view-model-rajalle. Playwright kerää yhä 78 testiä yhdeksästä
feature-specistä, ja täysi Chromium-portti läpäisee 78/78 yhdellä workerilla.
Fokusoitu view-model-, formatting- ja MonsterCard-portti läpäisee 98/98,
numeric-audit 5 958/5 958 ja goldenit 19/19. Full verify läpäisee 78
testitiedostoa / 770 testiä sekä arkkitehtuuri-, typecheck-, build-, artefakti-,
lint-, format- ja diff-portit. Jako ei muuta production-lähdekoodia,
Playwright-konfiguraatiota tai visuaalisia fixtureita.

Elävän portin komennot ja viimeisin koko repositoryn tulos omistaa
[`docs/technical/testing.md`](../technical/testing.md). Riippuvuuksien nykyinen
erillinen auditointievidenssi on
[`docs/project/security-audit.md`](security-audit.md).

## Avoimet kysymykset

- Milloin legacy/reference-runtime voidaan poistaa ilman golden-, generator- tai
  rollback-evidenssin menetystä?
- Kuka kerää ensimmäisen Cloudflare preview/production -evidenssin ja vahvistaa
  tilikohtaiset reititys-, lokitus- ja rollback-oletukset?
