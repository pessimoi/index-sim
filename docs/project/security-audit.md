# Tietoturva-auditointi 2026-07-14

Tämä raportti kuvaa repositoryn nykyisen Vite/React- ja Cloudflare Worker
-tuotantopolun lähdekoodiin perustuvan auditoinnin. Se ei ole ulkoisen
tuotantoympäristön penetraatiotesti eikä todistus Cloudflare-tilin asetuksista.
Historiallinen legacy-painotteinen snapshot säilyy tiedostossa
[`SECURITY_AUDIT.md`](../../SECURITY_AUDIT.md).

## Yhteenveto

- Kriittisiä tai korkean vakavuuden löydöksiä ei löytynyt.
- Nykyinen `npm audit` raportoi 0 tunnettua haavoittuvuutta 296 riippuvuuden
  kokonaisuudessa. Tämä tarkistus ei yksin todista toimitusketjun turvallisuutta.
- Tuotantopolusta ei löytynyt kovakoodattuja yleisten palveluiden avain- tai
  private-key-muotoja, raakaa HTML-injektiota tai käyttäjäsyötteeseen kytkettyä
  ajonaikaista koodinsuoritusta.
- Selain-, tiedosto-, localStorage-, API- ja upstream-rajat ovat pääosin
  kokorajoitettuja, skeemavalidoituja ja virheensä sanitisoivia.
- Auditissa kovennettiin ainoaa kirjoittavaa GitHub Actions -workflow'ta.

## Löydökset

| Tunnus      | Vakavuus    | Tila                | Löydös ja vaikutus                                                                                                                                                                                                                                                                                                                                          | Toimenpide                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-2026-01 | Keskitaso   | Avoin tuotantoriski | `src/server/hiscores-core.ts` käyttää prosessi-/Worker-isolaattikohtaista kiinteän ikkunan muistirajoitinta. Se rajaa yhden isolaattitilan ja Cloudflaren välittämän asiakasosoitteen liikennettä, mutta ei muodosta hajautettua globaalia rajaa. Julkisessa hyökkäysliikenteessä useat isolaatit tai osoitteet voivat kasvattaa upstream-kyselyjen määrää. | Nykyinen timeout, 128 KB vastausraja, kiinteä upstream-origin ja 10 000 avaimen muistikatto säilyvät. Ennen kuin julkiselle instanssille luvataan väärinkäytön kestävä palvelutaso, operaattorin on päätettävä tarvitaanko Cloudflaren rate-limiting/WAF-sääntöä tai muuta globaalia rajaa. KV:tä, Durable Objectia tai muuta stateful-palvelua ei lisätä ilman uutta päätöstä. |
| SEC-2026-02 | Keskitaso   | Korjattu            | `.github/workflows/update-market-prices.yml` käytti siirrettäviä `actions/*@v4`-tageja ja checkoutin oletusarvoisesti pysyvää kirjoitustunnistetta myös riippuvuuksien asennus- ja validointivaiheissa. Toimitusketjun kompromissi olisi voinut hyödyntää repositoryn `contents: write` -oikeutta.                                                          | `actions/checkout` ja `actions/setup-node` pinnattiin tarkkoihin commit-SHA:hin. Checkout ei enää tallenna tunnistetta git-konfiguraatioon, ja `GITHUB_TOKEN` annetaan vain viimeiselle commit/push-vaiheelle. `src/tests/workflow-security.test.ts` estää tagi- ja tunnisterajauksen tahattoman regression.                                                                    |
| SEC-2026-03 | Matala      | Avoin evidenssivaje | Repository validoi CSP:n, cache-politiikan, API-reitityksen ja lokiasetusten tavoitetilan, mutta yhtään konkreettista preview- tai tuotantoinstanssia ei ole tässä auditissa tarkistettu. Tehokkaat headerit, Cloudflare-tilin lokit ja rollback ovat siten adopter-evidenssiä, eivät varmennettu tuotantofakta.                                            | Säilytä `docs/operations/public-deployment-spec.md`-checklist ennen live-väitteitä. HSTS ja `frame-ancestors` pysyvät avoimina hosting- ja embedding-päätöksinä.                                                                                                                                                                                                                |
| SEC-2026-04 | Informaatio | Hyväksytty rajaus   | `legacy/index.html` lataa SRI-pinnatut CDN-kehitysversiot ja Babel Standalonen, ja kaksi reference/regeneration-polun tiedostoa suorittaa repositoryn omia legacy-lähteitä `new Function`illa. Nämä polut eivät kuulu rakennettuun tuotantoartifaktiin eivätkä ota käyttäjän koodia syötteeksi.                                                             | Säilytä archive-only-rajaus D-044/D-060:n mukaisesti. Uusi legacy-polun tuotantokäyttö vaatii erillisen päätöksen ja uuden auditoinnin.                                                                                                                                                                                                                                         |

## Varmennetut suojaukset

- Selain hakee Hiscores- ja market-rajat vain same-origin-osoitteista. Palvelin
  muodostaa Hiscores-upstreamin kiinteästä `https://2004.lostcity.rs`-originista,
  ja ajastettu markkinakirjoitin hyväksyy vain tarkan
  `https://markets.lostcity.rs/`-juuren.
- Upstream-haut estävät redirectit, käyttävät abort-aikakatkaisua ja lukevat
  vastaukset kokorajaan asti. Vastausrakenteet validoidaan tiukoilla skeemoilla
  ja duplicate-key-tarkistuksella.
- Setup-, Duel- ja PriceSet-tuonnit tarkistavat tiedostokoon ennen lukua,
  rajoittavat rakenteen ja pudottavat tuntemattomat avaimet. Rewrite-pysyvyys on
  versioitu, kokorajoitettu ja allowlistattu.
- React-tuotantopolku renderöi ulkoiset merkkijonot tekstinä. Staattinen haku ei
  löytänyt `dangerouslySetInnerHTML`-, `innerHTML`-, `eval`- tai vastaavaa nielua
  tuotantopolusta.
- Cloudflare Worker palauttaa API-virheet ilman provider- tai stack-yksityiskohtia,
  käyttää `Cache-Control: no-store` -politiikkaa API-vastauksille ja reitittää
  tuntemattoman `/api/*`-polun ennen SPA-fallbackia.
- Artefaktitarkistus hylkää inline-skriptit, ulkoiset index-assetit, source mapit,
  symbolilinkit, odottamattomat tiedostot, paikalliset absoluuttipolut ja yleiset
  salaisuusmuodot.

## Auditointievidenssi

Tarkastus kattoi tuotannon entrypointin, `src/app`-selainrajat, storage- ja
tuontipolut, `src/server`-handlerit ja providerin, ajastetun market writerin,
Cloudflare-konfiguraation, deploy-validaattorin, GitHub Actions -workflow'n,
riippuvuudet ja archive-only legacy-rajat.

Suoritetut tai lähdekoodista varmennetut tarkistukset:

- `npm audit --json`: 0 info/low/moderate/high/critical-haavoittuvuutta
- staattinen secret-pattern-haku: ei osumia
- DOM-/koodinsuoritushaku: vain kaksi luotettua repository-owned legacy-ajopolkua
- `npm run test -- src/tests/workflow-security.test.ts`: 3/3
- fokusoitu Worker/deploy/provider/workflow-gate: 37/37
- `npm run verify`: 65 testitiedostoa / 764 testiä, 19 erillistä goldenia,
  arkkitehtuuri, typecheck, build, artefaktitarkistus, lint, Prettier ja
  `git diff --check` läpäisty; gate ohitti oman dependency audit -vaiheensa
  network-disabled-sandbox-politiikan vuoksi, joten yllä oleva `npm audit` ajettiin
  erikseen
- tuotantoartefakti: 10 tiedostoa, 2 assettia, 1 977 623 tavua ja SHA-256
  `8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`
- tarkkojen GitHub Action -tagien commit-SHA:t varmennettiin niiden virallisista
  GitHub-repositoryista ennen pinnausta

## Avoimet kysymykset

- Tarvitseeko ensimmäinen julkinen instanssi globaalin Hiscores-rate limitin vai
  riittävätkö Cloudflaren operaattorisääntö ja nykyinen best-effort-sovellusraja?
- Saako julkista UI:ta kehystää toiselle originille, vai lukitaanko CSP myöhemmin
  `frame-ancestors 'none'` -politiikkaan?
- Millä domainilla HTTPS/HSTS ja rollback voidaan todentaa ennen HSTS:n lisäämistä?
- Ovatko Workers Logs, Logpush, Tail Workers ja ulkoiset drainit varmasti pois
  käytöstä valitulla Cloudflare-tilillä, kun ensimmäinen live-evidenssi kerätään?
- Tarvitaanko kirjoittavan market-workflow'n validointi ja push eri jobeihin tai
  runnereihin vielä vahvempaa toimitusketjueristystä varten?
