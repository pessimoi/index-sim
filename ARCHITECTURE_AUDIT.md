# Arkkitehtuuriaudit: 2004scape Combat Simulator

Päiväys: 2026-07-13

Repo: `/Users/pessi/index-sim`

Tarkastettu HEAD auditin alussa: `19c9557`

Nykyarkkitehtuurin omistava dokumentti: [docs/technical/architecture.md](docs/technical/architecture.md)

Tämä tiedosto on auditointinäyttö, ei elävä arkkitehtuurin totuuslähde. Audit
aloitettiin valmiiksi laajasti muokatusta työpuusta. Olemassa olevat muutokset
suojattiin eikä tätä tulosta pidä tulkita kaikkien työpuun diffien tekijyydeksi.

## Yhteenveto

Projektin aiemman auditin vakavimmat ongelmat on korjattu: tuotantopolku on
Vite/React/TypeScript-sovellus, domain-laskenta saa eksplisiittisen
`SimulationContext`-kontekstin, generoitu Revision 274 -snapshot on runtime-totuus,
persistointi on versioitu, live-integraatiot on rajattu ja testaus-/julkaisuportti
on kattava.

Nykyarkkitehtuuri on laskennan ja datan osalta selvästi kerrostettu. Audit ei
löytänyt lähdemoduulien importtisyklejä eikä domainista ylempiin kerroksiin
suuntautuvia riippuvuuksia. Suurin jäljellä oleva riski on UI:n keskittyminen.
Goal 2:n ensimmäinen vaihe siirsi 1 322 riviä puhtaita kontrolleja ja esittäjiä
`src/app/components`-alueelle, mutta 8 856-rivinen `src/app/App.tsx` omistaa vielä
selaintallennuksen, import/export-virrat ja feature-paneelien orkestroinnin.
Auditissa havaittu legacy-migraatioadapterin viiden app-state-riippuvuuden velka
suljettiin Goal 1 -jatkossa D-092:n mukaisesti.

Auditin yhteydessä korjattiin tuotantorajan epäselvyys, lisättiin koneellinen
arkkitehtuurigraafin tarkistus ja otettiin käyttöön TypeScriptin kuolleen koodin
portit. Arkistoitua legacy-koodia ei poistettu, koska D-060 säilyttää sen
testi-, regressio-, lähdevertailu- ja rollback-näyttönä.

## Tarkastuksen laajuus

Tarkastus kattoi:

- tuotantoentrypointit, Vite- ja Cloudflare-polut
- `src/app`, state-moduulit, view modelit ja worker-rajan
- `src/domain`-moduulit ja koostetun simulaatiotuloksen omistajuuden
- `src/data`, generoitu snapshot, skeemat ja markkinahintojen omistajuuden
- selain-, storage-, generated-, market-, hiscores-, legacy- ja static-adapterit
- server-coret, Vite-middlewaret ja Cloudflare Worker -adapterin
- generaattori-, auditointi-, deploy- ja market writer -skriptit
- yksikkö-, golden-, suorituskyky- ja selaintestausstrategian
- arkistoidun legacy-runtimen säilytysperusteen
- dokumentaation totuusjärjestyksen ja nykyiset päätösrajat

Todisteina käytettiin koodia, committed dataa, omistavia dokumentteja,
TypeScript-resolverilla rakennettua moduuligraafia, staattisia hakuja sekä
projektin omia validointikomentoja.

## Löydökset ja toimenpiteet

### Korjattu: production browser -barrel vuoti legacy-rajan

`src/adapters/browser/index.ts` re-exporttasi `loadBundledLegacyContext`-helperin
ja legacy-bootstrap-tyypin. Tuotanto-UI tuo samasta barrelista oikeita
selainhelpereitä, joten lähdekoodin staattinen graafi teki arkistoidusta
legacy-runtimesta client-entrypointin saavutettavan, vaikka bundlerin tree shaking
saattoi poistaa lopullisen koodin.

Korjaus:

- legacy-re-export ja tarpeeton compatibility-tyyppialias poistettiin
- legacyä tarvitsevat testit tuovat helperin suoraan
  `src/adapters/legacy-runtime`-rajasta
- uusi arkkitehtuuritarkistus estää `legacy-runtime`- ja `static-runtime`-polkujen
  saavuttamisen `src/app/main.tsx`:stä

### Korjattu: arkkitehtuurirajat olivat vain dokumentoituja

Uusi `npm run architecture:check` rakentaa kaikista ei-testillisistä `src/`
TypeScript-moduuleista importtigraafin ja hylkää:

- importtisyklit
- kielletyt kerrossuunnat
- client-entrypointista saavutettavan arkistoidun runtimen
- uudet dokumentoimattomat adapteri→app-poikkeukset
- vanhentuneet poikkeusmerkinnät

Goal 2:n ensimmäisen extraction-vaiheen jälkeen tulos on 68 lähdemoduulia, 55
client-entrypointista saavutettavaa moduulia, ei syklejä eikä yhtään
arkkitehtuuripoikkeusta. Tarkistus kuuluu `npm run verify` -porttiin.

### Korjattu: käyttämätön TypeScript-koodi ei ollut merge-portti

Sekä selain- että Node/skripti-tsconfig käyttävät nyt asetuksia
`noUnusedLocals` ja `noUnusedParameters`. Nykyinen koodi läpäisee portin. Tämä
estää orvoksi jäävät importit, lokaalit, tyypit ja parametrit heti typecheckissä.

### Osittain ratkaistu P1: `App.tsx` on liian suuri composition root

Auditointihetken tiedosto oli noin 10 178 riviä / 408 KiB. Goal 2:n vaihe 1
siirsi yhteiset kentät, dialogi-/status-esittäjät, combat-tuloskomponentit,
hintahistoriakaaviot ja jaetut formaattorit viiteen side-effect-free
`src/app/components`-moduuliin. `App.tsx` on nyt 8 856 riviä ja omistaa edelleen
browser-state-orkestroinnin ja workbench-paneelien renderöinnin.

Domain-totuus ei ole tässä tiedostossa, joten nykytila ei aiheuta laskennan
kahdentumista. Se kuitenkin kasvattaa regressio-, merge conflict- ja
review-riskiä. Hyväksytty
[vaiheistettu toteutusspeksi](docs/technical/app-composition-root-refactor-spec.md)
jatkaa yksi vastuu kerrallaan:

1. irrota matalan kytkennän paneeli tai browser-state-controller
2. pidä state/request/view-model-skeemat ennallaan
3. lisää tai säilytä focused unit + Playwright -näyttö
4. jätä `App` vain koostamaan featuret

Ensimmäinen toteutusvaihe ei muuttanut tilaa, copya, CSS-luokkia, laskentaa tai
persistointia. Seuraavat selain-state-controllerit ja feature-paneelit jäävät
erillisiksi goaleiksi, jotta jokaisella siirrolla on rajattu regressioevidenssi.

### Ratkaistu jatkossa: legacy migration rikkoi puhdasta adapterisuuntaa

Auditointihetkellä `src/adapters/storage/legacy-migration.ts` toi viisi skeemaa
`src/app/state/*`-alueelta. Goal 1 siirsi muuttumattoman muunnoslogiikan
`src/app/state/legacy-storage-migration.ts`-omistukseen, jätti adapteriin vain
geneerisen tallennusmekaniikan ja poisti kaikki viisi poikkeusta. D-092 ja
[toteutusspeksi](docs/technical/legacy-migration-layer-refactor-spec.md) omistavat
ratkaisun.

### Avoin P2: suuret mutta koherentit moduulit

Merkittävät keskittymät auditointihetkellä:

- `src/domain/trip/index.ts`: noin 3 097 riviä
- `scripts/game-data-generator-core.ts`: noin 3 170 riviä
- `src/domain/planner/index.ts`: noin 1 388 riviä
- `src/app/styles.css`: noin 5 256 riviä

Näistä ei löytynyt importtisyklejä tai väärää runtime-omistajuutta. Ne kannattaa
pilkkoa sisäisiin moduuleihin vasta kun muutos voidaan tehdä julkinen export-pinta
ja numerot ennallaan säilyttäen. Pelkkä rivimäärä ei ole poistoperuste.

### Ratkaistu P2: initial bundle on mitattu ja rajattu

Goal 3:n viiden cold/warm-parin baseline vahvisti, että 1 069 141 tavun generoitu
game-data oli staattisesti 1 562 480 tavun initial JavaScriptissä. D-094 siirtää
vain generated-runtime-bootstrapin olemassa olevan loading/error-rajan taakse.
Entry on nyt 683 659 tavua / 197 123 gzip ja deferred runtime -chunk 880 362
tavua / 47 939 gzip.

Samalla koneella cold FCP -mediaani parani 112 → 80 ms ja app-ready pysyi
käytännössä samana 240 → 241 ms; warm app-ready oli 167 → 168 ms. Kokonais-JS:n
cold-siirto ei pienentynyt, koska snapshot on edelleen vaadittu runtime-totuus.
Artifact-gate estää regressiot 725 000 raw / 210 000 gzip entryrajoilla. Viten
large-chunk-varoitusta ei piilotettu, eikä tulos oikeuta feature-paneelien
automaattista lazy loadingia ilman erillistä speksiä.

### Hyväksytty: legacy/reference-koodi ei ole kuollutta koodia

Staattinen production-reachability-tarkistus löysi client-graafin ulkopuolelta
`src/adapters/static-runtime/index.ts`:n. `src/app/calculation-worker.ts` näkyi
myös tavalliselle importtiskannerille irrallisena, mutta se käynnistyy Worker
URL -rajasta. Kumpikaan ei ole poistettava löydös.

Arkistoidut `.js`/`.jsx`-runtimet sekä legacy/static-adapterit ovat D-060:n
mukaisesti golden-, regressio-, lähdevertailu-, snapshot-regenerointi- ja
rollback-näyttöä. Niiden poistaminen vaatii erillisen päätöksen ja korvaavan
evidenssin; audit ei laajentanut käyttäjän pyyntöä tämän päätöksen ohitse.

## Vahvistetut hyvät rajat

- `src/domain` ei tuo app-, adapteri-, data- tai server-koodia.
- Domain-laskenta ei lue DOMia, `window`-objekteja tai `localStoragea`.
- `FullSimulationResult` kokoaa combat-, trip- ja XP/rate-totuuden yhdessä
  domain-rajassa; UI/view model ei ylläpidä rinnakkaista laskentatotuutta.
- Data- ja hintasyötteet validoidaan skeemoilla ja annetaan eksplisiittisesti.
- Client, dev/preview middleware ja Cloudflare Worker käyttävät erillisiä
  adaptereita yhteisten server-corejen ympärillä.
- Raskaat Dense/Planner/Duel/Risk-polut on rajattu cancellable Workeriin.
- Legacy-runtimen normaali tuotantobootstrap on poistettu.
- Testi-, golden-, build-, artifact-, lint-, format- ja diff-portit ovat
  repo-omisteisia ja dokumentoituja.

## Validointi

Auditin aikana ajettiin:

- `npm run architecture:check`: läpi, 68 moduulia, ei syklejä, 55 client-moduulia
- `npm run typecheck`: läpi uusilla unused-porteilla
- `npm run test`: 40 testitiedostoa / 624 testiä läpi
- `npm run build`: läpi; suuri chunk -varoitus luokiteltiin yllä
- `npm run verify`: läpi; 624 yksikkötestiä ja erilliset 19 legacy-goldenia,
  typecheck, architecture check, build, artifact, lint, format ja diff-tarkistus
- Cloudflare-artifact: 10 tiedostoa / 2 direct assetia / 3 JavaScript-chunkia /
  1 939 237 tavua, entry 683 659 raw / 197 123 gzip, SHA-256
  `1f86ddc20e24331e9f380b0b2e957a0dcb1e47d52612094d79eecbbf2c4fbbda`
- `npm audit`: 0 haavoittuvuutta
- `npm run test:e2e -- --workers=1`: 76/76 Chromium-testiä läpi
- `npm run numeric:audit`: 5 958 current-path-vertailua, 0 ristiriitaa
- `npm run planner:parity`: 16 casea / 32 vertailua, 0 review- tai rewrite-gap-riviä
- `npm run runtime:readiness -- --example-limit 5`: `ready`, ei blokkereita
- legacy `.js` -syntaksit ja committed price JSON -parsiminen: läpi
- staattiset DOM/code execution- ja secret-haut: vain dokumentoidut trusted
  legacy `new Function`- ja väärät positiiviset token/password-osumat

## Jatkotoimet

1. Jatka `App.tsx`-spekkiä yksi browser-state-controller tai feature-perhe kerrallaan ilman laskentamuutoksia.
2. Seuraa D-094-entrybudjettia; speksaa feature-paneelien lazy loading erikseen vain uuden mittausnäytön perusteella.
3. Jatka legacy/reference-tiedostojen säilyttämistä D-060:n mukaisesti, kunnes
   erillinen poistopäätös ja korvaava näyttö ovat olemassa.
