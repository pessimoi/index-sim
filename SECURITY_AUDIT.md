# Tietoturva-auditointi

Päiväys: 2026-07-05  
Kohde: `/Users/pessi/index-sim`  
Tyyppi: selainpohjainen, staattisesti ajettava simulaattori ilman palvelinpuolen koodia tässä repossa.

## Goal 8 hardening update

Tämä tiedosto alkoi legacy-runtime-auditointina. Goal 8 -passin jälkeen root `index.html` on Vite/React-entrypoint ilman CDN Reactia, Babel Standalonea, inline JSX:ää tai todelliseen `window.*`-script orderiin nojaavaa tuotantopolun käynnistystä. Vanha HTML on arkistoitu tiedostoon `legacy/index.html`.

Alla olevat legacy-löydökset ovat yhä hyödyllisiä silloin, kun tarkastellaan arkistoitua legacy-polkuja tai poistamatta jätettyjä legacy-lähteitä. Nykyisen root-polun jäljellä olevat riskit ovat ensisijaisesti:

- `src/adapters/browser` ajaa luotettuja, repossa olevia legacy-lähteitä sandbox-objektissa validoidun datan bootstrapia varten. Se ei aja käyttäjän importoimaa koodia.
- CSP ja muut staattisen hostauksen security-headerit ovat operations-suositus, koska deploy targetia ei ole hyväksytty.
- Legacy-lähteet ovat edelleen repossa golden-fixtureitä, vertailua ja data-bootstrapia varten. Niiden poistaminen vaatii erillisen replacement-päätöksen.

Goal 8 -tarkistuksissa `npm audit` raportoi 0 haavoittuvuutta. Staattiset haut löysivät `new Function` -käytön vain `src/adapters/browser`-sandboxista, salaisuushaku tuotti vain sanapohjaisia false positive -osumia kuten `js-tokens` ja iteminimet, ja ulkoiset URL/Babel-osumat jäivät legacy-arkistoon, legacy market -polkuun tai dokumentaatioon.

## Yhteenveto

Projektista ei löytynyt välitöntä kriittistä haavoittuvuutta, kuten kovakoodattuja salaisuuksia, evästeiden käsittelyä, autentikointivirheitä, `innerHTML`-pohjaisia XSS-nieluja tai `eval`-tyyppistä ajonaikaista koodin suorittamista.

Merkittävimmät riskit liittyvät kolmeen kokonaisuuteen:

1. Arkistoitu legacy-polku ajaa kehityskäyttöön tarkoitettuja CDN-kirjastoja ja Babel-käännöstä selaimessa ilman Content Security Policya. Root-tuotantopolku ei enää tee tätä.
2. Hintahakuun viitattu paikallinen palvelin/scraper ei ole mukana repossa, joten sen tietoturvaa ei voi auditoida tämän lähdekoodin perusteella.
3. Tuotu ja localStorageen tallennettu hintadata sekä osa sovellustilasta hyväksytään liian väljästi. Tämä ei näytä johtavan suoraan koodin suorittamiseen, mutta voi rikkoa laskentaa, vääristää tuloksia tai aiheuttaa selainpuolen palvelunestotilanteen.

Jos sovellus on vain henkilökohtaisessa paikallisessa käytössä, riskitaso on maltillinen. Jos tätä hostataan julkisesti tai käytetään luottamuksellisten päätösten tukena, alla olevat P2-löydökset kannattaa korjata ennen laajempaa käyttöä.

## Tarkastuksen kattavuus

Kävin läpi projektin tiedostot ja niiden pääasialliset interaktiot:

- `.gitattributes`
- `.gitignore`
- `README.md`
- `index.html`
- `styles.css`
- `gamedata.js`
- `engine.js`
- `trip.js`
- `equipment.js`
- `market.js`
- `planner-core.js`
- `planner.jsx`
- `views.jsx`
- `prices.json`
- `alch.json`
- `price-history.json`

Lisäksi tehtiin staattisia hakuja seuraaville aiheille: DOM-XSS-nielut, ajonaikainen koodin suoritus, ulkoiset URLit, localStorage/sessionStorage, evästeet, tokenit, salaisuudet, fetch-kutsut, CSP/SRI, sekä tiedostojen syntaksi ja JSON-validius.

## Arkkitehtuuri ja datavirrat

Sovellus latautuu `index.html`-tiedostosta. Se tuo ensin ulkoiset selainkirjastot ja sen jälkeen paikalliset moduulit globaalin `window`-objektin kautta.

Pääasiallinen latausjärjestys:

1. `gamedata.js` luo pelidatan ja apufunktiot `window.GameData`-objektiin.
2. `engine.js` lisää laskentamoottorin `window.SimEngine`-objektiin.
3. `trip.js` lisää retki- ja drop-laskennan `window.TripModel`-objektiin.
4. `equipment.js` lisää varustelogiikan `window.Equipment`-objektiin.
5. `market.js` muokkaa `GameData`-hintoja, hakee ulkoista markkinadataa ja käyttää localStoragea.
6. `planner-core.js` lisää optimointilogiikan `window.SimPlanner`-objektiin.
7. `planner.jsx` ja `views.jsx` muodostavat React-käyttöliittymän.

Tallennuspaikat selaimessa:

- `sim_prices_v1`
- `sim_alch_v1`
- `sim_price_history_v1`
- `sim_planner_v1`
- `sim_input_v3`
- `sim_hiscore_player`
- lisäksi joitakin näkymäkohtaisia asetuksia.

Ulkoiset verkko-osoitteet:

- `https://unpkg.com` React-, ReactDOM- ja Babel-skripteille.
- `https://fonts.googleapis.com` ja `https://fonts.gstatic.com` fontteihin.
- `https://markets.lostcity.rs` markkinadatalle.
- Paikallinen `http://localhost:8000` tai vastaava palvelin on mainittu UI-ohjeissa hintojen ja hiscorejen hakua varten, mutta palvelinkoodi ei ole repossa.

## Löydökset

### P2: Selain ajaa CDN-riippuvuuksia ja Babelia ilman CSP:tä

Viitteet:

- `index.html:7-14`
- `index.html:35-38`

`index.html` hakee Reactin, ReactDOMin ja Babel Standalonen CDN:stä. Skripteissä on SRI-tarkisteet, ja auditissa tarkistettiin, että ne vastaavat ladattuja tiedostoja. Tämä on hyvä suoja CDN-sisällön hiljaisia muutoksia vastaan.

Riski jää silti seuraaviin asioihin:

- React ja ReactDOM ovat development-versioita.
- Babel Standalone kääntää JSX:n selaimessa ajonaikaisesti.
- Sovelluksella ei ole Content Security Policya.
- Google Fonts -stylesheet ladataan ulkoa ilman SRI:tä, mikä on tavallista mutta silti ulkoinen riippuvuus.
- Inline-skriptit ja `text/babel` estävät tiukan CSP:n käyttöönoton nykyisessä muodossa.

Vaikutus:

- Jos CDN, selainympäristö tai tuleva lisätty HTML-injektio vaarantuu, vaikutusalueena on koko sovelluksen ajonaikainen tila ja localStorage.
- Julkisessa hostauksessa tämä on merkittävä supply-chain- ja hardening-puute.

Suositus:

- Lisää build-vaihe ja paketoi React-sovellus tuotantobundleksi.
- Poista Babel Standalone tuotantokäytöstä.
- Käytä Reactin production-buildia.
- Lisää CSP, esimerkiksi lähtökohtaisesti `default-src 'self'`, `script-src 'self'`, `connect-src 'self' https://markets.lostcity.rs`, `style-src 'self'`, ja tarkenna tätä toteutuksen mukaan.
- Harkitse fonttien itsehostausta, jos halutaan tiukka `style-src 'self'` ja `font-src 'self'`.

### P2: Paikallinen backend/scraper on auditin ulkopuolella

Viitteet:

- `.gitignore:3`
- `market.js:490-518`
- `market.js:604-640`
- `views.jsx:490-545`
- `views.jsx:2821-2895`

Käyttöliittymä ja `market.js` viittaavat paikallisiin endpointteihin:

- `/api/prices`
- `/api/scrape`
- `/api/hiscores`

Lisäksi käyttöliittymä ohjeistaa käynnistämään paikallisen palvelimen, ja `.gitignore` ohittaa `scrape_prices.py`-tiedoston. Repossa ei kuitenkaan ole `run_sim.py`-, `scrape_prices.py`- tai muuta backend-toteutusta.

Vaikutus:

- Endpointtien CORS-, SSRF-, input validation-, rate limit-, timeout-, error handling- ja bind address -turvallisuutta ei voi arvioida.
- Jos palvelin kuuntelee muualta kuin localhostista tai toimii yleisenä fetch-proxyna, siitä voi tulla merkittävä hyökkäyspinta.
- `/api/scrape` saa `items`-listan selaimelta. Ilman palvelinpuolen allowlistiä tämä voi johtaa hallitsemattomaan ulkoiseen liikenteeseen tai resurssikuormaan.

Suositus:

- Tuo paikallisen palvelimen lähdekoodi mukaan repossa auditoitavaksi, tai dokumentoi se erillisenä komponenttina.
- Varmista, että palvelin sitoutuu vain `127.0.0.1`-osoitteeseen.
- Lisää palvelinpuolelle tunnettu item-allowlist, aikakatkaisut, kohtuulliset rinnakkaisuusrajat ja vastauskokorajat.
- Älä tee palvelimesta yleistä URL-proxya.
- Lisää CORS-politiikka, joka sallii vain sovelluksen odotetun originin paikalliskäytössä.

### P2: Tuotu ja pysyvästi tallennettu markkinadata validoidaan liian väljästi

Viitteet:

- `market.js:364-380`
- `market.js:462-486`
- `market.js:524-542`
- `market.js:554-594`
- `views.jsx:2874-2886`

Hintojen importointi, automaattinen `prices.json`/`alch.json`-lataus, hintahistorian lataus sekä localStoragesta palautus hyväksyvät dataa melko kevyillä tarkistuksilla. Nykyinen logiikka tarkistaa lähinnä, että arvo on numero ja suurempi kuin nolla.

Puuttuvia tarkistuksia:

- Ei avainkohtaisia allowlist-tarkistuksia `GameData.ITEMS`-datan perusteella.
- Ei kattavaa `Number.isFinite`-tarkistusta kaikissa poluissa.
- Ei ylärajoja hinnoille, alch-arvoille tai snapshotien koille.
- Ei tiedostokokorajaa käyttäjän importoimalle JSONille.
- Ei merkittävää rakenneskeemaa hintahistorialle.

Vaikutus:

- Tahallisesti tai vahingossa tuotu JSON voi paisuttaa localStoragea ja hidastaa käyttöliittymää.
- Virheellinen hintadata voi vääristää simulaation tuloksia tavalla, joka näyttää käyttäjälle uskottavalta.
- Tuntemattomat item-avaimet voivat jäädä kiertämään tallennettuun tilaan.
- Tämä ei tällä hetkellä näytä muuttuvan DOM-XSS:ksi, koska React renderöi arvot tekstinä eikä raakaa HTML:ää käytetä.

Suositus:

- Lisää keskitetty validointifunktio hintadatalle.
- Hyväksy vain tunnetut item-avaimet.
- Vaadi `Number.isFinite(value)` ja järkevä kokonaislukualue.
- Rajoita importoitavan tiedoston maksimikoko ennen `FileReader`-lukua.
- Rajoita snapshotien lukumäärän lisäksi myös kokonaistavumäärää.
- Raportoi käyttäjälle hylätyt rivit/avaimet importin jälkeen.

### P3: localStorage-sovellustila yhdistetään ajonaikaiseen inputtiin ilman skeemaa

Viitteet:

- `planner.jsx:11-12`
- `views.jsx:3425-3437`
- `views.jsx:3440-3443`
- `views.jsx:4157-4177`

`views.jsx` palauttaa `sim_input_v3`-tilan localStoragesta ja yhdistää sen oletustilaan. Yhdistämisessä ei käytetä varsinaista skeemaa, eikä jokaiselle numeeriselle kentälle ole keskitettyä range-tarkistusta. `NumField` estää `NaN`-arvoja, mutta osa arvoista kulkee muiden event handlerien kautta.

Vaikutus:

- localStoragea muokkaava käyttäjä, selainlaajennus tai tuleva XSS voi syöttää äärimmäisiä arvoja, jotka vääristävät laskentaa tai hidastavat UI:ta.
- Vanhojen tallennusversioiden yhteensopivuus voi hajota hiljaisesti.

Suositus:

- Lisää `sanitizeInput(saved)`-tyyppinen keskitetty funktio.
- Määrittele jokaiselle kentälle tyyppi, minimi, maksimi ja oletusarvo.
- Pudota tuntemattomat avaimet.
- Tee versionvaihdoille eksplisiittiset migraatiot.

### P3: Virheraja näyttää stack tracen käyttöliittymässä

Viitteet:

- `index.html:43-56`

React-virheraja näyttää `error.stack`- ja `componentStack`-tiedot suoraan sivulla. Paikallisessa kehityksessä tämä on hyödyllistä, mutta julkisessa käytössä se vuotaa toteutusyksityiskohtia.

Vaikutus:

- Käyttäjä näkee tiedostonimiä, komponenttirakennetta ja pinojälkiä.
- Tämä ei yksinään ole vakava haavoittuvuus, mutta helpottaa virheiden kartoittamista.

Suositus:

- Näytä yksityiskohtainen stack trace vain local/dev-ympäristössä.
- Tuotannossa näytä yleinen virheilmoitus ja kirjaa yksityiskohdat vain kehittäjälle sopivaan lokiin.

### P3: Globaali `window`-rajapinta on laaja ja mutatoitava

Viitteet:

- `gamedata.js:1802`
- `engine.js:1547`
- `trip.js:631`
- `equipment.js:262`
- `market.js:644`
- `planner-core.js:543`
- `planner.jsx:499`
- `views.jsx:4361`

Sovellus koostuu globaaleista objekteista ja funktioista. Tämä on staattisessa selainprojektissa ymmärrettävää, mutta se tarkoittaa, että mikä tahansa sivulla ajava kolmannen osapuolen skripti tai tuleva XSS saa suoran pääsyn muun muassa hintojen, historian ja simulaatiodatan muuttamiseen.

Vaikutus:

- Löydös ei ole itsenäinen haavoittuvuus ilman erillistä skriptin suorituskanavaa.
- Se kasvattaa muun haavoittuvuuden vaikutusta, koska suojaavia moduulirajoja ei ole.

Suositus:

- Siirrä koodi moduulibundleen.
- Altista `window`-objektiin vain välttämätön debug-pinta paikallisessa kehityksessä.
- Jäädytä staattiset dataobjektit mahdollisuuksien mukaan tai tarjoa kontrolloidut päivitysfunktiot.

### P3: Ulkoisen markkina-HTML:n parsinta on hauras data-integriteettiriski

Viitteet:

- `market.js:115-179`

`fetchItemData` hakee dataa `markets.lostcity.rs`-palvelusta ja yrittää tarvittaessa purkaa sivun `__NEXT_DATA__`-JSONia regexillä. Tämä ei vaikuta johtavan HTML:n renderöintiin raakamuodossa, joten XSS-riski on matala. Riski on enemmän data-integriteetissä ja luotettavuudessa.

Vaikutus:

- Etäpalvelun formaattimuutos voi rikkoa hinnat hiljaisesti.
- Pahantahtoinen tai virheellinen vastaus voi tuottaa epärealistisia arvoja, ellei niitä validoida tiukemmin.

Suositus:

- Käytä ensisijaisesti strukturoitua APIa.
- Lisää hintojen ja alch-arvojen range-tarkistus samaan keskitettyyn validointiin kuin importissa.
- Tee virheistä näkyviä käyttäjälle sen sijaan, että epäilyttävä data päätyy pysyvään localStorageen.

## Positiiviset havainnot

- Ei löytynyt kovakoodattuja API-avaimia, tokeneita, salasanoja tai yksityisiä avaimia.
- Ei löytynyt `document.cookie`-käyttöä eikä evästepohjaista sessiologiikkaa.
- Legacy-snapshotista ei löytynyt `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` tai käyttäjäsyötteeseen kohdistuvaa ajonaikaista koodin suorittamista. Rewrite-adapterissa on `new Function` vain luotettujen bundlattujen legacy-lähteiden sandbox-bootstrapiin.
- React-renderöinti näyttää käsittelevän käyttäjän ja ulkoisen datan tekstinä.
- Ulkoisten unpkg-skriptien SRI-tarkisteet vastaavat ladattuja tiedostoja.
- JSON-tiedostot ovat valideja.
- JavaScript-tiedostot läpäisivät syntaksitarkistuksen.

## Tiedostokohtainen läpikäynti

### `.gitattributes`

Sisältää rivinvaihtoasetuksen. Ei tietoturvahavaintoja.

### `.gitignore`

Ohittaa `deploy`, `simulator.zip`, `scrape_prices.py` ja `backup`. Tietoturvan kannalta huomionarvoista on `scrape_prices.py`, koska sovellus viittaa scraper-/backend-toimintoihin, mutta niihin liittyvä koodi ei ole auditoitavissa tässä repossa.

### `README.md`

Sisältää vain lyhyen projektin otsikon ja revision. Ei tietoturvahavaintoja.

### `index.html`

Toimii nykyisen root-sovelluksen Vite-entrypointina. Ei lataa CDN-skriptejä, Babel Standalonea tai inline JSX:ää.

### `legacy/index.html`

Arkistoitu legacy-runtime. Merkittävimmät havainnot ovat CDN-riippuvuudet, selaimessa ajettava Babel Standalone, CSP:n puute ja virherajan stack trace -näyttö. SRI on kunnossa unpkg-skripteissä. Tämä tiedosto ei ole root-tuotantopolku.

### `styles.css`

Sisältää vain paikallisia tyylimäärityksiä. Ei ulkoisia `url()`-latauksia tai CSS-importteja. Ei tietoturvahavaintoja.

### `gamedata.js`

Sisältää staattista pelidataa ja laskentaa. Altistaa `window.GameData`-objektin. Ei verkko-, DOM- tai storage-operaatioita. Pääasiallinen riski liittyy siihen, että muut moduulit ja selainkonsoli voivat mutatoida globaalia dataa.

### `engine.js`

Sisältää simulaation laskentamoottorin ja altistaa `window.SimEngine`-objektin. Ei DOM-, verkko- tai storage-operaatioita. Ei suoria tietoturvahavaintoja.

### `trip.js`

Sisältää retkilogiikkaa ja drop-/inventaarilaskentaa. Altistaa `window.TripModel`-objektin. Ei DOM-, verkko- tai storage-operaatioita. Ei suoria tietoturvahavaintoja.

### `equipment.js`

Sisältää varuste- ja bonuslaskentaa. Altistaa `window.Equipment`-objektin. Ei DOM-, verkko- tai storage-operaatioita. Ei suoria tietoturvahavaintoja.

### `market.js`

Tärkein tietoturvan kannalta. Hoitaa ulkoiset markkinahaut, paikallisen backendin kutsut, hintojen importin, localStorage-persistoinnin ja hintahistorian. Löydökset koskevat erityisesti datan validointia, paikallisen backendin auditoimattomuutta ja ulkoisen HTML/JSON-datan luotettavuutta.

### `planner-core.js`

Sisältää optimointilogiikkaa ja käyttää muita globaaleja moduuleja. Ei DOM-, verkko- tai storage-operaatioita. Ei suoria tietoturvahavaintoja.

### `planner.jsx`

Sisältää planner-näkymän React-komponentit ja käyttää localStoragea `sim_planner_v1`-avaimella. Ei vaarallisia DOM-nieluja. Suositus on validoida pysyvästi tallennettu planner-tila ennen käyttöönottoa.

### `views.jsx`

Sisältää suurimman osan käyttöliittymästä. Ei löytynyt raakaa HTML-renderöintiä tai ajonaikaista koodin suorittamista. Merkittävimmät kohdat ovat localStorage-tilan palautus, JSON-importti, hiscore-/market-endpointtien käyttö ja paikallisen palvelimen kytkentä. Käyttöliittymä rajaa hiscore-haun local/localhost-ympäristöön, mikä on hyvä ratkaisu.

### `prices.json`

Validi JSON-objekti. Sisältää hintadataa, jota sovellus käyttää. Tiedostolle kannattaa soveltaa samaa skeemavalidointia kuin käyttäjän importoimalle hintadatalle.

### `alch.json`

Validi JSON-objekti. Sisältää alch-arvoja, joita sovellus käyttää. Tiedostolle kannattaa soveltaa samaa skeemavalidointia kuin käyttäjän importoimalle hintadatalle.

### `price-history.json`

Validi JSON-taulukko. Sisältää hintahistoriaa. Suositus on validoida snapshot-rakenne, avainjoukko ja kokonaiskoko ennen localStorageen tallentamista.

## Priorisoitu korjauslista

1. Lisää build-vaihe ja poista selaimessa ajettava Babel tuotantokäytöstä. Tila: tehty root-polulle, legacy arkistoitu.
2. Lisää CSP ja siirry mahdollisimman pitkälle itsehostattuihin assetteihin. Tila: CSP dokumentoitu deploy-vaatimukseksi; deploy target puuttuu.
3. Tuo paikallisen backendin/scraperin lähdekoodi versionhallintaan tai dokumentoi ja auditoi se erikseen.
4. Lisää keskitetty skeemavalidointi hinnoille, alch-arvoille ja hintahistorialle.
5. Lisää keskitetty skeemavalidointi localStorage-sovellustilalle.
6. Rajoita käyttäjän importoimien tiedostojen koko ja importoitavien avainten määrä.
7. Piilota stack trace -tiedot tuotantokäytössä.
8. Pienennä globaalia `window`-pintaa ja käytä moduulibundlea. Tila: root-polku käyttää moduulibundlea; legacy-lähteet säilyvät arkistossa ja sandbox-bootstrapissa.

## Auditissa ajetut tarkistukset

- Tiedostoinventaario `rg --files` ja `find`.
- Staattiset haut DOM-XSS-nieluille ja ajonaikaiselle koodin suorittamiselle.
- Staattiset haut ulkoisille URL-osoitteille, fetch-kutsuille ja localStorage-käytölle.
- Staattiset haut salaisuuksille, tokeneille, evästeille ja Authorization/Bearer-merkkijonoille.
- `node --check` JavaScript-tiedostoille.
- JSON-parse-tarkistus `prices.json`, `alch.json` ja `price-history.json` -tiedostoille.
- CDN-skriptien SRI-hashien riippumaton tarkistus `curl`- ja `shasum`-komennoilla.

## Auditissa ei voitu varmistaa

- Paikallisen backendin/scraperin turvallisuutta, koska koodi ei ole repossa.
- Hostausympäristön HTTP-headerit, koska staattista deploy-ympäristöä ei ole mukana.
- Mahdollisia selaimen laajennusten, käyttäjän koneen tai muun paikallisen ympäristön vaikutuksia.

## Suositeltu tavoitetila

Turvallisempi tuotantomalli olisi:

- Buildattu staattinen bundle ilman Babel Standalonea.
- Production React.
- Tiukka CSP.
- Itsehostatut tai tarkasti rajatut kolmannen osapuolen assetit.
- Auditoitu localhost-palvelin, joka ei toimi yleisenä proxyna.
- Skeemavalidoitu kaikki ulkoinen, importoitu ja localStoragesta palautettu data.
- Mahdollisimman pieni globaali debug-rajapinta.
