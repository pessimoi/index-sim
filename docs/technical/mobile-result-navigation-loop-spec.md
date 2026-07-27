# Mobiilin tulos- ja navigointisilmukan viimeistelyspeksi

- Status: implemented
- Date: 2026-07-20
- Owner: technical documentation
- Evidence: verified
- Contract: closed

- Päiväys: 2026-07-20
- Prioriteetti: korkea
- Arvioitu työmäärä: M
- Omistajat: `WorkbenchShell`, `MetricList`, workbench-välilehtien esitys ja
  responsiivinen testimatriisi
- Tuotepinta: pelaajasyötteet, headline-tulos, setup-toiminnot ja workbench-
  navigaatio
- Liittyvät päätökset: D-070, D-075, D-079, D-080 ja D-082

## Tarkoitus

Viimeistele nykyisen root-rewriten mobiilin perussilmukka niin, että käyttäjä
näkee pelaajasyötteiden vaikutuksen ilman pitkää tuloksen etsintää ja löytää
kaikki yksitoista workbench-välilehteä ilman tietoa piilossa olevasta
vaakavierityksestä.

Tämä on olemassa olevan käyttöliittymän responsiivinen esitys- ja
navigointimuutos. Se ei muuta laskentaa, dataa, lomaketilaa tai persistenssiä.

## Feature-inventory-tarkistus

- `Basic combat setup`, `Result summary`, `Keyboard navigation` ja nykyinen
  responsive workbench ovat feature inventoryssa `Valmis`.
- Nykyinen inventaario ja Playwright-evidenssi todistavat workbenchin
  vaakasuuntaisen containmentin, kaikkien välilehtien ohjelmallisen
  saavutettavuuden sekä roving-tablistin nuoli-, Home- ja End-käytöksen.
- Evidenssi ei todista, että mobiilikäyttäjä näkee headline-tuloksen lähellä
  muuttamiaan syötteitä tai saa näkyvän vihjeen oikealle jatkuvasta
  välilehtilistasta.
- Tämä tavoite ei lisää uutta feature-inventory-riviä eikä muuta nykyisiä
  `Valmis`-tiloja. Toteutuksen jälkeen riveihin voidaan lisätä vain päivätty
  mobiilievidenssi.

## Varmennettu lähtötila ja käyttäjäongelma

Tämän tavoitteen 390 × 844 -before-tarkastuksessa selainprofiilin näkyvä
local-state attention -ilmoitus huomioiden ensimmäisen normaalikulussa näkyvän
headline-mittaririvin yläreuna oli 2 141,5 CSS-pikselissä. `Player setup`
päättyi 1 026,8 pikselissä, joten väli oli 1 114,8 pikseliä. Luku on kyseisen
fixture-/profiilitilan havainto eikä pysyvä pikselisopimus.

Lähdekoodi todentaa rakenteellisen syyn:

- `WorkbenchShell` renderöi pelaajapalkin ennen workbench-keskustaa;
- mobiili ja portrait-tablet pinoavat `.workbench-shell`-alueen yhteen
  sarakkeeseen;
- kolmen headline-arvon nykyinen `.setup-context-metrics` sijaitsee vasta
  workbench-keskustan setup-kontekstissa;
- koko Stats/Compare-tuloslista sijaitsee vielä välilehtipalkin jälkeen; ja
- `.tab-bar` käyttää pelkkää `overflow-x: auto` -vieritystä ilman nuolta,
  reunavihjettä tai More-valikkoa.

390 pikselin leveydellä alussa näkyvät vain `Stats`, dynaaminen setup-
välilehti, `Monsters` ja `Setups`. `Loot`, `Trip`, `Risk`, `Cannon`, `Planner`,
`Economy` ja `Settings` jäävät vieritysalueen oikealle puolelle.

Nykyinen `keeps every workbench tab inside a narrow mobile viewport` -testi
aktivoi jokaisen välilehden semanttisella locatorilla ja todistaa sivun leveyden.
Se ei todista näkyvää overflow-affordanssia, käyttäjän kautta tehtävää
piilossa olevan välilehden löytämistä tai aktiivisen välilehden automaattista
vieritystä näkyviin.

Useat nykyiset apumerkinnät käyttävät `0.6rem`-`0.68rem`-kokoja eli 16
pikselin juurifontilla noin 9,6-10,9 pikseliä. Containment voi siksi olla
teknisesti ehjä samalla kun teksti on puhelimessa tarpeettoman pientä.

## Tavoitetila

Nykyisillä normal-flow-mobiili- ja portrait-tablet-leveyksillä:

- kolmen headline-arvon yhteenveto seuraa välittömästi ensisijaisia
  pelaajasyötteitä;
- arvot päivittyvät samasta nykyisestä result-view-modelista ilman erillistä
  laskenta- tai formatointipolkua;
- välilehtipalkki kertoo näkyvästi, että kohteita on lisää, ja tarjoaa
  sekä suoran More-polun että vaiheittaisen vaakavierityksen;
- aktiivinen välilehti on aina kokonaan näkyvissä välilehtien viewportissa;
- `New`, `Edit`, `Remove` ja `Reset` mahtuvat yhteen kompaktiin toimintoriviin;
- käyttäjälle tarkoitettu apu-, tila- ja mittariteksti ei nojaa alle 12
  pikselin mobiilifonttiin; ja
- dokumentti ei levene, fokus ei katoa eikä nykyinen tablist-sopimus muutu.

## Responsiivinen soveltamisraja

Uusi sopimus käyttää nykyisiä normal-flow-rajoja:

- `max-width: 620px`; ja
- leveydet `621px-980px`, kun orientaatio on portrait.

D-075:n desktop-workbench ja D-082:n 621 pikselistä alkava compact-landscape-
workbench säilyttävät nykyiset kolme scroll owneria, korkeuden ja
esitysrakenteen. Yhteisiä komponentteja saa siistiä, mutta uusi mobiiliesitys
ei saa muuttaa 640 × 360 -compact-landscape-sopimusta.

## Mobiilin headline-tulos

### Sisältö ja totuuslähde

Lisää yksi semanttinen alue nimeltä `Mobile result summary`, joka näyttää
täsmälleen nykyisen `result.contextMetrics`-joukon tässä järjestyksessä:

1. `DPS`;
2. `Effective XP/hr`; ja
3. `Net GP/hr`.

Esityksen tulee käyttää nykyistä `MetricList`-komponenttia tai yhtä
komponentoitua kutsua sen päälle. Uutta metriikkalistaa,
`createWorkbenchResultViewModel()`-haaraa, numeromuotoilua tai laskentaa ei
lisätä.

Värit, negatiivisen net GP:n tone ja saavutettavat laajennetut GP/XP-nimet
periytyvät nykyisestä `MetricList`-sopimuksesta. Alue ei ole `aria-live`:
jokaisen syötemuutoksen erillinen automaatti-ilmoitus olisi meluisa, ja
käyttäjä voi lukea päivittyneet arvot samasta pysyvästä kohdasta.

### Sijoittelu

Mobiiliyhteenveto renderöidään DOMissa ensisijaisen `Player setup` -osion
jälkeen ja ennen nykyistä pitkää `Active player setup` -profiilia. Se ei saa
odottaa setup-kontekstia, välilehtipalkkia tai Stats-panea.

Visuaalisen välin `Player setup` -osion alareunasta yhteenvedon yläreunaan tulee
olla enintään 16 pikseliä kaikissa kolmessa hyväksyntäviewportissa. Yhteenveto
käyttää kolmea yhtä leveää saraketta, mutta pitkä etiketti saa rivittyä;
arvo ei saa leikkautua tai pakottaa dokumenttia leveämmäksi.

Nykyinen workbench-keskustan `.setup-context-metrics` pysyy desktopin ja
compact-landscapen omistajana. Normal-flow-mobiilissa ja portrait-tabletissa se
piilotetaan, kun uusi yhteenveto on näkyvissä. Samasta metriikasta ei saa olla
kahta yhtä aikaa näkyvää tai accessibility-puussa toistuvaa esitystä.

Sticky-esitys ei ole ensimmäisen toteutuksen pakollinen done-kriteeri.
Yhteenvedon saa tehdä `position: sticky` -elementiksi vain Player-sidebarin
sisällä, jos 390 pikselin browser-mittaus osoittaa sen aidosti parantavan
syöte-tulos-silmukkaa. Se ei koskaan saa olla `fixed`, peittää fokusoitua
kenttää, setup-toimintoja tai välilehtinavigaatiota eikä jää sidebarin jälkeen
ruudulle.

## Välilehtien overflow-ohjaus

### Rakenne

Normal-flow-mobiili- ja portrait-tablet-esitys käärii nykyisen yhden
`role="tablist"`-elementin navigointikuoreen, jossa on:

- vasen painike, saavutettava nimi `Scroll workbench tabs left`;
- nykyinen vaakasuunnassa vierivä tablist;
- oikea painike, saavutettava nimi `Scroll workbench tabs right`; ja
- painike `More tabs`, joka avaa kaikki yksitoista kohdetta sisältävän valikon
  tai natiivin disclosure-listan.

Nuolipainikkeet ja More-listan rivit eivät saa `tab`-roolia. Sivulla säilyy
täsmälleen yksi workbench-`tablist`, yksi tab kutakin kohdetta kohti ja yksi
dynaaminen `tabpanel`.

Overflow-ohjaimet näytetään vain, kun tablistin `scrollWidth` ylittää sen
`clientWidth`-arvon. More-ohjain on tällöin aina näkyvä; affordanssi ei saa
riippua scrollbarin alusta-, laite- tai selainkohtaisesta ulkoasusta.

### Nuolipainikkeet

- Vasen nuoli on pois käytöstä vasemmassa rajassa ja oikea nuoli oikeassa
  rajassa.
- Painallus vierittää tablistia vaakasuunnassa vähintään yhden kokonaisen
  seuraavan tai edellisen välilehden näkyviin.
- Painallus ei aktivoi välilehteä, siirrä workbench-fokusta tai muuta
  pystysuuntaista `window.scrollY`-arvoa.
- Ohjainten tila päivittyy vierityksessä, viewportin koon muutoksessa,
  dynaamisen setup-labelin vaihtuessa ja aktiivisen välilehden vaihtuessa.
- Mahdollinen smooth scroll kunnioittaa reduced-motion-asetusta. Testien ei
  pidä perustua animaation ajoitukseen.

### More-lista

More-lista näyttää `WORKBENCH_TABS`-järjestyksen ja dynaamisen
`Melee setup`-, `Ranged setup`- tai `Magic setup` -nimen. Se ei ylläpidä omaa
listaa tai label-logiikkaa.

- Aktiivinen kohde merkitään `aria-current="page"`-tilalla tai vastaavalla
  näkyvällä ja saavutettavalla valintatilalla.
- Kohteen valinta kutsuu nykyistä `actions.activateTab()`-polkua, sulkee listan
  ja jättää fokuksen ennustettavaan kohtaan. Hyväksytty oletus on palauttaa
  fokus `More tabs` -painikkeeseen; aktiiviseen tabiin siirto on sallittu vain,
  jos sama sääntö toteutuu osoittimella ja näppäimistöllä.
- Escape sulkee avoimen ei-natiivin valikon ja palauttaa fokuksen avaimeen.
  Natiivi disclosure saa käyttää natiivia näppäimistösopimustaan.
- Lista pysyy viewportin sisällä, saa sisäisen pystyscrollin tarvittaessa eikä
  levennä dokumenttia.

### Aktiivisen tabin automaattinen näkyvyys

Jokaisen `activeTab`-muutoksen jälkeen aktiivisen tab-painikkeen koko
reunalaatikko vieritetään tablistin näkyvälle alueelle mahdollisimman pienellä
vaakasiirrolla. Sopimus koskee aktivointia:

- suoraan tab-painikkeesta;
- nykyisellä ArrowLeft/ArrowRight/Home/End-roving-käytöksellä;
- More-listasta;
- Player- ja setup-guide-pikasiirtymistä;
- tuloksen Review-linkistä; ja
- mistä tahansa muusta nykyisestä `actions.activateTab()`-kutsusta.

Automaattinen vieritys on vaakasuuntainen. Se ei saa vierittää dokumenttia
ylös tai alas, siirtää fokusta itsestään tai muuttaa roving-tabindex-sääntöä.

## Setup-toimintojen kompakti mobiiliesitys

Normal-flow-mobiilissa ja portrait-tabletissa `.setup-context-actions` käyttää
yhtä nelisarakkeista riviä nykyisessä järjestyksessä:

1. `New`;
2. `Edit`;
3. `Remove`; ja
4. `Reset`.

Nykyiset näkyvät lyhyet tekstit, `aria-label`- ja `title`-nimet, disabled-
ehdot, danger-esitys ja tapahtumakäsittelijät säilyvät. Toimintoja ei siirretä
uuteen tilaan, modaliin tai persistenssiin.

Jokaisen painikkeen tulee:

- mahtua ilman tekstin leikkausta tai päällekkäisyyttä 390 pikselin
  viewportissa;
- säilyttää vähintään 40 pikselin korkuinen kosketusalue;
- käyttää vähintään 12 pikselin tekstiä; ja
- pysyä setup-kontekstin sekä dokumentin sisällä myös 200 % browser-zoomia
  vastaavassa kapeassa CSS-layoutissa. Tarvittaessa rivi saa vaihtua kahdeksi
  kahden painikkeen riviksi vasta alle hyväksytyn 390 pikselin testileveyden;
  390/620/portrait-tablet-matriisissa vaatimus on yksi rivi.

Resetin nykyinen review/confirm/Undo-polku ja Removen nykyinen Undo-polku eivät
muutu tässä työssä.

## Mobiilitypografian sopimus

Kolmessa hyväksyntäviewportissa workbenchin käyttäjälle näkyvän
informatiivisen tekstin laskettu minimikoko on 12 CSS-pikseliä. Rajaan kuuluvat:

- field-labelit, helper- ja detail-tekstit;
- status pill -tekstit;
- metric-labelit;
- setup-guide- ja player-profile-aputekstit;
- välilehdet, overflow-ohjaimet ja setup-toiminnot; sekä
- aktiivisen paneelin selittävät `small`-, `span`-, `dt`, `em`- ja vastaavat
  tekstit.

Headline-metriikan arvon laskettu minimikoko on 14 CSS-pikseliä. Lomakkeen
syötteet, selectit ja painikkeet eivät saa pienentyä alle 12 pikselin.

Poikkeuksia ovat vain:

- screen-reader-only- tai muuten visuaalisesti piilotettu teksti;
- SVG:n asteikko- ja datapiste-etiketit, jos sama tieto on heti samassa
  komponentissa saavutettavana vähintään 12 pikselin tekstinä tai taulukkona;
- puhtaasti dekoratiiviset merkit ilman itsenäistä merkitystä.

Poikkeuksia ei saa tehdä luokkanimen perusteella yleisesti. Selainkoe mittaa
näkyviä tekstisolmuja, ja mahdollinen poikkeuslista pidetään pienena,
nimettynä ja perusteltuna testissä.

Desktopin nykyisiä tiheitä tekstikokoja ei muuteta tämän tavoitteen vuoksi.
Mobiilifonttien kasvun aiheuttama sallittu rivittyminen ratkaistaan komponentin
sisäisellä layoutilla, ei palauttamalla tekstiä alle minimin tai leikkaamalla
sitä ellipsillä.

## Saavutettavuus- ja fokusraja

- Nykyinen yksi roving-tablist ja dynaamisesti nimetty tabpanel säilyvät.
- ArrowLeft/ArrowRight/Home/End aktivoivat edelleen välilehden D-070:n
  mukaisesti, ja vain aktiivinen tab on normaalissa Tab-järjestyksessä.
- Overflow-nuolet ja `More tabs` ovat erillisiä peräkkäisiä fokusstoppeja,
  joilla on näkyvä `:focus-visible`-reunus.
- Välilehtien visuaalinen vieritys ei muuta `aria-selected`-, `aria-controls`-,
  id- tai labelledby-suhteita.
- Uusi mobiiliyhteenveto ei luo assertive live regionia eikä lue samoja arvoja
  kahdesti.
- `Skip to active workbench pane` säilyy ensimmäisenä fokusstoppina ja kohdistaa
  edelleen nykyiseen aktiiviseen paneeliin.
- Touch-, hiiri- ja ohjelmalliset nykyiset aktivointipolut säilyvät.

Tämä on rajattu mobiilikäytettävyys- ja näppäimistöregressioiden sulku, ei
WCAG-vaatimustenmukaisuusväite tai ulkoinen assistive-technology-sertifiointi.

## Omistus- ja toteutusraja

Odotettu tuotantomuutos rajautuu seuraaviin omistajiin:

- `src/app/components/shell/workbench-shell.tsx`: mobiiliyhteenveto,
  navigointikuori, overflow-ohjaimet ja aktiivisen tabin vaakavieritys;
- mahdollinen pieni `src/app/components/shell/workbench-tab-navigation.tsx`, jos
  refit, mittaus ja tapahtumakäsittely tekevät shell-komponentista muuten
  vaikeasti testattavan;
- `src/app/styles.css`: nykyisiin breakpointteihin rajattu sijoittelu,
  toimintorivi ja mobiilitypografia;
- `src/tests/app-shell-components.test.tsx`: semanttinen rakenne, yksi tablist,
  sama metriikkasisältö ja toimintonimet;
- fokusoitu DOM-yksikkötesti mahdolliselle scroll-state-helperille; ja
- funktionaalinen sekä visual Playwright -evidenssi.

`src/app/view-models/app-shell.ts` omistaa edelleen
`WORKBENCH_TABS`-järjestyksen, dynaamisen labelin, roving-näppäinlogiikan ja
`contextMetrics`-arvot. Sen julkista mallia ei pidä muuttaa, ellei
toteutusevidenssi osoita nykyisen datan aidosti riittämättömäksi. Uutta
App-statea, controlleria tai persisted UI preferenceä ei lisätä.

## Funktionaalinen Playwright-matriisi

Lisää yksi fokusoitu mobiilin workbench-loop-testi tai jaettu parametrisoitu
testiryhmä näille CSS-viewporteille:

| Nimi            | Leveys | Korkeus | Sopimus                                 |
| --------------- | -----: | ------: | --------------------------------------- |
| mobile          |    390 |     844 | kapein hyväksytty puhelinpolku          |
| wide mobile     |    620 |     844 | normal-flow-breakpointin tarkka yläraja |
| portrait tablet |    768 |    1024 | nykyinen portrait-tablet-polku          |

Jokaisessa viewportissa selainkoe todistaa vähintään:

1. dokumentin `scrollWidth <= clientWidth` ja `window.scrollX === 0`;
2. `Mobile result summary` seuraa `Player setup` -osiota enintään 16
   pikselin visuaalisella välillä;
3. yhteenveto sisältää samat kolme label/value/tone-arvoa kuin nykyinen
   `contextMetrics`-fixture ja setup-kontekstin duplikaatti ei ole näkyvissä;
4. pelaajatason tai combat stylen muutos päivittää vähintään yhden näkyvän
   headline-arvon ilman välilehden vaihtoa;
5. overflow-ohjaimet ovat näkyvät, vasen nuoli alkaa disabled-tilassa ja
   oikea nuoli on käytettävissä;
6. oikea nuoli tuo aiemmin piilossa olleen tabin kokonaan näkyviin muuttamatta
   aktiivista tabia tai pystyscrollia;
7. `More tabs` näyttää kaikki yksitoista dynaamisesti nimettyä kohdetta;
8. `Settings`-valinta More-listasta aktivoi Settings-paneelin, sulkee listan ja
   jättää aktiivisen Settings-tabin kokonaan tab-viewportin sisälle;
9. ArrowLeft/ArrowRight/Home/End-roving toimii edelleen ja jokainen syntyvä
   aktiivinen tab vierittyy kokonaan näkyviin;
10. setup-toimintojen neljä painiketta ovat samalla rivillä, setup-kontekstin
    sisällä, vähintään 40 pikseliä korkeita ja leikkaamattomia; ja
11. nimetty mobiilitekstin auditointi ei löydä alle 12 pikselin
    informatiivista tekstiä tai alle 14 pikselin headline-arvoa.

Nykyinen 390 pikselin kaikkien paneelien containment-loop jää regressioksi.
Uusi testi käyttää todellisia overflow-ohjaimia; se ei saa aktivoida piilossa
olevia tabeja vain Playwright-locatorin automaattisella scrollilla.

Lisäksi nykyinen 1280 × 720 desktop-, 640 × 360 compact-landscape- ja D-070
keyboard-testi ajetaan regressioina. Desktopissa mobiiliyhteenveto ja
overflow-ohjaimet eivät saa olla näkyvissä.

## Visual-regressiomatriisi

Lisää deterministiseen visual-projektiin jokaiselle 390 × 844-, 620 × 844-
ja 768 × 1024 -viewportille kaksi rajattua kuvaa:

1. `mobile-result-loop-*`: Player setup -osion loppu, uusi headline-yhteenveto
   ja Active setup -osion alku; sekä
2. `mobile-navigation-loop-*`: setup-kontekstin kompakti toimintorivi,
   overflow-nuolet, tablist ja avoin `More tabs` -lista fixture-datalla.

Kuvien tulee käyttää visual-suiten nykyistä kiinteää aikaa, fixture-tilaa,
fonttivalmiutta ja integration-mockeja. Ennen screenshotia testi varmistaa
semanttisesti oikean headline-arvon, kaikkien neljän setup-toiminnon sekä
More-listan ensimmäisen ja viimeisen kohteen.

Nykyinen `root-shell-mobile`-baseline muuttuu todennäköisesti sijoittelun ja
mobiilifonttien vuoksi. Sen diff tarkastetaan, mutta tämä speksi ei oikeuta
desktop-, pane-, data- tai laskentabaselinejen muutoksia.

Visual-baselineja ei kirjoiteta funktionaalisen testin tai epäonnistumisen
automaattisena korjauksena. Kaikki muuttuvat ja kuusi uutta kuvaa tarkastetaan
actual/expected/diff-kuvina ennen rajattua
`npm run test:e2e:visual:update` -ajoa, minkä jälkeen kaksi peräkkäistä read-only-
vertailua todistavat determinismin.

## Rajaukset

- Ei combat-, XP-, loot-, trip-, risk-, planner- tai economy-kaavan muutosta.
- Ei `FullSimulationResult`-, `SimulationRequest`-, Worker- tai view-modelin
  numeerisen semantiikan muutosta.
- Ei setup-, custom-setup-, Duel-, Planner-, PriceSet- tai muun localStorage-
  skeeman tai kirjoituspolun muutosta.
- Ei workbench-välilehtien lisäystä, poistamista, uudelleenjärjestystä tai
  dynaamisen setup-nimen muuttamista.
- Ei Removen, Resetin, reviewn, confirmin tai Undon transaktiomuutosta.
- Ei desktopin tiheysuudistusta, compact-landscape-workflow'n muutosta tai
  yleiskäyttöistä design-token-järjestelmää.
- Ei swipe-elettä, karusellia, bottom navigationia, routeja tai uutta
  mobiilisovelluskuorta.
- Ei WCAG-sertifiointia, ulkoista saavutettavuusauditointia tai globaalia
  typografiauudistusta.
- Ei data-, API-, provider-, auth-, tietokanta-, deploy- tai hosting-muutosta.

## Toteutusjärjestys

1. Lisää shellin staattinen semantiikka: mobiiliyhteenveto, yksi tablist-kuori
   ja overflow-ohjaimet ilman App- tai view-model-muutosta.
2. Lisää aktiivisen tabin vaakavieritys sekä nuolten overflow-/boundary-tila ja
   peitä ne desktopissa.
3. Toteuta nykyisiin breakpointteihin rajattu tulossijoittelu, nelisarakkeinen
   setup-toimintorivi ja mobiilitekstin minimikoot.
4. Lisää komponentti- ja 390/620/portrait-tablet-funktionaaliset testit sekä
   aja desktop/compact-landscape/keyboard-regressiot.
5. Generoi kuuden rajatun visual-kuvan kandidaatit, tarkasta diff ja päivitä
   vain hyväksytyt mobiiliomistajan baselinet.
6. Päivitä tämä speksi toteutetuksi sekä feature-inventoryn, arkkitehtuurin,
   testing-oppaan, backlog-kortin ja päivätyn testing-evidenssin nykytila.

## Hyväksymiskriteerit

Toteutus on valmis vasta kun:

- mobiilin headline-yhteenveto seuraa suoraan Player setup -syötteitä ja
  päivittyy samasta `result.contextMetrics`-totuudesta;
- yhtä aikaa näkyvissä ja accessibility-puussa on vain yksi kolmen arvon
  mobiiliyhteenveto;
- jokaisessa 390/620/768 portrait -viewportissa käyttäjä voi löytää ja
  aktivoida kaikki yksitoista välilehteä näkyvillä ohjaimilla;
- aktiivinen tab on jokaisen aktivointipolun jälkeen kokonaan näkyvissä ilman
  pystysuuntaista hyppyä;
- D-070:n roving-tablist-, fokus- ja skip-link-sopimus läpäisee regressiot;
- New/Edit/Remove/Reset muodostavat yhden leikkaamattoman ja kosketettavan
  toimintorivin hyväksytyissä viewporteissa;
- nimetty mobiilitypografia läpäisee 12/14 pikselin minimirajat;
- dokumentin vaakasuuntaista overflow'ta ei synny yhdessäkään nykyisessä
  workbench-paneessa;
- 1280 × 720 desktop ja 640 × 360 compact landscape säilyttävät nykyisen
  viewport-/scroll-owner-sopimuksen;
- visual-diffit on tarkastettu ja vain mobiiliomistajan kuvat on hyväksytty; ja
- alla luetellut tarkistukset läpäisevät ilman laskenta-, golden-, data- tai
  desktop-baselinejen muutosta.

## Vaadittu validaatio

Toteutuksen fokusoitu portti:

```sh
npm run typecheck
npm run test -- src/tests/app-shell-components.test.tsx src/tests/app-shell-view-model.test.ts
npm run test:e2e -- --workers=1 --grep "mobile result and navigation loop|bounded keyboard navigation|desktop workbench|compact landscape|every workbench tab"
npm run test:e2e:visual
npm run test
npm run build
npm run lint
npm run format:check
git diff --check
```

Visual-update ajetaan vain hyväksytyn kandidaatintarkastuksen jälkeen. Sen
jälkeen `npm run test:e2e:visual` ajetaan kahdesti read-only-tilassa.

Lopullinen handoff-portti on:

```sh
npm run verify
npm run test:e2e -- --workers=1
npm run test:e2e:visual
git diff --check
```

## Toteutusevidenssi 2026-07-20

- `WorkbenchShell` renderöi nyt yhden `Mobile result summary` -alueen suoraan
  `Player setup` -osion jälkeen ja ennen `Active player setup` -osiota.
  `MetricList` saa muuttamattoman `result.contextMetrics`-joukon; keskustan
  duplikaatti on normal-flow-mobiilissa ja portrait-tabletissa piilossa.
- `WorkbenchTabNavigation` omistaa yhden nykyisen roving-tablistin ympärillä
  todelliseen overflow'hun sidotut rajanuolet, natiivin `More tabs` -listan,
  dynaamiset setup-labelit ja aktiivisen tabin minimaalisen vaakavierityksen.
  More-lista kutsuu vain nykyistä `actions.activateTab()`-polkua.
- 390 × 844 -after-mittauksessa yhteenveto alkoi 1 038,4 pikselissä eli 13,6
  pikseliä `Player setup` -osion jälkeen. Dokumentin leveys oli 390/390,
  `scrollX` nolla, toimintopainikkeet 40 pikseliä korkeita samalla rivillä ja
  setup-kontekstin duplikaatin laskettu `display` oli `none`. Stickyä ei otettu
  käyttöön, koska normaali sijoitus sulki yli tuhannen pikselin lähtövälin
  ilman peitto- tai fokusriskiä.
- Parametrisoitu Chromium-koe läpäisee 390 × 844-, 620 × 844- ja 768 × 1024
  -viewportit. Se todistaa 12/14 pikselin typografiarajat, lähtörajan disabled-
  tilan, yhden kokonaisen seuraavan tabin vierityksen, More/Settings-polun,
  Home/End/nuolet, neljän toiminnon rivin ja vaakasuuntaisen containmentin.
- Visual-projektissa on kuusi uutta rajattua baselinea: kolme
  `mobile-result-loop-*`- ja kolme `mobile-navigation-loop-*`-kuvaa. Nykyiset
  mobiili-/portrait-kuvat päivitettiin vain tarkastetun, tähän breakpoint- ja
  typografiamuutokseen kuuluvan diffin perusteella; desktop ja 640 × 360
  compact landscape säilyivät muuttumattomina.
- Laskentaa, `SimulationRequest`- tai view-model-sopimusta, persisted statea,
  tab-järjestystä, setup-transaktioita tai desktop/compact-landscape-rakennetta
  ei muutettu.

## Nykyinen browser-context-laajennus 2026-07-21

PF-06 säilyttää tämän rakenteen ja tekee More-valinnan samaksi typed user-
aktivoinniksi kuin näkyvän tabin ja roving-näppäimistön. Paneen vaihto lisää
yhden `pane=<id>`-history-entryn, sama pane ei lisää entryä ja Back/Forward
käyttää nykyistä aktiivisen tabin minimaalista vaakapaljastusta ilman document-
scrollausta. Nimetty 390 x 844 Chromium-flow todistaa More → Trip -valinnan,
URL/pane/title-yhtäpitävyyden ja containmentin; CB-09 todistaa history/reload-
käytöksen Firefoxissa sekä desktop/mobile WebKitissä.

## Avoimet kysymykset

- Sticky-yhteenvetoa ei tarvita nykyisessä hyväksytyssä 390/620/768-matriisissa;
  päätös voidaan avata uudelleen vain uuden mitatun peitto- tai löydettävyysongelman
  perusteella.
- Onko 390 pikseliä tuotteen pysyvä kapein tuettu CSS-viewport vai pitääkö
  myöhemmin hyväksyä erillinen 320/360 pikselin sopimus? Tämä speksi ei
  laajenna nykyistä release-matriisia alle 390 pikselin.
