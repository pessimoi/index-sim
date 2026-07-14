# Ylläpidettävyys- ja kuolleen koodin siivous 2026-07-14

Tämä raportti kirjaa laajan repositoryn rakenteen, kuolleen koodin,
testiomistajuuden, tyylien ja dokumentaatiototuuden siivouskierroksen. Se on
päivätty auditointievidenssi, ei uusi arkkitehtuurin tai testikomentojen
totuuslähde. Nykyiset rajat omistaa
[arkkitehtuuri](../technical/architecture.md), nykyiset testikomennot
[testausopas](../technical/testing.md) ja tuleva työ [backlog](backlog.md).

Auditoinnin alussa tarkastettu HEAD oli
`c6796f057209d2ba67c2954333f2de7995ca51d2`. Työpuussa oli ennestään laajoja
käyttäjän auditointi-, refaktorointi-, dokumentaatio- ja testimuutoksia. Niitä
ei palautettu eikä kirjoitettu tarkoituksella yli; tämä kierros täydentää samaa
työpuuta erikseen todennetuilla ylläpitomuutoksilla.

## Tulos

- 21 käytötöntä exportoitua deklarointia tai apufunktiota poistettiin 13
  lähde- ja testiaputiedostosta. Poistoketjut tarkistettiin uudelleen jokaisen
  riippuvuuden jälkeen; jäljelle ei jäänyt yhden tekstiosuman export-kandidaattia.
- Rewrite-tyyleistä poistettiin 18 luokkaa vastaavaa käyttämätöntä
  selector-perhettä ja arkistoiduista legacy-tyyleistä käyttämätön
  `.term`-perhe. Kuusi merkkijonolla rakennettua aktiivista luokkaa säilytettiin.
- 5 046 rivin funktionaalinen Playwright-omistaja jaettiin kahdeksaan
  feature-speciin sekä yhteiseen fixture-lehteen. Nykyinen oletuskeräys pysyy
  78 testissä / yhdeksässä spec-tiedostossa.
- 3 562 rivin koostettu UI view-model -testi jaettiin kahdeksaan
  feature-suiteen sekä yhteiseen fixture-lehteen. Kaikki 90 alkuperäistä
  testinimeä säilyvät; yleinen formatointitesti siirtyi omaan olemassa olevaan
  omistajaansa.
- `docs/technical/testing.md` erotettiin lyhyeksi nykyisen portin ja
  reitityksen omistajaksi. Kolme aihekohtaista living guidea sisältävät
  yksityiskohtaiset komennot ja [erillinen projektievidenssi](testing-evidence.md)
  päivättävät tai syrjäytetyt ajotulokset.
- Lähdekoodin, scriptien, npm-komentojen, fixtureiden, visuaalibaselinejen,
  Markdown-linkkien, suppressioiden ja testiohitusten inventaario ei osoittanut
  muuta turvallisesti poistettavaa tiedostoa.

## Poistettu kuollut koodi

| Alue                       | Poistettu                                                                                                                                                                                                                                                            | Peruste                                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data- ja schema-rajat      | `DataReliabilityIssue`, `EquipmentBonusesSchema`, `ValidatedGameDataSnapshot`, kolme live-integraation `Validated*`-aliasta, objektimuotoinen `parseIntegrationErrorResponse`, kaksi legacy-price-history-skeemaa, kolme PriceSet-tyyppialiasta ja `ToolchainHealth` | Repositoryhaku löysi vain deklaroinnin tai barrel-reexportin; aktiiviset parserit, JSON-rajat ja inferred domain-tyypit säilyvät.                                                    |
| Adapterit                  | `readTextFile`, `readPriceSetFile` ja async-kääre `loadLegacyDerivedStaticRuntimeContext`                                                                                                                                                                            | Ei kutsuja. Aktiivinen tekstiparseri, fetch-polku ja synkroninen legacy-derived reference-context säilyvät.                                                                          |
| UI state / view-model      | `DenseCompareSortDirection`, `LegacyMigrationDismissedState` ja `WorkbenchNavigationKey`                                                                                                                                                                             | Ei tyyppikuluttajia; niitä vastaavat aktiiviset Zod-skeemat tai runtime-vakiot säilyvät.                                                                                             |
| Economy- ja Planner-domain | `lookupAlchValue` ja `xpBetween`                                                                                                                                                                                                                                     | Ei kutsuja. Käytössä oleva puuttuvien alch-arvojen varoituspolku käyttää edelleen yhteistä sisäistä lookupia; Plannerin aktiivinen XP-kertymä käyttää suoraan omaa laskentapolkuaan. |
| Testiapu                   | `buildPlannerPlanForDefinition` sekä sen jälkeen tarpeettomiksi jääneet importit                                                                                                                                                                                     | Ei yhtään testi- tai scriptikuluttajaa. Aktiiviset Planner-fixture- ja summary-apurit säilyvät.                                                                                      |

Poistoissa ei lisätty compatibility-reexporteja. Aktiivinen
`src/data/schemas/index.ts` säilyy laajasti käytettynä schema-rajana, ja
`src/domain/economy/index.ts` säilyy aktiivisena economy-julkirajana, joka myös
reexportoi canonical item ID -sopimuksen. Ne eivät ole kuolleita barrel-tiedostoja.

## CSS-inventaario

Staattinen selector-haku vertasi `src/app/styles.css`- ja `styles.css`-luokkia
kaikkiin repositoryn TS-, TSX-, JS-, JSX- ja HTML-kuluttajiin.

- Rewrite-polulta poistettiin käyttämättömät `field-hint`, `loot-impact-list`,
  `loot-detail-grid`, `placeholder-pane`, `row-custom-marker`, `setup-panel`,
  `gear-grid`, `market-report*`, `toggle-grid`, `results-panel`, `metric-row`,
  `content-grid`, `detail-list` ja `phase-list` -omistukset sekä niiden
  responsive-jäsenet.
- Arkistoidusta legacy-CSS:stä poistettiin `.term` ja sen kuusi käyttämätöntä
  token-jäsentä. Aktiiviseen `.scroll-vis`-sääntöön jäänyt vanha design-canvas-
  kommentti korvattiin nykyistä tarkoitusta kuvaavalla kommentilla.
- `dense-scale-negative`, `dense-scale-neutral` sekä neljä
  `row-state-marker-*`-luokkaa säilytettiin, koska JSX rakentaa ne aktiivisesti
  `dense-scale-${scale.tone}`- ja `row-state-marker-${marker.id}`-muodoissa.
- Jälkitarkistus ei löytänyt muita puuttuvia legacy-kuluttajia; rewrite-haun
  ainoat tekstinä puuttuvat täydet luokkanimet ovat yllä mainitut kuusi
  dynaamista luokkaa.

## Rakenteellinen omistajuus

Tarkka testien siirtosopimus, tiedostokohtaiset vastuut, nimeämistodiste ja
kasvusääntö on kirjattu
[feature test-suite split -spesifikaatioon](../technical/feature-test-suite-split-spec.md).
Keskeinen raja on nyt tämä:

| Ennen                                    | Nyt                                                                                         | Hyväksymisraja                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Yksi 5 046 rivin `e2e/scaffold.spec.ts`  | Kahdeksan feature-speciä, olemassa oleva shareable-setup-spec ja 347 rivin yhteinen fixture | 78/78 Chromium-testinimet, ei file-order-riippuvuutta                                                   |
| Yksi 3 562 rivin `ui-view-model.test.ts` | Kahdeksan feature-suitea ja 224 rivin yhteinen fixture                                      | 90/90 alkuperäistä nimeä; focused-kokonaisuus sisältää lisäksi suorat formatting- ja MonsterCard-testit |
| Yksi 1 892 rivin sekoitettu testing-opas | 176 rivin pääopas, kolme aiheopasta ja 489 rivin päivätty evidenssiloki                     | Nykyinen komentototuus yhdessä paikassa; historialliset luvut eivät voi syrjäyttää sitä                 |

Suurin uusi funktionaalinen spec on feature-kohtainen
`shell-accessibility.spec.ts` (1 136 riviä) ja suurin uusi view-model-suite
`stats-view-model.test.ts` (803 riviä). Uutta line-count-gatea ei lisätty:
seuraava jako tehdään vain, jos samaan feature-omistajaan syntyy konkreettinen
review-, navigointi- tai testieristysongelma.

## Koko repositoryn disposition

| Inventaario                      | Tulos ja päätös                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tuotantomoduulit ja entrypointit | Repositoryn arkkitehtuuritarkistin omistaa import-graafin, kerrosrajat, syklit, orphanit ja ulkoiset entrypointit. Auditoinnin baseline oli 121 lähdemoduulia, 109 client-reachable-moduulia ja seitsemän ulkoista entrypointia ilman sykliä tai poikkeusta.               |
| `scripts/` ja npm-komennot       | Kaikki 37 script-tiedostoa olivat package-komennon entrypointteja tai aktiivisen scriptin importteja. Kaikille `package.json`-komennoille löytyi dokumentoitu omistaja, mukaan lukien kehitysaikainen `test:watch`, eikä dokumentaatio viitannut puuttuvaan npm-komentoon. |
| Testifixturet                    | Kaikki 40 fixture-tiedostoa kuuluvat golden-, Planner-, live-integration-, LostCity-source-, data-generator- tai market-writer-testeille. Hakemistopohjaisesti luettavia source-fixtureitä ei poistettu yksittäisen tekstiosuman perusteella.                              |
| Visuaalibaselinet                | Kaikki 31 Darwin-PNG:tä kuuluvat erillisen 20 testin read-only visual suiteen. Baselineja ei päivitetty tässä siivouksessa.                                                                                                                                                |
| Suppressiot ja ohitukset         | Tuotanto-/script-polulla ei ole `TODO`/`FIXME`/`HACK`/`XXX`-, TypeScript-ohitus- tai skip/only-osumia. Ainoa aktiivinen lint-poikkeus on `App.tsx`:n dokumentoitu startup-transaktion `react-hooks/set-state-in-effect`-raja.                                              |
| Tyhjät catchit                   | Rewrite- ja script-polulla ei ole tyhjiä catch-haaroja. Arkistoidun legacy-runtimen vastaavat haarat säilyvät D-060-reference/rollback-evidenssinä.                                                                                                                        |
| Dokumentaatio                    | 564 paikallisen Markdown-linkin kohdetta löytyi. Vanhojen yhdistettyjen testitiedostojen elävät viittaukset päivitettiin feature-omistajiin; päivätyt vanhat luvut säilyvät vain eksplisiittisenä evidenssinä.                                                             |

## Tietoisesti säilytetyt suuret tai epäsuorat rajat

- `App.tsx`, Trip-domain, calculation Worker ja game-data-generator-core
  säilyvät niiden omien retention-/split-arvioiden perusteella; koko ei yksin
  ollut riittävä syy riskialttiiseen jakoon.
- Arkistoitu legacy-runtime ja sen script-order, `window.*`, lint-poikkeukset ja
  reference-polut säilyvät D-060:n nojalla. Niitä ei käsitelty nykyisenä
  tuotantoruntimena.
- Generated snapshotit, goldenit, lähde-fixturet ja visuaalibaselinet säilyvät
  toistettavuus- ja regressionäyttönä. Niitä ei luokiteltu kuolleiksi vain siksi,
  ettei jokaiseen tiedostoon ole suoraa staattista importia.
- Aktiiviset schema- ja economy-barrelit säilyvät todistettujen kuluttajien
  julkirajoina. Uusia varmuuden vuoksi -barreleita tai aliaspolkuja ei lisätty.

## Varmistukset

Ennen rakennejakoa täysi baseline-`npm run verify` läpäisi 71 testitiedostoa /
770 Vitest-testiä, 19 goldenia ja kaikki arkkitehtuuri-, typecheck-, build-,
artifact-, lint-, format- ja diff-portit. Playwright-jaon jälkeen
`playwright test --list` keräsi täsmälleen 78 testiä yhdeksästä tiedostosta,
focused view-model -ajo läpäisi 9 tiedostoa / 92 testiä ja koko funktionaalinen
Chromium läpäisi 78/78.

Lopulliset portit läpäisevät:

- `npm run verify`: 78 Vitest-tiedostoa / 770 testiä, 19 erillistä goldenia,
  arkkitehtuuri 121/109 seitsemällä ulkoisella entrypointilla ilman cyclea tai
  poikkeusta sekä typecheck-, build/artifact-, lint-, Prettier- ja diff-portit;
- tuotantoartefakti: 10 tiedostoa / kaksi assettia, yhteensä 1 974 877 tavua,
  entry JavaScript 720 422 raw / 208 739 gzip tavua ja SHA-256
  `babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`;
- `npm run numeric:audit`: 5 958/5 958 vertailua ilman mismatchia, ja goldenit
  19/19 osana verify-porttia;
- funktionaalinen tuotanto-preview Chromium: 78/78 yhdellä workerilla 3,3
  minuutissa; sekä
- read-only Darwin visual: 20/20 testiä 1,4 minuutissa samoja 31 baselinea
  vasten. Ensimmäinen sandboxattu preview-start epäonnistui ympäristösyystä
  `listen EPERM` portissa 5174; hyväksytty localhost-uusinta läpäisi eikä
  baseline-, fixture- tai konfiguraatiotiedostoa kirjoitettu.

Lisäksi 564 paikallisen Markdown-linkin kohde löytyi, lopullinen dead-export-
ja CSS-jälkihaku ei tuottanut uutta poistokandidaattia ja visual-baselinejen
git-status pysyi muuttumattomana.

## Avoimet kysymykset

- Ei tämän kierroksen toteutusta estävää avointa kysymystä.
- Automaattinen Markdown-linkki-, npm-komento- ja visual-inventory-check voisi
  pienentää tulevaa manuaalityötä, mutta uuden yleisen CI-/merge-gaten omistajaa
  ei ole hyväksytty. Päätös jää backlog-/decision-työksi, eikä tätä auditin
  tilapäistä linkkitarkistinta jätetty repositoryyn.
