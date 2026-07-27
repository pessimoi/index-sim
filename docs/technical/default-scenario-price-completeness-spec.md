# Oletusskenaarion hintadatan kattavuusspeksi

- Status: implemented
- Date: 2026-07-20
- Owner: technical documentation
- Evidence: verified
- Contract: closed

- Päiväys: 2026-07-20
- Prioriteetti: korkea
- Arvioitu työmäärä: S
- Omistajat: `prices.json`, `price-provenance.json`, `price-history.json` ja
  oletusskenaarion release-testi
- Tuotepinta: ensimmäinen Hill Giant -tulos, Loot/Economy ja Market
- Liittyvät päätökset: D-033, D-062, D-085, D-087 ja D-099

## Tarkoitus

Sulje tuotannon nykyisen oletusskenaarion aktiivinen hintadata-aukko hyväksytyllä
markkinahavainnolla ja estä saman regressio release-portissa.

Tämä on toimitettavan datan ja sen hyväksyntäevidenssin korjaus. `Result
summary`, `Loot/economy summary` ja `Market price sync` ovat feature inventoryssa
`Valmis`, eikä niiden nykyistä varoitus-, tarkastus- tai manuaalikorjauspolkua
rakenneta uudelleen.

## Varmennettu nykytila

Tuotannon oletuslomake on `DEFAULT_FORM_STATE`: melee-asetus ja monsteri
`giant`, jonka näkyvä nimi on Hill Giant. Root-bootstrap muodostaa aktiivisen
PriceSetin toimitetuista markkinatiedostoista ja täydentää puuttuvat numeeriset
arvot generated object-cost -fallbackeilla.

Ennen 2026-07-20 hintapäivitystä Revision 274 -snapshotin Hill Giantin aktiivinen
loot-arvotus käytti `rune_spear`-riviä ilman markkinahavaintoa. Tila oli
ristiriitainen käyttäjän ensivaikutelman kannalta:

- `rune_spear -> rune_spear` kuuluu hyväksyttyyn
  `MARKET_SOURCE_MAPPINGS`-karttaan;
- id puuttuu sekä `prices.json`-tiedostosta että
  `price-provenance.json`-sivutiedostosta;
- runtime antaa sille eksplisiittisen generated object-cost -fallbackin, joten
  laskenta voidaan suorittaa; ja
- tuolloinen tulos näytti oikein `Price data incomplete` -varoituksen yhdestä
  aktiivisesta puuttuvasta tai fallback-arvosta.

Writer-evaluointi 2026-07-20 hyväksyi `rune_spear`-arvon 22 500 GP viidestä
lähdehavainnosta: kolme hyväksyttiin ja kaksi hylättiin. Viimeisin hyväksytty
havainto on ajalta 2026-07-19T15:28:16Z ja laatuluokka on `low`.

## Tavoitetila

Tuotannon puhtaassa, ilman selaintallennettua tilaa avautuvassa
oletusskenaariossa:

- kaikki aktiivisen Hill Giant -tuloksen käyttämät hyväksyttyyn markkinakarttaan
  kuuluvat item-id:t löytyvät toimitetusta `prices.json`-snapshotista;
- jokaisella näistä numeerisista riveistä on D-085:n mukainen täsmäävä
  `price-provenance.json`-metadata;
- `rune_spear` käyttää hyväksytyn writer-ajon markkinahavaintoa eikä generated
  fallbackia;
- nykyisen tuloksen price issue -joukko on tyhjä, joten
  `Price data incomplete` ei näy oletustuloksessa; ja
- sama olemassa oleva varoitus näkyy edelleen muissa skenaarioissa, jos aktiivinen
  laskenta todella käyttää puuttuvaa tai fallback-hintaa.

Tavoite ei tarkoita, että kaikkien kartoitettujen markkina-itemien pitää olla
aina numeerisesti katettuja. Release-portin uusi kova vaatimus rajataan
tuotteen oletusskenaarion aktiivisiin hintariippuvuuksiin. Laajempi
`marketMappingsMissingNumeric` säilyy readiness-raportin näkyvänä
kattavuusmittarina.

## Hyväksyttävä markkinahavainto

`rune_spear`-arvo saadaan vain nykyisellä repo-owned writerilla ja hyväksytyllä
`markets.lostcity.rs`-item page -adapterilla. Writerin olemassa olevat
D-062/D-085-säännöt ovat auktoriteetti:

- lähdepolku johdetaan hyväksytystä item-id/source-slug-kartasta;
- vain parserin hyväksymät valmistuneet, yksiselitteiset GP-havainnot saavat
  osallistua estimaattiin;
- havaintomäärä-, poikkeama-, ikä-, future-skew-, vastaus- ja identiteettirajat
  eivät muutu;
- raakasivuja, listingejä tai pelaajaidentiteettejä ei tallenneta;
- `valueObservedAt` tulee hyväksytystä havainnosta eikä writerin capture-ajasta;
  ja
- ajon täytyy päätyä `observed`-tulokseen. `retained`, 404, liian vanha data tai
  liian vähäinen havaintomäärä eivät oikeuta uuden numeerisen rivin luomista.

Jos hyväksyttävää havaintoa ei ole, toteutus jää tarkoituksella avoimeksi:
varoitusta ei vaimenneta, generated fallbackia ei kirjoiteta markkinatiedostoihin
eikä hintaa arvioida käsin.

## Kolmen tiedoston loogisesti atominen päivitys

Hyväksytty writer-ajo muodostaa yhden D-085:n mukaisen kandidaattiloogisen
kokonaisuuden:

1. `prices.json` sisältää writerin hyväksymän `rune_spear`-hinnan ja uuden
   `_scraped_at`-capture-ajan.
2. `price-provenance.json` sisältää täsmälleen saman numeerisen avainjoukon,
   saman capture-ajan ja `rune_spear`-metadatan, jossa origin, refresh status,
   laatu, source slug, havaintoajat ja rajatut havaintomäärät ovat writerin
   tuottamia.
3. `price-history.json` sisältää version 2 writer-evaluated -snapshotin, sen
   `prices`-kartassa hyväksytyn arvon ja `evaluations.rune_spear`-rivillä
   `observed`-tuloksen vastaavine havainto- ja laatutietoineen.

Writer validoi koko kolmen tiedoston kandidaatin muistissa ennen kirjoituksia.
Repositoryyn toimitetaan kaikki kolme tiedostoa samassa muutoksessa; yksittäisen
tiedoston päivitys, käsin muokattu JSON tai generated fallbackin kopiointi on
hylättävä.

Päivitys saa samalla sisältää writerin normaalin, deterministisen koko snapshotin
muutoksen muille hyväksytyille riveille. Muutoskatselmoinnissa on silti
varmistettava, että diffissä ei ole writerin kolmen tiedoston ulkopuolista
automaattisesti tuotettua dataa.

## Oletusskenaarion release-testi

Fokusoitu testi tiedostossa
`src/tests/default-scenario-price-completeness.test.ts` käyttää
tuotantopolun todellisia omistajia eikä rinnakkaista fixturea:

1. lataa kontekstin `createGeneratedRuntimeContext()`-bootstrapilla;
2. laskee tuloksen muuttamattomasta `DEFAULT_FORM_STATE`-tilasta;
3. johtaa nykyisen tuloksen käytetyt hintahuomiot samalla domain/view-model-polulla
   kuin Result, Loot ja Economy;
4. rajaa tarkistuksen aktiivisiin issueihin, joiden kanoninen item-id kuuluu
   `MARKET_SOURCE_MAPPINGS`-karttaan; ja
5. vaatii joukon tyhjäksi sekä varmistaa erikseen, että `rune_spear` on
   toimitetussa base PriceSetissä `market-observation`, ei runtime-only
   `generated-object-cost`.

Testin epäonnistumisen tulee nimetä puuttuvat kanoniset item-id:t. Se ei saa
lukita GP-lukua, havaittua hintaa, capture-aikaa tai kaikkien fallbackien
kokonaismäärää, koska nämä eivät ole tuotteen pysyviä hyväksyntärajoja.

Testi kuuluu normaaliin Vitest-hakuun. Siksi `npm run verify` ajaa sen nykyisessä
release-portissa ilman uutta CI-, provider- tai automaatiomekanismia.

Selainvarmistus todistaa lisäksi käyttäjälle näkyvän hyväksymistuloksen puhtaassa
tuotanto-previewssa:

- Hill Giant on ensimmäinen valittu monsteri;
- `Price data issue` / `Price data incomplete` puuttuu ensimmäisestä tuloksesta;
- Economy ei raportoi `rune_spear`-riviä missing/fallback-ongelmana; ja
- erillisellä kontrolloidulla PriceSet-fixturella olemassa oleva varoituspolku
  näkyy edelleen.

Pysyvä release-portti on data-/domain-testi. Browser-evidenssi täydentää
käyttäjäpolun varmennuksen, mutta siitä ei tehdä live-upstreamista riippuvaa.

## Toteutusjärjestys

1. Aja nykyinen writer hyväksyttyä lähdettä vasten no-write/dry-run-tilassa ja
   tarkista, että `rune_spear` saa `observed`-tuloksen.
2. Jos tulos jää `retained`-tilaan tai ajo hylätään, lopeta ilman repository-
   muutosta ja kirjaa syy avoimeksi evidenssiksi.
3. Aja writerin normaali kirjoituspolku ja tarkista kolmen tiedoston yhteinen
   schema, capture-aika, avainjoukko ja `rune_spear`-provenance/history.
4. Lisää oletusskenaarion release-testi tuotannon bootstrapin ja nykyisen
   hintahuomiopolun päälle.
5. Aja fokusoitu data-, writer-, runtime-, simulation- ja selainvarmennus.
6. Päivitä tämä speksi toteutetuksi ja kirjaa todellinen havainto- sekä
   validaatioevidenssi. Feature-inventoryn nykyiset kolme riviä pysyvät
   `Valmis`; tarvittaessa niihin lisätään vain päivätty datan kattavuusmuistio.

## Rajaukset

- Ei muutosta `Price data incomplete` -ehdon, tekstin, sijoittelun tai
  korjausnavigaation toimintaan.
- Ei fallbackin luokittelun, hintalookupin, loot-taulujen, drop ratejen,
  määrien, GP/hr- tai GP/kill-kaavojen muutosta.
- Ei `rune_spear`-hinnan kovakoodausta testiin tai runtimeen.
- Ei käsin pääteltyä markkinahintaa, observation timestampia tai laatuluokkaa.
- Ei uutta provideria, selaimesta käynnistettävää synkronointia, tietokantaa tai
  aktiivista GitHub Actions -workflowta.
- Ei D-099:n avaamista eikä scheduled-current-väitettä; yksi hyväksytty paikallinen
  writer-havainto riittää tämän toimitettavan snapshotin korjaukseen.
- Ei vaatimusta poistaa unsupported unidentified-herb -fallbackeja tai ratkaista
  kaikkia readiness-raportin mapattuja/puuttuvia rivejä.

## Hyväksymiskriteerit

Toteutus on valmis vasta kun:

- writer on hyväksynyt `rune_spear`-havainnon nykyisillä laatuehdoilla;
- `prices.json`, `price-provenance.json` ja `price-history.json` muodostavat yhden
  validoidun D-085-kokonaisuuden;
- `rune_spear` on base PriceSetissä markkinahavainto, ei generated fallback;
- muuttamattoman `DEFAULT_FORM_STATE`-oletusskenaarion aktiivisten mapattujen
  hintapuutteiden joukko on tyhjä;
- puhtaan selaimen ensimmäinen Hill Giant -tulos ei näytä
  `Price data incomplete` -varoitusta;
- kontrolloitu puuttuva/fallback-fixture todistaa, ettei yleistä varoituspolkua
  ole heikennetty;
- uusi regressiotesti kuuluu `npm run verify` -porttiin; ja
- kaikki alla luetellut tarkistukset läpäisevät ilman hinta-, golden- tai
  screenshot-baselinejen käsin päivittämistä regressioiden piilottamiseksi.

## Vaadittu validaatio

```sh
node -e "for (const f of ['prices.json','price-provenance.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
npm run typecheck
npm run test -- src/tests/default-scenario-price-completeness.test.ts src/tests/market-writer.test.ts src/tests/generated-runtime-adapter.test.ts src/tests/data-economy.test.ts src/tests/price-data-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/simulation-view-model.test.ts
npm run runtime:readiness -- --example-limit 5
npm run test:golden
npm run build
npm run test:e2e -- --workers=1 --grep "Price data|Economy"
npm run verify
git diff --check
```

Live-lähdettä ei kutsuta automaattisissa testeissä. Writerin hyväksytty havainto
on erillinen, ihmisen käynnistämä toimitusvaihe; kaikki repository-testit käyttävät
committoitua snapshotia tai rajattuja fixtureja.

## Toteutusevidenssi

- Writer capture: 2026-07-20T10:49:53Z.
- `rune_spear`: 22 500 GP, `market-observation`, `observed`, laatuluokka `low`.
- Havaintoja: 5 lähdehavaintoa, joista 3 hyväksyttyä ja 2 hylättyä.
- `npm run verify`: läpäisty 2026-07-20.
- `npm run test:e2e -- --workers=1`: tuotantotulos ja kontrolloitu puuttuvan hinnan
  varoituspolku läpäisty.
- `npm run test:e2e:visual`: 26/26 läpäisty kahdesti baselinepäivityksen jälkeen.

## Avoimet kysymykset

- Tarvitaanko toteutuksen jälkeen vastaava release-portti myös erikseen
  nimetylle pienen joukon onboarding-skenaarioille? Tämä speksi rajaa kovan
  portin vain nykyiseen tuotteen oletusskenaarioon.
