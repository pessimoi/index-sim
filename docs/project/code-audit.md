# Koodiauditointi 2026-07-14

Tämä raportti kuvaa repositoryn nykyisen Vite/React-tuotantopolun ja sitä
tukevien controller-, domain-, data-, serveri-, Worker-, generaattori- ja
deploy-koodien lähdekoodiin perustuvan auditoinnin. Se täydentää
[arkkitehtuuri-](architecture-audit.md) ja [tietoturva-auditointia](security-audit.md)
eikä korvaa niiden omistamia rajoja. Historiallinen legacy-painotteinen
tiedostotarkastus säilyy tiedostossa
[`PROJECT_REVIEW_NOTES.md`](../../PROJECT_REVIEW_NOTES.md).

Auditoinnin alussa tarkastettu HEAD oli
`c6796f057209d2ba67c2954333f2de7995ca51d2`. Työpuussa oli ennestään
tietoturva- ja arkkitehtuuriauditin muutoksia; ne säilytettiin ja huomioitiin
yhteisessä validoinnissa.

Tämän raportin varmistusluvut kuvaavat code-auditin omaa toteutushetkeä.
Myöhemmän repository-wide ylläpitosiivouksen tulokset ovat
[maintainability cleanup -auditissa](maintainability-cleanup.md), ja viimeisimmän
elävän portin omistaa [testausopas](../technical/testing.md).

## Yhteenveto

- Kriittisiä, korkean tai keskitason koodivirheitä ei löytynyt.
- Auditointi löysi kolme matalan vakavuuden käyttäytymisvirhettä ja yhden
  matalan ylläpitoriskin. Kaikki neljä korjattiin ilman laskentakaavojen,
  persistenssiskeemojen, API-sopimusten tai deployment-muodon muutosta.
- Hintadatan näkyvä ikä päivittyy nyt minuutin kellon mukana myös
  historia-yhteenvedossa.
- Kestoformaatti ei enää voi pyöristyä muotoon `1:60`, ja Stats sekä
  selainfixture käyttävät samaa formaattoria.
- Tyhjä mutta olemassa oleva localStorage-arvo luokitellaan vioittuneeksi
  JSONiksi eikä puuttuvaksi tilaksi, joten recovery-näkymä voi käsitellä sen.
- Seitsemän persistenssiefektiä ovat jälleen React Hooks -riippuvuuslintin
  piirissä eksplisiittisten vakaiden controller-metodien kautta.

## Löydökset

| Tunnus       | Vakavuus | Tila     | Löydös ja vaikutus                                                                                                                                                                                                                              | Korjaus ja evidenssi                                                                                                                                                                                                  |
| ------------ | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CODE-2026-01 | Matala   | Korjattu | `priceHistorySummary` käytti memoituessa `new Date()` -arvoa, mutta minuutin välein päivittyvä `priceAgeNowMs` puuttui riippuvuuksista. Economyyn auki jäänyt `Latest age` saattoi siksi vanhentua vain muun tilamuutoksen yhteydessä.          | Yhteenveto käyttää nyt `new Date(priceAgeNowMs)` -arvoa ja eksplisiittistä riippuvuutta. Playwright siirtää kontrolloitua kelloa minuutin ja todentaa näkyvän `<1m` -> `1m` -muutoksen ilman muuta käyttäjätoimintoa. |
| CODE-2026-02 | Matala   | Korjattu | Minuutit ja sekunnit laskettiin eri pyöristyksillä. Esimerkiksi 119,6 sekuntia tuotti virheellisen tekstin `1:60`. Sama logiikka oli kopioitu Statsiin ja E2E-fixtureen.                                                                        | Koko kesto pyöristetään ensin kokonaissekunniksi, josta minuutit ja jäännös johdetaan. Stats ja selainfixture käyttävät yhteistä `formatDuration()`-funktiota; rajatapaukset 119,6 ja 3 599,6 sekuntia on testattu.   |
| CODE-2026-03 | Matala   | Korjattu | `loadPersisted()` tulkitsi sekä `null`-arvon että tyhjän merkkijonon puuttuvaksi. Tyhjä olemassa oleva arvo jäi näin recovery-raportissa huomaamatta, vaikka se ei ole validi versioitu tallenne.                                               | Vain `null` tarkoittaa puuttuvaa avainta. Tyhjä arvo kulkee duplicate-key/JSON/skeemavalidoinnin läpi ja palauttaa `invalid_json`; uusi adapteritesti erottaa puuttuvan ja tyhjän arvon.                              |
| CODE-2026-04 | Matala   | Korjattu | Appin seitsemän versionoitua persistenssiefektiä oli yhden laajan `react-hooks/exhaustive-deps`-poikkeuksen alla. Nykyiset riippuvuudet olivat auditoitaessa tarkoituksenmukaiset, mutta myöhempi muutos olisi voinut ohittaa lint-varoituksen. | Vakaat `persist`- ja `shouldSkipPersist`-metodit sekä blocked-id-lista nimettiin eksplisiittisiksi riippuvuuksiksi. Laaja poikkeus poistettiin, ja ESLint sekä controller/recovery-testit läpäisevät rajan.           |

## Tarkastetut koodirajat

- Root-entrypoint, runtime bootstrap, Appin tilat, memot, efektit ja
  cross-feature-transaktiot.
- Controller-coret ja hookit, calculation Worker -protokolla, uusimman pyynnön
  voittava async-käsittely sekä peruutus- ja stale-rajat.
- View-modelien muotoilu ja domainin combat-, Trip-, Planner-, Risk- ja
  economy-laskentapolut sekä niiden golden- ja numeerinen evidenssi.
- Versioitu localStorage, setup-/Duel-/PriceSet-tuonnit, duplicate-key- ja
  kokorajat sekä recovery-luokittelu.
- Hiscores- ja market-handlerit, upstream-aikakatkaisut, kokorajat,
  skeemavalidointi ja sanitisoidut virhepolut.
- Generated runtime, lähdedatageneraattorin path/output-rajat, scheduled market
  writer, Cloudflare-adapteri ja release-validaattorit.
- Staattiset haut lint-poikkeuksille, ohitetulle TypeScript-tarkistukselle,
  marker-kommenteille, tyhjille catch-poluille, selainrajapinnoille,
  aikaperusteisille memoille ja duplikoidulle kestoformaatille.

Arkistoitua legacy-runtimea ei arvioitu uutena tuotantokoodina. Sen vaikutus
huomioitiin vain golden-, generator-, reference- ja rollback-evidenssin kautta
AGENTS.md:n nykyisen source mapin mukaisesti.

## Varmistukset

- Kohdistetut Vitest-ajot kattavat uuden formaatti- ja storage-evidenssin,
  price-history-presentaation, local-state controllerin/recoveryn sekä laajan
  UI-view-model-rajan.
- Kohdistettu tuotanto-preview Chromium kattaa kaikki golden-fixtureiden näkyvät
  tulosmetriikat, Economy-historian hallinnan ja kontrolloidulla kellolla
  päivittyvän historian iän.
- `npm run typecheck`, `npm run architecture:check` ja `npm run lint` läpäisevät.
- Täysi tuotanto-preview Chromium läpäisee 78/78 testiä.
- `npm run verify` läpäisee 67 testitiedostoa / 767 testiä, 19 erillistä
  goldenia, arkkitehtuuri-, typecheck-, build-, artefakti-, lint-, Prettier- ja
  diff-portit. Kymmenen tiedoston / kahden assetin tuotantoartefakti on
  1 977 448 tavua ja SHA-256
  `bed35127819bd2e601e1d826a3438a1c78a9bff7d0f8f02bb113bf53235d9c37`;
  entry JavaScript jää D-094-rajan sisään (720 510 raw / 208 717 gzip tavua).
- Elävän portin komennot ja viimeisimmät luvut ylläpitää
  [`docs/technical/testing.md`](../technical/testing.md).

## Jäljelle jäävät rajat ja avoimet kysymykset

- Auditissa ei jäänyt avointa osoitettua koodidefektiä. Jo luokitellut
  moduulikoon, testiomistajien ja live-operaatioiden riskit pysyvät
  [arkkitehtuuri-](architecture-audit.md),
  [tietoturva-](security-audit.md) ja [backlog](backlog.md)-dokumenttien
  omistuksessa.
- Controller-hookit luovat core-instanssinsa tarkoituksella kerran ja nykyiset
  kutsujat antavat niille vakaat constructor-riippuvuudet. Jos tuleva ominaisuus
  tarvitsee ajonaikaisesti vaihtuvan riippuvuuden, valitaanko eksplisiittinen
  controller-päivitysmetodi vai instanssin hallittu uudelleenluonti?
- Tässä auditissa ei kerätty coverage-prosenttia. Nykyinen hyväksyntä perustuu
  käyttäytymis-, golden-, numeerisiin, selain- ja release-portteihin; mahdollinen
  coverage-raja tarvitsee ensin osoitetun päätöshyödyn eikä pelkkää tavoitelukua.
