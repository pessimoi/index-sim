# Projektin tiedostoittainen tarkastus

> Historiallinen 2026-07-05 legacy-tarkastelusnapshot. Nykyinen root-sovellus on
> Vite/React-rewrite, ja tämän tiedoston silloiset repo-, entrypoint-, backend- ja
> testittömyysväitteet ovat vanhentuneita. Katso [nykyarkkitehtuuri](docs/technical/architecture.md)
> sekä [nykyinen koodiaudit](docs/project/code-audit.md); alla olevat löydökset
> säilyvät arkistoidun runtimen evidenssinä. Nykyinen arkkitehtuuriauditointi on
> tiedostossa [docs/project/architecture-audit.md](docs/project/architecture-audit.md).

Päiväys: 2026-07-05  
Kohde: `/Users/pessi/index-sim`  
Rajaus: staattinen ja kevyt ajonaikainen tarkastus. Koodia ei korjattu.

## Yhteenveto

Projekti on staattinen selainpohjainen 2004scape Combat Simulator. `index.html`
lataa globaalit JavaScript-moduulit järjestyksessä ja ajaa React/JSX-näkymät
selaimessa Babel Standalonen kautta. Repossa ei ole `package.json`-tiedostoa,
automaattisia testejä tai UI:ssa mainittua paikallista `run_sim.py`-palvelinta.

Vakavimmat käytös- ja laskentariskit ovat:

1. Current monster -hintasynkronointi kaatuu monella monsterilla nested loot
   -rakenteeseen.
2. Planner voi pisteyttää vaihtoehtoaseita vanhan aseen stab/slash/crush-
   tarkkuuksilla.
3. UI ohjaa käyttämään `run_sim.py`-palvelinta ja `/api/*`-endpointteja, mutta
   palvelinkoodia ei ole repossa.
4. Ring of Wealth / randomjewel -kommentit ja toteutus ovat ristiriidassa
   dragonstone-slotin osalta.
5. Trip-mallissa on tietoisia oletuksia, jotka voivat aliarvioida ruokaa,
   damagea ja kuluja, jos käyttäjä ei huomaa muuttaa niitä.
6. Drop-tauluissa on useita item-nimi/key-yhdistelmiä, jotka näyttävät
   vääriltä tai vähintään tarkistusta vaativilta.

## Varmistusajot

Tehdyt lukevat tarkistukset:

- `git status --short`
  - Työpuussa näkyi myös muita seuraamattomia audit-tiedostoja:
    `SECURITY_AUDIT.md` ja myöhemmässä lopputarkistuksessa
    `ARCHITECTURE_AUDIT.md`.
  - En koskenut niihin.
- `node --check engine.js equipment.js gamedata.js market.js planner-core.js trip.js`
  - Kaikki tarkistetut tavalliset `.js`-tiedostot menivät syntaksitarkistuksesta läpi.
- JSON-parse:
  - `prices.json` validi
  - `alch.json` validi
  - `price-history.json` validi
- Rakennetarkistus:
  - `run_sim.py`, `scrape_prices.py`, `package.json` ja testitiedostot eivät löydy
    tästä checkoutista.
- Ajonaikainen minitesti:
  - `syncMarketPrices()` heittää nested loot -monsterilla virheen:
    `Cannot read properties of undefined (reading 'toLowerCase')`.
- Plannerin minitesti:
  - Kun `bestConfig()` simuloi `dragon_mace`-kandidaattia, `accBonus` vaihtuu
    60:een, mutta `accByType` jäi testissä vanhan `rune_scimitar`-loadoutin
    arvoihin `{ stab: 7, slash: 45, crush: -2 }`.

## Löydökset

### P1: Current monster -hintasynkronointi kaatuu nested loot -riveihin

Viitteet:

- `gamedata.js:463-469`
- `market.js:187-195`
- `market.js:270-277`

`gemDrop()` palauttaa arrayn, ja monet monsterit lisäävät sen sellaisenaan
`loot`-taulukkoon. `market.js` huomioi tämän oikein `allLootKeys()`-polussa
käyttämällä `.flat()`, mutta `itemKeysForMonster()` käy `monster.loot`-rivit
suoraan läpi ja lukee `drop.name`.

Vaikutus:

- Settings-näkymän "Sync current monster" voi kaatua monsterilla, jonka droppeihin
  kuuluu gem/casket-tyyppinen nested array.
- Kevyt ajonaikainen testi vahvisti kaatumisen ensimmäisellä nested loot
  -monsterilla.

Tarkistushuomio:

- Sama flatten-logiikka kannattaa yhtenäistää kaikkiin lootia lukeviin polkuihin.

### P1: Planner käyttää vaihtoehtoaseille vanhaa `accByType`-kenttää

Viitteet:

- `equipment.js:234-251`
- `engine.js:591-600`
- `planner-core.js:220-225`
- `planner-core.js:246-291`

Simulaattori käyttää meleessä stance-kohtaista `input.accByType`-arvoa, jos se on
olemassa. Plannerin `bestConfig()` vaihtaa kandidaattiaseen simulaatioon kentät
`weapon`, `weaponName`, `accBonus`, `dmgBonus` ja `attackSpeed`, mutta ei päivitä
`accByType`-kenttää.

Vaikutus:

- Jos nykyinen ase on esimerkiksi slash-painotteinen ja planner vertailee crush-
  tai stab-asetta, engine voi edelleen käyttää nykyisen aseen stab/slash/crush-
  kokonaisbonuksia.
- Tämä voi vääristää aseen valintaa, gear-unlockeja, training orderia ja DPS/XP-
  optimointia.

Lisähuomio:

- `calcOffense()` käyttää meleessä vain flat `accBonus`-arvoa ja armourin
  `slashAtt`-bonusta. Tämä ei vastaa engineen rakennettua per-stance
  tarkkuusmallia.

### P1: Planner valitsee training stance -id:n base-aseen perusteella

Viitteet:

- `planner-core.js:111-121`
- `engine.js:254-260`
- `planner-core.js:240-291`

`trainingStanceId(base, skill)` hakee stance-listan `base.weapon`-aseelle. Kun
planner myöhemmin simuloi eri kandidaattiasetta, sama stance-id välitetään
eteenpäin. Engine fallbackaa tuntemattoman stance-id:n aseen ensimmäiseen
stanceen.

Vaikutus:

- Aseenvaihdon jälkeen Attack/Strength/Defence-vaiheiden pisteytys voi käyttää
  väärää stancea tai fallback-stancea.
- Erityisesti halberd-, dagger-, mace- ja controlled-only-tilanteet voivat antaa
  poikkeavia tuloksia.

### P1/P2: UI viittaa puuttuvaan paikalliseen palvelimeen

Viitteet:

- `.gitignore:3`
- `market.js:489-503`
- `market.js:509-514`
- `views.jsx:491-542`
- `views.jsx:2823-2853`
- `views.jsx:3022`

Käyttöliittymä ja `market.js` viittaavat endpointteihin:

- `/api/prices`
- `/api/scrape`
- `/api/hiscores`

UI ohjeistaa ajamaan `python run_sim.py`, mutta repossa ei ole `run_sim.py`-
tiedostoa. `.gitignore` mainitsee myös `scrape_prices.py`, joka on jätetty
versionhallinnan ulkopuolelle.

Vaikutus:

- Hiscores lookup ja full scrape eivät ole tässä checkoutissa käytettävissä.
- Käyttäjä saa ohjeen ajaa tiedosto, jota ei ole.
- Endpointtien input validation, CORS, timeoutit ja muu käyttäytyminen eivät ole
  auditoitavissa tästä repositoriosta.

### P2: Current sync päivittää gem alias -avaimia, mutta EV käyttää `uncut_*`-avaimia

Viitteet:

- `market.js:36-42`
- `market.js:210-224`
- `gamedata.js:258-263`
- `gamedata.js:313-318`

`syncMarketPrices()` lisää synkronoitaviin keyhin `sapphire`, `emerald`, `ruby`,
`diamond` ja `dragonstone`. `recalcGemEV()` kuitenkin käyttää ensisijaisesti
`P.uncut_sapphire`, `P.uncut_emerald`, `P.uncut_ruby` ja `P.uncut_diamond`.

Kevyt testi vahvisti tämän:

- ennen: `sapphire: 460`, `uncut_sapphire: 1400`, `GEM_EV_BASE: 2716.401...`
- sync päivitti `sapphire`-arvon testihintaan
- jälkeen: `uncut_sapphire` ja `GEM_EV_BASE` eivät muuttuneet

Vaikutus:

- Current monster -synkronointi voi näyttää onnistuneelta mutta jättää gem table
  EV:n vanhaan arvoon.
- `prices.json`-polku käyttää `uncut_*`-avaimia ja toimii tässä suhteessa paremmin.

### P2: `SLUG_MAP` kattaa vain osan scrape-kohteista

Viitteet:

- `market.js:36-109`
- `market.js:270-293`
- `market.js:604-643`

`allLootKeys()` palautti tarkistuksessa 81 keytä. Näistä 42 puuttui
`SLUG_MAP`-kartasta. Esimerkkejä:

- `adamant_arrow`
- `dragonhide_red`
- `dragonhide_black`
- `uncut_sapphire`
- `uncut_emerald`
- `loop_half_key`
- `tooth_half_key`
- monet `herb_*`-avaimet
- `granite_shield`

Vaikutus:

- Current monster -synkronointi ei edes yritä hakea osaa merkittävistä dropeista.
- `window.marketPythonSnippet` rakentuu `SLUG_MAP`-arvoista, joten myös se näyttää
  kattavuudeltaan kapealta suhteessa `allLootKeys()`-dataan.
- Puuttuvan `run_sim.py`-palvelimen odotettua key-formaattia ei voi tarkistaa.

### P2: Ring of Wealth -kommentti ja randomjewel-toteutus ovat ristiriidassa

Viitteet:

- `gamedata.js:5`
- `gamedata.js:254-275`
- `gamedata.js:300-305`

Tiedoston alussa lukee, että Ring of Wealth vaikuttaa `randomjewel`-tauluun ja
"adds dragonstone slot". Varsinaisessa `JEWEL_TABLE`-taulussa ei kuitenkaan ole
dragonstone-bandiä. RoW-malli muuttaa nimittäjän 128 -> 65, jolloin rolli osuu
aina olemassa olevaan 0..64 value-bandiin.

Vaikutus:

- Jos tarkoitus on oikeasti lisätä dragonstone slot, RoW EV on väärä.
- Jos toteutus on oikea, tiedoston yläkommentti ja `SPECIAL_KEYS.gem`-lista
  johtavat harhaan.

### P2: Monsterien incoming damage voi aliarvioitua

Viitteet:

- `trip.js:83-100`

`computeIncoming()` sisältää oman kommentin siitä, että monster max hit -kaava
aliarvioi olentoja, joilla on strength bonus, ellei `m.maxHit` ole asetettu.
Kommentti mainitsee esimerkkinä fire giantin: laskettu 7, todellinen 11.

Vaikutus:

- Food usage, trip length, banking, netto gp/hr ja effective xp/hr voivat näyttää
  liian hyviltä.
- Koska tämä vaikuttaa erityisesti kovempia mobeja vastaan, virhe voi ohjata
  planneria suosimaan liian riskisiä kohteita tai liian pitkiä trippejä.

### P2: Auto safespot nollaa incoming damagen oletuksena

Viitteet:

- `trip.js:102-115`
- `views.jsx:2169-2176`

Ranged, magic ja halberd asetetaan oletuksena safespotiksi. UI kertoo tämän,
mutta oletus on laskennan kannalta vahva: monsteri ei tee damagea eikä dragonfirea.

Vaikutus:

- Jos pelaaja taistelee avoimessa tilassa, ruoka-, antifire-, antipoison- ja
  prayer-kulut voivat olla liian matalat.
- Tämä ei ole välttämättä bugi, mutta se on korkean vaikutuksen oletus ja ansaitsee
  näkyvän tarkistuksen raportoinnissa.

### P2: Dragon halberd spec yliarvioidaan pieniin targetteihin

Viitteet:

- `engine.js:407-424`
- `views.jsx:1033-1036`

Koodi kommentoi itse, että dragon halberd osuu kahdesti vain yli 1x1-targetteihin,
mutta simulaatio käyttää kahta osumaa kaikille mobeille. UI näyttää tästä
varoituksen.

Vaikutus:

- Dragon halberd specin DPS gain on liian korkea pieniin mobeihin.
- Koska UI varoittaa tästä, kyse on dokumentoidusta mallirajoitteesta eikä
piilobugista.

### P2: Hardcoded `adamant_arrow` ylikirjoitetaan kahdesti

Viitteet:

- `gamedata.js:92-94`
- `gamedata.js:122-126`
- `prices.json`

`Object.assign(P, {...})` sisältää ensin `"adamant_arrow":133` ja saman objektin
lopussa `"adamant_arrow":80`. JavaScriptissä viimeinen voittaa.

Vaikutus:

- Jos `prices.json` ei lataudu, fallback-hinta on 80 eikä aiempi 133.
- Nykyinen `prices.json` sisältää `adamant_arrow`-avaimen, joten normaalissa
  onnistuneessa auto-loadissa tämä korjaantuu myöhemmin.

### P2/P3: Drop-nimi ja price key näyttävät paikoin ristiriitaisilta

Viitteitä:

- `gamedata.js:593`
- `gamedata.js:614`
- `gamedata.js:632`
- `gamedata.js:668-669`
- `gamedata.js:703`
- `gamedata.js:940`
- `gamedata.js:1045`
- `gamedata.js:1101`
- `gamedata.js:1442`

Esimerkkejä tarkistettavista riveistä:

- `Bronze med helm` -> `iron_full_helm`
- `Black wizard hat` -> `chefs_hat`
- `Black robe` / `Wizard robe` -> `goblin_armour`
- `Steel sq shield` -> `mithril_sq_shield`
- `Iron longsword` -> `iron_sword`
- `Steel sword` -> `steel_longsword`
- `Black sq shield` -> `black_kiteshield`
- `Adamant javelin x30` -> `steel_javelin`

Osa näistä voi olla tietoinen surrogate-hinta tai skip-defaultien takia
vähävaikutteinen. Silti ainakin `Steel sq shield -> mithril_sq_shield` ja
`Adamant javelin -> steel_javelin` näyttävät arvoon suoraan vaikuttavilta.

### P3: P-literalissa on duplikaattiavaimia

Viitteet:

- `gamedata.js:15-87`

Tarkistuksessa löytyi ensimmäisestä `P`-literalista duplikaatit:

- `tin_ore`
- `copper_ore`
- `adamantite_bar`
- `spinach_roll`
- `bronze_scimitar`
- `iron_scimitar`

Vaikutus:

- Viimeinen arvo voittaa hiljaisesti.
- Tämä ei välttämättä riko nykyistä laskentaa, koska myöhemmät scraped-hinnat ja
  `prices.json` voivat ylikirjoittaa arvoja, mutta ylläpito muuttuu virhealttiiksi.

### P3: Zero-arvoisia alch-arvoja ei auto-loadata

Viitteet:

- `market.js:462-477`
- `market.js:554-571`

`applyScrapeResults()` hyväksyy alch-arvoihin `>= 0`, mutta `autoLoadPriceFiles()`
käyttää sekä prices- että alch-tiedostoihin ehtoa `v > 0`.

Vaikutus:

- `alch.json`-tiedoston tarkoituksellinen 0-arvo ei voi ylikirjoittaa aiempaa
  positiivista persisted-arvoa.
- Normaalisti fallback `?? 0` peittää osan vaikutuksesta, joten riski on matala.

### P3: `index.html` käyttää dev-kirjastoja ja runtime-Babelia

Viitteet:

- `index.html:12-14`
- `index.html:35-38`

Sivu lataa React development -buildit ja Babel Standalonen CDN:stä. Tämä toimii
paikallisessa prototyypissä, mutta tuotantokäytössä se tuo performance-,
debuggability- ja supply-chain-riskin. SRI-tarkisteet ovat mukana React/Babel-
skripteille, mikä on hyvä.

Vaikutus:

- JSX:n syntaksia ei tarkisteta repo-local build-vaiheessa.
- Selain tekee käännöksen runtime-vaiheessa.
- Offline/file-käyttö riippuu CDN-yhteydestä ja selaimen `fetch()`-käytöksestä.

### P3: `price-history.json` on validi mutta yksirivinen

Viitteet:

- `price-history.json`

Tiedosto on validi JSON-array. Siinä on 13 snapshotia aikaväliltä
2026-06-22T14:06:03Z - 2026-07-03T14:59:19Z. Tiedosto on kuitenkin yhdellä
pitkällä rivillä.

Vaikutus:

- Diffit ovat vaikealukuisia.
- Tämä ei vaikuta runtime-käytökseen.

## Tiedostoittaiset muistiinpanot

### `.gitattributes`

Sisältää LF-normalisoinnin. Ei laskentariskejä. Huomio: tiedosto vaikuttaa
puuttuvan newlineen lopusta, koska `.gitignore`-otsikko tulostui heti perään
shell-tulosteessa.

### `.gitignore`

Ohittaa `deploy`, `simulator.zip`, `scrape_prices.py` ja `backup`.
`scrape_prices.py`-ohitus on merkittävä, koska koodi ja kommentit viittaavat
scraperiin mutta toteutus ei ole auditoitavissa.

### `README.md`

Erittäin lyhyt. Kertoo nimen, revision ja hintojen päivitysajan, mutta ei kerro:

- miten sovellus käynnistetään
- tarvitaanko HTTP-serveriä vai riittääkö `file://`
- miten `run_sim.py` saadaan
- miten hinnat päivitetään
- miten laskennan tunnetut rajoitteet tulkitaan

### `index.html`

Lataa koko sovelluksen. SRI on mukana ulkoisissa React/Babel-skripteissä.
Runtime-Babel ja React development -buildit ovat prototyyppimäisiä. ErrorBoundary
näyttää stack tracen suoraan UI:ssa, mikä on paikallisessa kehityksessä hyödyllistä
mutta julkisessa hostauksessa liian paljastavaa.

### `styles.css`

Ei havaittuja laskentaan vaikuttavia ongelmia. Tiedosto on ulkoasupainotteinen.
Mahdolliset CSS-riskit ovat lähinnä ylläpidollisia, eivät simulaation logiikkaa
rikkovia.

### `gamedata.js`

Projektin suurin data- ja domain-oletusten lähde. Merkittävät huomiot:

- `gemDrop()` palauttaa arrayn, mikä rikkoo `market.js` current sync -polun.
- Ring of Wealth -kommentti dragonstone-slotista ei näy `JEWEL_TABLE`-toteutuksessa.
- Useita duplicate price key -avaimia.
- Useita epäilyttäviä drop name -> key -mappauksia.
- `STATIC_PRICES` ylikirjoittaa `P`:n lopussa, mikä on tällä hetkellä rajattu
  lähinnä talisman/javelin-fallbackeihin.
- `defaultLootAction()` käyttää name-pohjaista normalisointia, mikä auttaa
  monessa surrogate-key-tapauksessa mutta ei poista price-key-riskin vaikutusta
  kaikissa riveissä.

### `equipment.js`

Varustelogiikka tukee melee-aseiden per-style attack bonuksia ja palauttaa
`accByType`-kentän. Tämä on hyvä malli. Ongelma syntyy plannerin puolella, koska
planner ei päivitä kenttää asevaihtoehtoja simuloidessaan.

### `engine.js`

Core combat engine on laaja ja suhteellisen hyvin kommentoitu. Huomiot:

- `simulate()` käyttää `accByType`-kenttää oikein meleessä.
- Dragon halberd specin kaksi osumaa kaikille mobeille on dokumentoitu
  mallirajoite.
- Engine nojaa monissa kohdissa siihen, että input on jo järkevästi sanitisoitu.
  Koska localStorage ja UI inputit eivät ole skeemavalidoituja keskitetysti,
  äärimmäiset arvot voivat tuottaa outoja laskelmia.

### `trip.js`

Trip/inventory/banking-malli sisältää tärkeitä oletuksia:

- `m.maxHit`-override puuttuu monelta monsterilta, jolloin incoming damage voi
  aliarvioitua.
- Ranged/magic/halberd safespot oletetaan päälle.
- Stackable/non-stackable-logiikka näyttää harkitulta, mutta kaikki virheelliset
  drop keyt voivat silti vaikuttaa inventory- ja value-laskentaan.

### `market.js`

Selkeimmät runtime-riskit ovat täällä:

- `itemKeysForMonster()` ei flattaa nested lootia.
- Current sync päivittää gem alias -avaimia, joita gem EV ei välttämättä käytä.
- `SLUG_MAP` ei kata suurta osaa `allLootKeys()`-avaimista.
- Server-polku riippuu puuttuvasta `run_sim.py`-toteutuksesta.
- Alch zero -arvot käsitellään eri tavoin eri latauspoluissa.

### `planner-core.js`

Plannerin merkittävimmät riskit:

- Asekandidaatin `accByType` jää base-loadoutista.
- `trainingStanceId()` perustuu base-aseeseen, ei kandidaattiaseeseen.
- `calcOffense()` ei rakenna stab/slash/crush-kohtaisia arvoja.
- Hypoteettiset aseet on merkitty OSRS-arvoihin perustuviksi, mikä on hyvä
  varoitus mutta laskennan kannalta tietoinen epävarmuus.

### `planner.jsx`

Planner UI käyttää localStoragea ja nojaa `SimPlanner`-globaaliin. Ei erillistä
build/test-polun tarkistusta. Varsinainen laskentariski on pääosin
`planner-core.js`-tiedostossa.

### `views.jsx`

Suurin UI-tiedosto. Huomiot:

- Hiscores lookup näyttää `run_sim.py`-ohjeen, vaikka palvelin puuttuu.
- Settings-paneelin scrape-toiminnot nojaavat samaan puuttuvaan palvelimeen.
- UI varoittaa dragon halberd -specin rajoitteesta.
- UI kertoo safespot-oletuksesta, mutta oletus on silti vahva ja voi helposti
  vääristää käyttäjän tulkintaa.
- LocalStorage-tilaa yhdistetään käyttöinputtiin useissa kohdissa ilman yhtä
  keskitettyä skeemavalidointia.

### `prices.json`

Validi JSON. Sisältää 127 varsinaista hinta-avainta sekä `_scraped_at`-metan.
Näyttää olevan tärkeä, koska monet fallbackit `gamedata.js`:ssä ovat vanhentuvia
tai ristiriitaisia.

### `alch.json`

Validi JSON. Sisältää 134 alch-avainta. Tarkistuksessa löytyi 8 alch-avainta,
joita ei ole `prices.json`-tiedostossa:

- `adamant_knife`
- `bass`
- `black_dart`
- `black_knife`
- `bones`
- `bronze_knife`
- `mithril_knife`
- `steel_knife`

Tämä voi olla täysin hyväksyttävää, koska high alch ja market price eivät ole sama
asia. Se on kuitenkin hyvä huomioida, jos key registryä yhtenäistetään.

### `price-history.json`

Validi JSON, 13 snapshotia. Viimeisessä snapshotissa oli 127 price keytä.
Yksirivisyys tekee muutosten reviewistä hankalaa.

## Ehdotettu jatkotarkistusjärjestys

Korjauksia ei tehty tässä tarkastuksessa. Jos näitä lähdetään myöhemmin
korjaamaan, riskiperusteinen järjestys olisi:

1. Korjaa `market.js` current sync nested loot -kaatuminen ja gem alias -päivitys.
2. Korjaa plannerin `accByType`- ja stance-kandidaattilogiikka.
3. Päätä, tuodaanko `run_sim.py`/scraper repoihin vai poistetaanko UI-ohjeet.
4. Varmista Ring of Wealth / dragonstone -mekaniikka lähdedatasta.
5. Tarkista epäilyttävät drop name -> key -mappaukset lähdedataa vasten.
6. Lisää muutama pieni regression-testi ainakin market key collectionille,
   planner weapon candidate -simulaatiolle ja JSON-lataukselle.
