# Arkkitehtuuriaudit: 2004scape Combat Simulator

Päiväys: 2026-07-13

Repo: `/Users/pessi/index-sim`

Tarkastettu HEAD auditin alussa: `9935cbf1804508b046bdfef66aefac3261efeafb`

Nykyarkkitehtuurin omistava dokumentti:
[docs/technical/architecture.md](docs/technical/architecture.md)

Tämä tiedosto on monikierroksisen auditin evidenssisnapshot, ei kilpaileva elävä
arkkitehtuurin totuuslähde. Audit alkoi puhtaalta `master`-työpuulta. Tässä
auditissa tehdyt muutokset ovat seurattavissa Git-diffistä, mutta niitä ei ole
commitoitu tämän goalin yhteydessä.

Toteutuksen jälkimerkintä 2026-07-13: suositus 1 toteutettiin
[Stats/Loadout-speksin](docs/technical/stats-loadout-pane-refactor-spec.md)
mukaisesti. Snapshotin alla olevat 7 725/4 978 rivin luvut ja suositusjärjestys
kuvaavat auditointihetkeä; nykyiset omistajat, 7 273/2 583 rivin luvut ja
validointievidenssi ovat elävissä arkkitehtuuri- ja testausdokumenteissa.

## Tiivistelmä

Projektin nykyinen tuotantoarkkitehtuuri on terve laskenta-, data- ja
runtime-rajoiltaan. TypeScript-moduuligraafissa ei ole syklejä, kiellettyjä
kerrossuuntia, dokumentoituja poikkeuksia tai selittämättömiä orpomoduuleja.
Domain on puhdas Reactista, DOMista, selaintallennuksesta ja verkosta. Root-app
käyttää validoitua Revision 274 -snapshotia ja koostettua `FullSimulationResult`-
totuutta; arkistoitu legacy-runtime ei ole client-entrypointista saavutettava.

Audit ei löytänyt P0-tasoista tietoturva-, data- tai laskentaongelmaa. Suurin
jäljellä oleva arkkitehtuuririski on UI-kerroksen vastuiden keskittyminen:
`App.tsx` on siivouksen jälkeenkin 7 725 riviä ja
`src/app/view-models/simulation.ts` 4 978 riviä. Ne eivät kahdenna domain-
laskentaa, mutta useiden feature-perheiden yhteinen muutos- ja review-pinta on
liian suuri.

Audit toteutti kolme käyttäytymisen säilyttävää siivousta:

- arkkitehtuuritarkistus hylkää nyt myös selittämättömät orvot lähdemoduulit ja
  vanhentuneet ulkoisten entrypointien luokitukset;
- laaja `src/data/index.ts`-barrel poistettiin ja legacy-/testikuluttajat tuovat
  omistavat moduulit suoraan; ja
- MonsterCard-rail irrotettiin `App.tsx`:stä omaksi puhtaaksi, kohdistetusti
  testatuksi komponentiksi. Copy, propsit, CSS-luokat ja laskenta säilyivät.

## Priorisoitu löydöslista

| Prioriteetti | Tila | Löydös | Suositeltu käsittely |
| --- | --- | --- | --- |
| P0 | Ei löydöstä | Ei osoitettua kriittistä arkkitehtuuri-, turvallisuus- tai datavirhettä | Säilytä nykyiset portit |
| P1 | Avoin | `App.tsx` koordinoi yhä lähes kaikkia workbench-featureita ja 20 React-state-solua | Jatka D-093-spekkiä yksi feature-perhe kerrallaan |
| P1 | Avoin | 4 978-rivinen simulation-view-model yhdistää main/Stats-, compare/duel-, Planner-, loot-, optimizer- ja option-presentaatiot | Pilko kuluttajaperheittäin ilman uutta laskentatotuutta |
| P2 | Avoin | `src/domain/trip/index.ts` on 3 097-rivinen loot/incoming/trip/supply-kokonaisuus | Sisäinen jako, nykyinen `src/domain/trip` export-pinta ja numerot ennallaan |
| P2 | Avoin | `scripts/game-data-generator-core.ts` on 3 170-rivinen parseri-, impact- ja writer-omistaja | Jaa lähdeparseen, impact-evidenssiin ja output-kirjoitukseen |
| P2 | Mitattava | Jokainen raskas taski luo uuden Workerin ja kloonaa täyden noin 1,07 MB game-dataa sisältävän `SimulationContext`in | Mittaa startup/clone ennen persistent-worker-spekkiä |
| P2 | Avoin | Testi- ja dokumenttievidenssi on keskittynyt 5 021-, 3 680- ja 1 524-rivisiin omistajiin | Pilko feature-/päivättyihin osiin seuraavien muutosten yhteydessä |
| P3 | Avoin | Hiscores- ja market-coret kahdentavat pienen timeout/error/rate-limit-rungon | Yhteistä vain molempien handler-testien suojaamana |
| P3 | Avoin | Erityisesti simulation-view-model exporttaa runsaasti vain tiedoston sisällä käytettyjä sisätyyppejä | Kavenna export-pintaa feature-jaon yhteydessä |
| Hyväksytty raja | Ei aktiivista työtä | Legacy/static-runtime sekä root `.js/.jsx` -lähteet ovat clientin ulkopuolista regression/reference/rollback-evidenssiä | Poista vain uuden D-060:n korvaavan päätöksen jälkeen |
| Operatiivinen raja | Ulkoinen evidenssi | Cloudflare preview/production -smoke ja ensimmäinen konfiguroitu scheduled market -ajo eivät ole pääteltävissä checkoutista | Adopterin runbook, ei repo-refaktorointi |

## Tarkastuksen laajuus ja kierrokset

Audit tehtiin neljän erillisen tarkastelukierroksen kautta. Jokaisen kierroksen
havainnot ristiintarkistettiin seuraavalla kierroksella ennen muutoksia.

### Kierros 1: topologia, entrypointit ja riippuvuussuunnat

Tarkastettu:

- `index.html`, `src/app/main.tsx`, Web Worker -entry, Vite-config ja
  Cloudflare Worker/Wrangler -entry;
- kaikki ei-testilliset `src/**/*.ts` ja `src/**/*.tsx` TypeScript-resolverilla;
- kerrossuunnat `app`, `adapters`, `data`, `domain`, `server`;
- cycle-, client-reachability-, inbound- ja kerrosedge-tiedot; sekä
- barrel-exportit ja lähdekoodin ulkopuolelta käynnistyvät moduulit.

Lopullinen graafi:

- 81 lähdemoduulia;
- 297 `src`-moduulien välistä edgeä;
- 69 client-entrypointista saavutettavaa moduulia;
- ei importtisyklejä;
- ei kiellettyjä kerrossuuntia;
- ei dokumentoituja poikkeuksia; ja
- seitsemän eksplisiittistä ulkoista entrypointia:
  `main.tsx`, calculation worker, Cloudflare Worker, kaksi Vite-middlewarea sekä
  kaksi script/test/reference-adapteria.

Kaikki inbound-juuret pystyttiin todentamaan HTML-, `new Worker(new URL(...))`-,
Vite-, Wrangler- tai repository script/test -käynnistyksiksi. Auditissa ei
löytynyt poistettavaa kokonaan irrallista TypeScript-tuotantomoduulia.

### Kierros 2: omistajuudet, tila, UI, domain ja kuollut koodi

Tarkastettu:

- `App.tsx`:n importit, top-level-helperit, hookit, state/effect/memo-omistus ja
  workbench-paneelien rajat;
- `src/app/controllers`, `src/app/state`, `src/app/components` ja
  `src/app/view-models/simulation.ts`;
- `src/domain/combat`, `equipment`, `simulation`, `trip`, `risk`, `planner` ja
  `economy`;
- selainglobaalien, storage-, fetch- ja worker-käytön sijainti; sekä
- lähdemoduulien inbound-reachability, laajat barrelit ja käyttämättömät
  export-pinnat.

Vahvistettu:

- `src/domain` ei lue `window`, `document`, `localStorage` tai `fetch`-rajapintoja;
- app-state ei vuoda `SimulationRequest`iin ilman eksplisiittistä adapterointia;
- `FullSimulationResult` kokoaa numeerisen combat/trip/XP/economy-polun, eikä UI
  ylläpidä rinnakkaista laskentatotuutta;
- storage on versioitu ja skeemavalidoitu, ja rewrite-kohtainen legacy-mapping on
  app-kerroksessa; ja
- `noUnusedLocals`/`noUnusedParameters` suojaavat lokaaleja/importteja, mutta
  eivät kokonaisia moduleita tai tarpeettoman laajoja export-pintoja.

Korjattu:

- `src/data/index.ts` oli yleinen neljän alueen barrel, jota tuotantopuolella
  käytti vain legacy-reference-bootstrap ja muuten testit. Suorat
  `legacy-adapter`/`reliability`-tuonnit poistivat tarpeettoman rajapinnan.
- MonsterCard oli puhdas noin 100-rivinen esityskomponentti `App.tsx`:n sisällä.
  Se siirrettiin `src/app/components/panes/monster-card-panel.tsx`:ään ja sen
  DOM/copy/presentaatiosopimus lukittiin focused server-render -testillä.

Ei poistettu:

- legacy `.js/.jsx` -lähteitä, legacy/static-adaptereita tai snapshotteja, koska
  D-060 antaa niille aktiivisen golden/reference/readiness/rollback-roolin;
- sisäisiä domain-helpereitä vain rivimäärän tai vähäisen importtimäärän vuoksi;
  osa niistä on yhden koherentin moduulin sisäistä laskentaa; eikä
- näkyvästi tarpeettomia export-avainsanoja laajana mekaanisena diffina, koska
  niiden rajapinta kannattaa kaventaa samalla kun omistava moduuli pilkotaan.

### Kierros 3: data, runtime, suorituskyky, testaus, deploy ja turvallisuus

Tarkastettu:

- generated runtime -bootstrap, skeemat, price fallback/provenance ja readiness;
- raw LostCity source -parserit, source coverage/impact ja revision bump -rajat;
- numeric cross-path ja Planner legacy-parity;
- worker-requestit, timeout/cancel/terminate-polku ja bundle-artifact;
- framework-neutral API-coret, Vite-middlewaret, provider, Cloudflare Worker,
  `_headers`, Wrangler ja scheduled market -workflow;
- HTML/DOM-koodinsuoritusnielut, selainverkko, salaisuudet, localStorage ja
  käyttäjän tiedosto-/fragmenttisyötteet; sekä
- yksikkö-, golden-, functional-, visual- ja release-gate-omistus.

Dataevidenssi:

- generated runtime readiness on `ready`, blokkerit 0;
- 381/381 aktiivisella hinnalla on metadata; 245 on eksplisiittisiä generated
  fallback -rivejä;
- dynaamisten loot-hintojen 39/49 mapping-kattavuus ja 10 puuttuvaa
  species-specific unid -identiteettiä vastaavat hyväksyttyä D-087-rajaa;
- LostCity source audit ratkaisee kaikki runtime-identiteetit ja 63/63 loot-
  taulua ilman partial/unsupported-rivejä;
- NPC attack -audit on committed-dokumentin kanssa ajantasainen;
- 5 958 current-path-numeerista vertailua ovat ristiriidattomia; ja
- Planner parity raportoi 16 casea / 32 vertailua, 0 review-riviä ja 0 rewrite-gap-riviä.

`npm run data:source-impact` raportoi kaksi `needs-review`-representative casea
ja 22 informaatiotason outlieria. Tämä komento vertaa rajattua
legacy-derived-referenceä in-memory source candidateen eikä omista aktiivisen
Revision 274 -runtimen hyväksyntää. Aktiivisen runtimen committed revision-impact,
readiness ja numeric audit ovat erilliset hyväksytyt totuusrajat. Löydös ei siis
ole nykyisen root-runtimen regressio, mutta komennon tulkintaraja on pidettävä
näkyvänä dokumentaatiossa.

Turvallisuus- ja deploy-evidenssi:

- production-React ei käytä `dangerouslySetInnerHTML`, `innerHTML`, `eval` tai
  käyttäjäsyötteistä rakennettua koodinsuoritusta;
- `new Function` esiintyy vain luotettujen repo-owned legacy-lähteiden
  reference-sandboxissa ja readiness-scriptissä, ei client-entrypointissa;
- käyttäjän JSON, selaintallennus, API-vastaukset ja share-fragmentit ovat
  koko-, duplicate-key-, versio- ja skeemarajattuja;
- provider käyttää fixed HTTPS originia, redirect/timeout/size/schema-rajoja ja
  sanitisoituja virheitä;
- Cloudflare reitittää API:n ennen SPA-fallbackia, tuntematon `/api/*` ei putoa
  HTML:ään, ja CSP/security/cache-headerit ovat repo-omisteisia; ja
- ei löytynyt kovakoodattua salaisuutta, auth-, cookie-, tietokanta- tai
  server-managed user-state -pintaa.

Suorituskykyhavainto:

- entrybudjetti ja deferred generated chunk ovat jo mitattuja ja portitettuja;
- calculation worker -bundle on noin 223 kB ja jokainen run luo uuden workerin;
- request siirtää täydellisen `SimulationContext`in, jonka game-data-lähde on
  1 069 141 tavua; ja
- tästä seuraava clone/startup-kustannus on perusteltu hypoteesi, ei auditissa
  mitattu käyttäjäpolun regressio. Persistent worker ei ole turvallinen
  pikasiivous, koska se muuttaisi initialization-, request identity-, stale-
  result-, cancellation- ja error-lifecyclea.

### Kierros 4: ristiintarkistus ja dokumenttidrifti

Tarkastettu:

- `README.md`, `AGENTS.md`, docs-indeksi, architecture/testing/product/
  operations/decisions/backlog;
- aiemmat architecture/security/project/documentation-audit -snapshotit;
- nykyiset moduuli-, rivi-, testi-, browser- ja artifact-väitteet; sekä
- hyväksytyt päätösrajat verrattuna toteutukseen.

Korjattu dokumenttidrifti:

- elävä architecture-dokumentti raportoi nyt 81/69-moduuligraafin, seitsemän
  external entrypointia ja orphan-module-portin aiemman 78/65-väitteen sijaan;
- App-riski raportoi nykyisen 7 725 rivin tilan ja MonsterCard-omistajan;
- simulation-view-model-, Trip-, generator-, worker- ja testievidenssin
  keskittymät on nostettu eläviin riskirajoihin ja backlogiin;
- backlog ei enää väitä valmiin PriceSet-siirron olevan tekemättä; ja
- vanhat security/project/documentation-auditit on merkitty näkyvästi
  historiallisiksi, jotta niiden vanhoja entrypoint-, backend-, moduuli- tai
  testiväitteitä ei lueta nykytilana.

Auditissa tutkittiin myös hypoteesi Hiscores/market fixed-window limiterin
Map-järjestysvirheestä. Aikajärjestyksen invariantti osoitti, että vanhentunut
avaimen ikkuna poistetaan ennen uudelleenlisäystä ja aloitusjärjestys säilyy.
Hypoteesi hylättiin eikä siitä tehty näennäistä bugikorjausta. Kahdennettu
mekaniikka jää vain P3-yhteistämiskohteeksi.

## Vahvistetut hyvät arkkitehtuurirajat

- Root-tuotantopolku on npm/Vite/React/TypeScript, ei CDN/Babel/script-order.
- Domain on puhdas, deterministinen ja eksplisiittisen contextin varassa.
- Combat-, trip-, XP- ja economy-luvut kulkevat yhden composed-result-polun läpi.
- Data-, PriceSet-, provenance-, history-, API- ja persistence-syötteet
  validoidaan keskitetysti.
- Generated Revision 274 -snapshot on root-runtime-totuus; legacy-derived bridge
  on vain evidenssiä.
- App-, adapter-, data-, domain- ja server-suunnat ovat koneellisesti portitettuja.
- Heavy compare/planner/duel/risk-polut eivät blokkaa pääsäiettä ja ovat
  cancellable/timeout-rajattuja.
- Hiscores- ja market-handlerit ovat framework-neutral coreja adapterien alla.
- Cloudflare/static security- ja artifact-budjetit ovat repo-omisteisia.
- Unit-, golden-, numeric-, Planner parity-, source-, browser- ja visual-
  evidenssi on poikkeuksellisen laaja tämän kokoiselle staattiselle sovellukselle.

## Suositeltu toteutusjärjestys

1. Tee Stats/Loadout-perheestä seuraava D-093-vaihe: irrota paneelikomponentit ja
   niiden Stats/main-view-model-aliperhe yhdessä käyttäytymisen säilyttävässä
   speksissä.
2. Jatka Compare/Duel- ja Loot/Trip/Risk-perheisiin. Pidä worker request/result
   ja `FullSimulationResult` vakaina jokaisessa vaiheessa.
3. Erota Planner ja Economy/Settings viimeisinä, koska ne kytkeytyvät laajoihin
   persistence/history/import-export-poluihin.
4. Mittaa calculation-workerin initialization/clone/task-aika vähintään cold/
   warm- ja per-task-erottelulla ennen persistent-worker-päätöstä.
5. Pilko Trip-domain ja generator-core vasta omissa numero-/artifact-stabiileissa
   refaktorigoaleissaan.
6. Pilko suuret testi- ja historialliset evidenssitiedostot opportunistisesti
   feature-muutosten mukana, ei omana laajana testien uudelleenkirjoituksena.

## Validointi

Auditin luku- ja kohdistetut tarkistukset:

- `npm run architecture:check`: 81 moduulia, 69 client-reachable, seitsemän
  external entrypointia, ei syklejä tai poikkeuksia;
- `npm run typecheck`: läpi;
- MonsterCard/data/legacy/trip/XP/Planner/generated-runtime focused gate:
  112/112 testiä läpi;
- `npm run runtime:readiness -- --example-limit 5`: `ready`, 0 blokkereita;
- `npm run numeric:audit`: 5 958 vertailua, 0 ristiriitaa;
- `npm run planner:parity`: 19 testiä sekä 16/32 raportti, 0 review/gap;
- `npm run data:source-audit`: kaikki runtime-identiteetit ratkaistu, 63/63 loot;
- `npm run npc:attack-audit`: committed raportti current;
- `npm run data:source-impact`: read-only tulkintaraja tarkastettu;
- viiden committed JSON-artifactin parse: läpi;
- staattiset DOM/code-execution/selainglobaali/salaisuushakukierrokset: ei uutta
  production-blockeria; ja
- `npm run verify`: 47 testitiedostoa / 695 testiä, 19 erillistä goldenia,
  typecheck, architecture, build/artifact, lint, format ja diff läpi;
- artifact: 10 tiedostoa, kolme JavaScript-chunkia, entry 698 311 raw / 201 062
  gzip, total 1 953 919 tavua, SHA-256
  `ca7eb0163c53462758a7c4b2f5b1d5d94c03484305103ddc9875c39ce254a188`;
- `npm run test:e2e -- --workers=1`: 77/77 functional Chromium -testiä läpi;
- `npm run test:e2e:visual -- --workers=1`: 20/20 testiä ja 31/31 hyväksyttyä
  Darwin-baselinea muuttumattomina. Ensimmäinen sandbox-yritys pysähtyi
  `listen EPERM 127.0.0.1:5174` -rajaan; hyväksytty localhost-uusinta meni läpi;
- `npm audit --audit-level=high`: 0 haavoittuvuutta; ja
- `git diff --check`: läpi ennen lopullista repository-porttia.

## Avoimet kysymykset

- Millä feature-perheellä D-093 jatkuu? Audit suosittelee Stats/Loadoutia, koska
  se mahdollistaa myös simulation-view-modelin ensimmäisen luonnollisen jaon.
- Onko yhden taskin worker-transfer/startup käyttäjän laitteilla merkittävä?
  Lähdekoko yksin ei ratkaise tätä.
- Milloin repository-local functional/visual gate halutaan kanoniseen remote
  merge -ympäristöön? Nykyinen päätös ei vaadi yleistä CI-workflowta.
- Kuka kerää ensimmäisen Cloudflare preview/production -smoken ja ensimmäisen
  konfiguroidun scheduled-market-ajon evidenssin ennen julkisia live/current-
  väitteitä?
- Milloin legacy/reference-runtime voidaan poistaa? D-060:n korvaava päätös ja
  legacyä ajavien golden/readiness-polkujen app-owned korvaajat puuttuvat vielä.
