# Arkkitehtuuriaudit: 2004scape Combat Simulator

Paivays: 2026-07-05  
Repo: `/Users/pessi/index-sim`  
Tarkastettu commit: `ee89ba9` (`v0.3.4`)  
Tarkastuksen tavoite: loytaa arkkitehtuuriset riskit ja kerata rewrite-huomiot yhteen tiedostoon.

## Tiivistelma

Sovellus on nykyisellaan pieni ja helposti ajettava staattinen selainappi: `index.html` lataa Reactin, Babelin, datan, simulaattorin ja nakymat suoraan selaimeen. Tama tekee prototyypista nopean kehittaa ja helpon julkaista, mutta samalla varsinainen arkkitehtuuri rakentuu globaalien `window.*`-objektien, skriptien latausjarjestyksen, `localStorage`-tilan ja selaimen runtime-Babelin varaan.

Suurin rewrite-riski ei ole yksittainen algoritmi, vaan kerrosten puuttuminen. Combat-simulaatio, lootin arvotus, market-hinnat, trip/inventory-malli, planneri, persisted UI state ja data-provenanssi ovat tiiviisti ristissa. Taman seurauksena tulosten toistettavuus riippuu helposti selaimen paikallisesta tilasta ja lataushetken hintasynkasta.

Jos sovellus kirjoitetaan uusiksi, ensimmainen tavoite kannattaa olla puhdas domain-core: eksplisiittiset inputit, eksplisiittinen data snapshot, ei `window`-riippuvuuksia, ei `localStorage`-sivuvaikutuksia, ja kultaiset testifixturet nykyista versiota vasten. Vasta sen jalkeen kannattaa paattaa, pysyyko UI Vite-tyyppisena staattisena React-appina vai tarvitseeko projekti oikeasti Next/FastAPI-tyyppisen moniprosessiarkkitehtuurin.

## Miksi nykyinen malli on silti arvokas

- Koodi on kompakti ja koko sovellus mahtuu pieneen maaran tiedostoja. Auditointi on siksi mahdollista ilman raskasta infraa.
- Domain-kommenteja on paljon. Monessa kohdassa kerrotaan, mista data tai oletus on peraisin.
- `engine.js`, `trip.js`, `equipment.js`, `market.js`, `planner-core.js` ja `gamedata.js` menevat lapi `node --check` -syntaksitarkistuksesta.
- Simulaatiossa on jo paljon hyvaa domain-ajattelua: erikoisiskut, prayerit, potionit, loot actionit, cannon, tripit, alch ja planneri ovat samassa prototyypissa nakyvilla.

Nama ovat hyvia lahtokohtia uudelleenkirjoitukselle. Ongelma on, etta rajat ovat kasvaneet orgaanisesti eivatka enaa suojaa domain-logiikkaa kayttoliittymalta, datalta ja selaimen tilalta.

## Vakavimmat loydokset

### P0: Sisainen arkkitehtuuridokumentaatio kuvaa eri projektia kuin repo

`views.jsx:4260-4338` sisaltaa `ArchitectureBoard`-nakyman, joka sanoo projektin olevan "one repo, three processes": Next.js front-end, FastAPI engine, SQLite data package, scraper ja `make dev`/turbo-tyyppinen kehitysymparisto. Reposta ei loydy naita rakenteita (`apps/web`, `services/engine`, `packages/data`, `make dev`, SQLite-seed, FastAPI-palvelu).

Tama on arkkitehtuurisesti vaarallista, koska sovelluksen oma dokumentaatio antaa tulevalle kehittajalle virheellisen kartan. Jos joku aloittaa rewriten taman nakyman perusteella, han todennakoisesti etsii olemattomia palveluita ja voi paatella vaarin, missa nykyinen source of truth sijaitsee.

Suositus:

- Poista tai merkitse `ArchitectureBoard` selkeasti tavoitearkkitehtuuriksi, ei nykytilaksi.
- Lisaa repojuureen oikea `ARCHITECTURE.md` tai pidetaan tama audit-tiedosto elavana dokumenttina.
- Jos moniprosessiarkkitehtuuri halutaan, tee siita tietoinen roadmap, ei UI:n sisaan jaanyt oletus.

### P0: Projektissa ei ole build-, dependency- tai testausarkkitehtuuria

`index.html:12-14` lataa Reactin, ReactDOMin ja Babel Standalonen CDN:sta. JSX-tiedostot ladataan selaimessa runtime-transformilla (`index.html:35-38`). Repojuuresta ei loydy `package.json`ia, lockfilea, testirunneria tai testitiedostoja.

Tama tarkoittaa:

- riippuvuuksien versiointi on hajautettu HTML-script-tageihin
- JSX tarkistetaan vasta selaimessa
- domain-kaavoille ei ole regressiotesteja
- CI:lle, lintille, formatterille ja bundlaukselle ei ole luonnollista paikkaa
- offline-kehitys ja supply-chain-hallinta ovat heikkoja, vaikka script-tageissa onkin SRI-hashit

Suositus:

- Lisaa ensin kevyt `package.json`, lockfile ja testirunneri.
- Jos sovellus pysyy staattisena, Vite + React on todennakoisesti riittava ja paljon kevyempi kuin Next.
- Testaa domain-core Node-ymparistossa ilman selainta.
- Pida CDN/runtime-Babel korkeintaan historiallisena prototype-polkuina.

### P1: Arkkitehtuuri perustuu globaaleihin objekteihin ja latausjarjestykseen

`index.html:27-32` lataa datan ja core-moduulit jarjestyksessa: `gamedata.js`, `engine.js`, `trip.js`, `equipment.js`, `market.js`, `planner-core.js`. Sen jalkeen `planner.jsx` ja `views.jsx` olettavat, etta globaalit objektit ovat olemassa.

Esimerkkeja:

- `engine.js:8` sanoo tiedoston olevan pure functions/no DOM, mutta `simulate` lukee `window.GameData`, `window.Equipment` ja `window.TripModel` useista kohdista.
- `planner-core.js:22-23` hakee `window.SimEngine` ja `window.Equipment` lazy-funktioilla.
- `equipment.js:5` kertoo kayttavansa `window.SimEngine`in weapon/ammo-dataa.
- `trip.js:2-3` kuvaa itsensa pureksi, mutta lukee live-rekistereita `window`ista.
- `market.js` paivittaa suoraan `window.GameData.ITEM_PRICES`- ja `ALCH_VALUES`-objekteja.
- `views.jsx:6` sitoo UI:n suoraan `window.SimEngine`iin.

Tama tekee skriptien latausjarjestyksesta todellisen dependency graphin. Se toimii niin kauan kuin HTML pysyy kasin yllapidettyna, mutta vaikeuttaa testien, bundlerin, workerin, palvelinpuolen simulaation ja erillisten data snapshotien kayttoa.

Suositus:

- Tee moduuleista eksplisiittisia export/import-rajapintoja.
- Jata `window.*` vain yhteen browser-bootstrap-adapteriin.
- Muu koodi saa ottaa riippuvuudet parametreina tai importteina.

### P1: `simulate` on liian laaja orkestroija ja sisaltaa sivuvaikutuksia

`engine.js:564` aloittaa `simulate(input)`-funktion. Sen sisalla kasitellaan vahingonlaskennan lisaksi mm. gear-bonukset, special attackit, poison, ring of recoil, cannon, loot EV, alch, prayer drain, trip model, food/drop-adjustment, supply costs ja XP breakdown.

Erityisen ongelmallista on, etta simulaatio myos muuttaa domain-dataa:

- `engine.js:1055` kutsuu `window.GameData.setJewelSpot(jewelSpot)`
- `engine.js:1058` kutsuu `window.GameData.setLegendsComplete(...)`
- `engine.js:1059-1098` hakee ja muokkaa loot-logiikkaa `GameData`-rajapinnan kautta
- `engine.js:1202-1264` kutsuu `TripModel.computeTrip` ja voi laskea tripin uudelleen lootin pienennyksen jalkeen

Tama tekee `simulate`-funktiosta seka laskijan etta tilan mutatoijan. Kaksi simulaatiokutsua eri inputeilla voivat vaikuttaa samaan globaaliin dataan, jos ne ajetaan samassa selaimessa.

Suositus:

- Jaa `simulate` pienempiin vaiheisiin: combat roll, damage/time, supply usage, loot valuation, trip/inventory, final economics.
- Tee `simulate` side-effect freeksi: `jewelSpot`, `legends`, price set ja loot preferences ovat inputteja, eivat globaaleja mutaatioita.
- Palauta debug/intermediate-arvot rakenteisesti, jotta UI-paneelit eivat joudu simuloimaan uudestaan omia johdannaisiaan.

### P1: Data, generoitu data, business-logiikka ja hinnat ovat samassa tiedostossa

`gamedata.js:1-4` sanoo datan olevan generoitu LostCityRS/Content-lahteesta ja hintojen olevan placeholder-arvoja. Samassa tiedostossa on kuitenkin:

- placeholder-hinnat (`gamedata.js:14-87`)
- scraped market price -overrideja (`gamedata.js:89-127`)
- monsterit ja loot-taulukot
- jewel/legends-tilaan liittyvat mutaattorit (`gamedata.js:356`, `gamedata.js:378`)
- staattiset hinnat (`gamedata.js:1628`)
- loot action -paattely (`gamedata.js:1746`)
- export globaaliin `window.GameData`iin (`gamedata.js:1802`)

Lisaksi `engine.js:13` ja `gamedata.js:10` viittaavat `CLAUDE.md`-tiedostoon source-of-truth-ohjeena, mutta sellaista tiedostoa ei ole repossa.

Tama tekee datan provenanssista epaselvan. Osa datasta nayttaa generoituvalta, osa on kasin korjattua, osa on placeholderia ja osa on scrape-tulosta. Tuleva rewrite tarvitsee selkean vastauksen siihen, mika on canonical data source.

Suositus:

- Erota `game-data` omaksi kerrokseksi: raw source, generator script, normalized JSON/TS snapshot, schema validation.
- Pida business-paattely kuten `defaultLootAction` erillisessa domain-moduulissa.
- Commitoi data-generation-komennot ja lahderef selkeasti.
- Poista tai korvaa puuttuvat `CLAUDE.md`-viittaukset.

### P1: Hintajarjestelmalla on monta totuutta ja selaimen tila muuttaa tuloksia

Hintadataa tulee useasta suunnasta:

- `gamedata.js` sisaltaa placeholderit ja scraped overrideja.
- `prices.json` ja `alch.json` ladataan automaattisesti jos ne loytyvat (`market.js:551-599`).
- `market.js:527-535` palauttaa aiemmin tallennetut hinnat `localStorage`sta.
- `market.js:461-486` paivittaa `GameData`n ja tallentaa hinnat `localStorage`en.
- `market.js:549`, `market.js:598` ja `market.js:602` ajavat restore/auto-load/sanitize -toimintoja eri `setTimeout`-viiveilla.
- `market.js:8` kayttaa `https://markets.lostcity.rs` -lahdetta ja `market.js:150-155` parsii tarvittaessa `__NEXT_DATA__` HTML:sta.

Tama tarkoittaa, etta sama checkout voi antaa eri gp/h-tuloksia riippuen selaimen aiemmasta `localStorage`-sisallosta, siita ehtiko `prices.json` latautua, ja onko live sync ollut kaytossa.

Suositus:

- Tee hinnasta eksplisiittinen `PriceSet`: nimi, timestamp, source, item prices, alch values.
- Simulaatio saa aina price setin inputtina tai dependency-parametrina.
- UI voi tallentaa aktiivisen price setin, mutta core ei saa lukea suoraan `localStorage`a.
- Maarita yksi prioriteettisaanto: bundled snapshot, imported snapshot, live scrape, manual override.

### P1: UI state, persisted state ja simulaation input ovat sama rakenne

`views.jsx:3421-3444` tallentaa koko input-rakenteen `localStorage`en. `views.jsx:3447-3454` listaa setup-kentat kasin. `CombatWorkbench` (`views.jsx:3501-3677`) hallitsee samassa komponentissa mm. kayttajan inputit, custom setupit, loot preferencet, alch/overhead/jewel spot -overridet, monsterinvaihdon, combat type -vaihdon ja `simInput`-rakentamisen.

`views.jsx:3677` ajaa `E.simulate(simInput)` suoraan UI:n `useMemo`ssa.

Tama tekee UI:n lomaketilasta samalla persisted documentin ja domain-komennon. Kun domain-input muuttuu, vanhat selaintallennukset voivat rikkoutua tai kayttaytya hiljaa vaarin. Versioitua state schemaa tai migraatiota ei kaytannossa ole.

Suositus:

- Erota `UiState`, `SavedSetup` ja `SimulationRequest` toisistaan.
- Lisaa persisted stateen `version` ja migraatiot.
- Rakenna domain-request yhdessa adapterissa ja validoi se ennen simulaatiota.

### P1: Sama domain-paattely toistuu useassa kerroksessa

Esimerkkeja rinnakkaisesta logiikasta:

- `engine.js` laskee combat-, loot-, prayer-, supply- ja trip-vaikutuksia.
- `trip.js` tietaa stackable-itemit, bank presetit, food/potion-kustannukset ja inventoryn.
- `gamedata.js:1737` kommentoi peilaavansa `TripModel.isStackable`-logiikkaa.
- `planner-core.js:41-80` sisaltaa oman requirement-taulukon ja gear pool -kasityksen.
- `planner-core.js:333-430` rakentaa level-by-level-plannerin ja kutsuu `E().simulate`.
- `views.jsx` kutsuu `E.simulate` useissa paneeleissa vertailuihin, optimointeihin ja live-mittareihin.

Tama ei ole viela katastrofi, mutta se on tyypillinen kohta, jossa simulaattori alkaa antaa eri paneeleissa eri vastauksia, koska jokin helper paivittyy yhdessa paikassa mutta ei toisessa.

Suositus:

- Nosta jaetut saannot domain-moduuleihin: stackability, requirements, item classification, loot action, equipment eligibility.
- Tee plannerista domain-corea kayttava kuluttaja, ei oma vaihtoehtoinen saantokerros.
- Anna UI:lle valmiita selector-/view-model-funktioita, jotta se ei kutsu simulaatiota tarpeettomasti uudestaan.

### P2: Suorituskyky on nyt riittava, mutta ei skaalaudu siististi

`views.jsx:1322-1362` ComparePane simuloi kaikki monsterit inputin muuttuessa. `views.jsx:3781-3795` tekee vastaavaa toisessa nakymassa. `planner.jsx:251-262` kertoo, etta plannerin recompute on noin 300 ms ja kayttaa debounced `setTimeout`ia seka `JSON.stringify`-riippuvuuksia. `planner-core.js:362-367` kayttaa cachea, mutta cache-avain on sidottu plannerin sisaisen tilan merkkijonoon.

Nykyisella datamaaralla tama voi olla ok. Jos monsteri-, item- tai planneriavaruus kasvaa, UI alkaa helposti jumittaa, koska raskas laskenta tapahtuu paasaikeessa.

Suositus:

- Tee simulaatiosta puhdas ja helposti cachattava.
- Palauta compare/planner laskenta Web Workeriin, jos selainappi pysyy staattisena.
- Valta `JSON.stringify`-dependencyja domain-objekteille; suosi eksplisiittisia avaimia tai immutable state -rakenteita.

### P2: Tiedostokoot ja komponenttirajat vaikeuttavat yllapitoa

Rivimaara kertoo keskittymisesta:

- `views.jsx`: 4361 rivia
- `gamedata.js`: 1831 rivia
- `engine.js`: 1547 rivia
- `market.js`: 645 rivia
- `trip.js`: 631 rivia
- `planner-core.js`: 543 rivia

Varsinkin `views.jsx` sisaltaa suuren maaran paneeleita, inline-tyyleja, paikallisia helper-funktioita ja domain-kutsuja. Tama ei esta kehitysta, mutta nostaa muutosten kognitiivista hintaa.

Suositus:

- Jaa UI feature-kohtaisiin moduuleihin: combat form, result summary, loot, compare, planner, economy, settings.
- Pida domain-kutsut UI:n reunoilla, ei syvalla jokaisen paneelin sisalla.
- Siirra toistuvat inline-tyylit komponentteihin tai CSS-luokkiin.

### P2: Kehitystyokaluista annetaan lupauksia, joita repo ei tayta

UI mainitsee `run_sim.py`-palvelimen useassa kohdassa:

- `views.jsx:491-542` hiscores lookup vaatii `python run_sim.py`.
- `market.js:489-520` odottaa `/api/scrape`-endpointtia.
- `views.jsx:3022-3039` neuvoo avaamaan simulaattorin localhostista.

Reposta ei loydy `run_sim.py`:ta. Jos tama on tarkoituksella paikallinen/ulkoinen tyokalu, se kannattaa dokumentoida. Muuten ominaisuudet nayttavat osittain rikkinaisilta.

Suositus:

- Lisaa puuttuva dev server tai poista/selkeyta UI-polut.
- Dokumentoi, mika toimii staattisena tiedostona ja mika vaatii serverin.
- Jos scrape/hiscores ovat tuotefunktioita, tee niille oikea backend-rajapinta.

### P2: Domain-datan laatu ja provenanssi ovat osin epaselvia

Koodissa on paljon hyvia varoituksia:

- `equipment.js:8` kertoo joidenkin accessory-bonusten olevan 2004-era arvioita.
- `planner-core.js:93-99` merkkaa future weapons -arvot hypoteettisiksi ja OSRS Wikista poimituiksi.
- `gamedata.js:743`, `gamedata.js:1152-1153` ja `gamedata.js:1178` mainitsevat OSRS-pohjaisia 2004-approksimaatioita.

Nama ovat hyodyllisia kommentteja, mutta ne eivat viela muodosta datan laatumallia. Uudelleenkirjoituksessa on parempi kasitella "verified", "generated", "manual patch", "approximation" ja "hypothetical" datan kenttina, ei vain kommentteina.

Suositus:

- Lisaa data schemaan `source`, `sourceRef`, `confidence`, `verifiedAt`, `notes`.
- UI voi nayttaa approx/hypothetical-merkinnat datasta, ei kovakoodatuista ehdoista.
- Testit voivat varmistaa, ettei approximated data paady vahingossa canonicaliksi ilman merkintaa.

### P3: Supply chain ja selainturva ovat prototyyppitasolla

React, ReactDOM ja Babel ladataan CDN:sta (`index.html:12-14`). Google Fonts ladataan ulkoa (`index.html:8-10`). Market-synkka lukee ulkoista sivustoa ja fallbackina parsii HTML:n `__NEXT_DATA__`-rakennetta (`market.js:150-155`).

SRI auttaa scriptien eheyteen, mutta arkkitehtuurina tama on silti hauras:

- CDN-availability vaikuttaa appin kaynnistymiseen.
- Runtime-Babel ei ole tuotantokelpoinen buildipolku.
- Ulkoisen market-sivuston HTML-rakenteen muutos voi rikkoa scraperin.

Suositus:

- Bundlaa React ja oma koodi build-vaiheessa.
- Lukitse riippuvuudet lockfilella.
- Kasittele market sync erillisena importerina, jolla on testit ja virheilmoitukset.

## Ehdotettu tavoitearkkitehtuuri rewritea varten

Kevyt mutta kestava rakenne voisi olla:

```text
apps/web/
  React UI, routing/tabs, persisted UI state, view models

packages/domain-core/
  pure combat simulation, xp, prayers, potions, specials, cannon

packages/game-data/
  generated data snapshots, schemas, source metadata, validation

packages/economy/
  price sets, alch values, import/export, market source adapters

packages/trip/
  inventory, banking, food, potions, stackability, trip length

packages/planner/
  training plan search/optimization using domain-core

scripts/
  data generation, market import, fixture refresh

tests/fixtures/
  golden simulation cases from current app
```

Tama ei tarkoita, etta projektiin tarvitaan heti monorepo-tooling. Sama jako voidaan toteuttaa ensin yhdessa `src/`-puussa. Tarkein muutos on rajapintojen selkeys:

- Domain-moduulit eivat tieda Reactista, DOMista, `window`ista tai `localStorage`sta.
- UI antaa eksplisiittisen `SimulationRequest`in.
- Simulaatio saa eksplisiittisen `GameDataSnapshot`in ja `PriceSet`in.
- Kaikki data- ja hintamutaatiot tapahtuvat adapterikerroksessa, eivat simulaation sisalla.

## Suositeltu etenemisjarjestys

1. Jaadyta nykyinen kayttaytyminen kultaisilla fixtureilla.
   - Valitse 15-30 edustavaa monster/loadout-casea.
   - Tallenna nykyisen `E.simulate`-tuloksen keskeiset arvot: kph, xp/h, gp/h, supply costs, loot EV, trip metrics.
   - Hyvaksy pienet toleranssit float-arvoille.

2. Lisaa kevyt test/build-pohja.
   - `package.json`, lockfile, testirunneri.
   - Aluksi voi ajaa nykyisia plain JS -tiedostoja Node-adapterilla.
   - JSX:n voi siirtaa Viteen myohemmin.

3. Irrota `simulate` globaaleista riippuvuuksista.
   - Vie `GameData`, `Equipment`, `TripModel` ja `PriceSet` parametreiksi.
   - Poista `setJewelSpot`/`setLegendsComplete`-mutaatio simulaation sisalta.
   - Tee browser-yhteensopiva adapteri, joka syottaa nykyiset globaalit uuteen funktioon.

4. Erota data ja data-generation.
   - Siirra monsterit/items/drops/equipment snapshotiksi.
   - Lisaa schema validation ja duplicate/reference-checkit.
   - Kirjaa lahdeversio koneellisesti.

5. Erota economy/hinnat.
   - Tee `PriceSet`-malli.
   - Paattele UI:ssa aktiivinen hintalahde.
   - Simulaatio ei lue tai kirjoita `localStorage`a.

6. Pilko UI vasta domain-erotuksen jalkeen.
   - Ensin adapterit ja testit, sitten komponenttijako.
   - Muuten iso refactor voi muuttaa seka UI:ta etta laskentaa samaan aikaan.

7. Korjaa dokumentaatio.
   - Paivita tai poista nykyinen `ArchitectureBoard`.
   - Lisaa todellinen kehitysohje: miten app kaynnistetaan, miten hinnat paivitetaan, miten data generoidaan, miten testit ajetaan.

## Paivan auditin tarkistus

Tarkistuksessa kaytiin lapi repojuuren tiedostot, skriptien latausjarjestys, core-simulaatio, data, economy/market, trip model, planner ja React-nakymat. Plain JS -tiedostoille ajettiin syntaksitarkistus:

```text
node --check engine.js
node --check equipment.js
node --check gamedata.js
node --check trip.js
node --check market.js
node --check planner-core.js
```

Kaikki ylla mainitut syntaksitarkistukset menivat lapi. JSX-tiedostoille ei ole repossa paikallista buildi- tai testikomentoa, koska ne ajetaan selaimessa Babel Standalonen kautta.

## Lopullinen arvio

Nykyinen toteutus on onnistunut prototyyppi, mutta heikko tuotantoarkkitehtuuri. Uudelleenkirjoituksessa ei kannata aloittaa ulkoasusta tai framework-vaihdosta, vaan toistettavasta domain-ytimesta ja datan/hintojen source-of-truth-mallista. Kun simulaatio on puhdas ja testattu, UI:n, plannerin ja mahdollisen backendin valinnat muuttuvat paljon vaarattomammiksi.
