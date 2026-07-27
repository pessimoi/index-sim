# Tietoturva-auditointi 2026-07-14

- Status: historical
- Date: 2026-07-14
- Owner: project documentation
- Evidence: verified

Tämä raportti kuvaa repositoryn nykyisen Vite/React- ja Cloudflare Worker
-tuotantopolun lähdekoodiin perustuvan auditoinnin. Se ei ole ulkoisen
tuotantoympäristön penetraatiotesti eikä todistus Cloudflare-tilin asetuksista.
Historiallinen legacy-painotteinen snapshot säilyy tiedostossa
[`SECURITY_AUDIT.md`](../../SECURITY_AUDIT.md).

Jälkitila 2026-07-19: D-099 siirsi kovennetun market-writer-templaatin polkuun
`.github/disabled-workflows/update-market-prices.yml`. Repositoryssa ei ole
aktiivista GitHub Actions -workflow'ta. Alla olevat riippuvuus-, testi-,
artefakti- ja moduuliluvut ovat 2026-07-14 auditointievidenssiä, eivät elävän
repositoryn vaihtuvia nykytilalukuja.

## Yhteenveto

- Kriittisiä tai korkean vakavuuden löydöksiä ei löytynyt.
- Auditointihetken 2026-07-14 `npm audit` raportoi 0 tunnettua haavoittuvuutta
  353 riippuvuuden kokonaisuudessa. Tämä päivätty tarkistus ei yksin todista
  nykyisen riippuvuuspuun tai toimitusketjun turvallisuutta.
- Tuotantopolusta ei löytynyt kovakoodattuja yleisten palveluiden avain- tai
  private-key-muotoja, raakaa HTML-injektiota tai käyttäjäsyötteeseen kytkettyä
  ajonaikaista koodinsuoritusta.
- Selain-, tiedosto-, localStorage-, API- ja upstream-rajat ovat pääosin
  kokorajoitettuja, skeemavalidoituja ja virheensä sanitisoivia.
- Auditissa kovennettiin silloin ainoa kirjoittava GitHub Actions -workflow;
  D-099 poisti sen myöhemmin aktiivisesta workflow-hakemistosta ja säilytti
  kovennetun templaatin erikseen.

## Löydökset

| Tunnus      | Vakavuus    | Tila                                  | Löydös ja vaikutus                                                                                                                                                                                                                                                                                                  | Toimenpide                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-2026-01 | Keskitaso   | Toteutus valmis, aktivointi avoin     | `src/server/hiscores-core.ts` käyttää edelleen prosessi-/Worker-isolaattikohtaista kiinteän ikkunan asiakasrajoitinta. Se ei yksin muodosta hajautettua globaalia rajaa, joten useat isolaatit tai osoitteet voivat kasvattaa upstream-kyselyjen määrää silloin, kun D-097:n globaali enforcement on pois päältä.   | D-097:n [rate-limit-toteutus](../technical/hiscores-global-rate-limit-spec.md) lisää yhden SQLite Durable Objectin atomisen aggregate-provider-budjetin, yhden sekunnin fail-closed-gaten ja deployattavan binding/migraation tallentamatta player/query/client-identiteettiä. Tila on tarkoituksella `off`; tuotantoaktivointi vaatii provider-kiintiön, D-065-tilievidenssin, kuormarajan ja rollback-todisteen.                  |
| SEC-2026-02 | Keskitaso   | Korjattu; suoritus poistettu käytöstä | Auditointihetken `.github/workflows/update-market-prices.yml` käytti siirrettäviä `actions/*@v4`-tageja ja checkoutin oletusarvoisesti pysyvää kirjoitustunnistetta myös riippuvuuksien asennus- ja validointivaiheissa. Toimitusketjun kompromissi olisi voinut hyödyntää repositoryn `contents: write` -oikeutta. | `actions/checkout` ja `actions/setup-node` pinnattiin tarkkoihin commit-SHA:hin. Checkout ei enää tallenna tunnistetta git-konfiguraatioon, ja `GITHUB_TOKEN` annetaan vain viimeiselle commit/push-vaiheelle. D-099:n jälkeen sama kovennettu templaatti on polussa `.github/disabled-workflows/update-market-prices.yml`, eikä aktiivista Actions-suoritusta ole. `src/tests/workflow-security.test.ts` suojaa templaatin rajoja. |
| SEC-2026-03 | Matala      | Avoin evidenssivaje                   | Repository validoi CSP:n, cache-politiikan, API-reitityksen ja lokiasetusten tavoitetilan, mutta yhtään konkreettista preview- tai tuotantoinstanssia ei ole tässä auditissa tarkistettu. Tehokkaat headerit, Cloudflare-tilin lokit ja rollback ovat siten adopter-evidenssiä, eivät varmennettu tuotantofakta.    | Säilytä `docs/operations/public-deployment-spec.md`-checklist ennen live-väitteitä. HSTS ja `frame-ancestors` pysyvät avoimina hosting- ja embedding-päätöksinä.                                                                                                                                                                                                                                                                    |
| SEC-2026-04 | Informaatio | Hyväksytty rajaus                     | `legacy/index.html` lataa SRI-pinnatut CDN-kehitysversiot ja Babel Standalonen, ja kaksi reference/regeneration-polun tiedostoa suorittaa repositoryn omia legacy-lähteitä `new Function`illa. Nämä polut eivät kuulu rakennettuun tuotantoartifaktiin eivätkä ota käyttäjän koodia syötteeksi.                     | Säilytä archive-only-rajaus D-044/D-060:n mukaisesti. Uusi legacy-polun tuotantokäyttö vaatii erillisen päätöksen ja uuden auditoinnin.                                                                                                                                                                                                                                                                                             |

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
Cloudflare-konfiguraation, deploy-validaattorin, auditointihetkellä aktiivisen
GitHub Actions -workflow'n, riippuvuudet ja archive-only legacy-rajat.

Suoritetut tai lähdekoodista varmennetut tarkistukset:

- `npm audit --json`: 0 info/low/moderate/high/critical-haavoittuvuutta
- staattinen secret-pattern-haku: ei osumia
- DOM-/koodinsuoritushaku: vain kaksi luotettua repository-owned legacy-ajopolkua
- `npm run test -- src/tests/workflow-security.test.ts`: 3/3
- fokusoitu Hiscores core/coordinator/Worker/adapter/provider-gate: 39/39
- `npm run verify`: 79 testitiedostoa / 782 testiä, 19 erillistä goldenia,
  arkkitehtuuri, typecheck, build, artefaktitarkistus, lint, Prettier ja
  `git diff --check` läpäisty; gate ohitti oman dependency audit -vaiheensa
  network-disabled-sandbox-politiikan vuoksi, joten yllä oleva `npm audit` ajettiin
  erikseen
- arkkitehtuuritarkistus: 122 lähdemoduulia, 109 selainpolulla, seitsemän
  dokumentoitua ulkoista entrypointia, ei syklejä tai poikkeuksia
- tuotantoartefakti: 10 tiedostoa, 2 assettia, 1 974 877 tavua ja SHA-256
  `babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`
- tarkkojen GitHub Action -tagien commit-SHA:t varmennettiin niiden virallisista
  GitHub-repositoryista ennen pinnausta

## Avoimet kysymykset

- Aktivoidaanko ensimmäiselle julkiselle instanssille [toteutettu täsmällinen
  Hiscores-provider-budjetti](../technical/hiscores-global-rate-limit-spec.md),
  vai riittävätkö Cloudflaren sijaintikohtainen operaattorisääntö ja nykyinen
  best-effort-sovellusraja?
- Saako julkista UI:ta kehystää toiselle originille, vai lukitaanko CSP myöhemmin
  `frame-ancestors 'none'` -politiikkaan?
- Millä domainilla HTTPS/HSTS ja rollback voidaan todentaa ennen HSTS:n lisäämistä?
- Ovatko Workers Logs, Logpush, Tail Workers ja ulkoiset drainit varmasti pois
  käytöstä valitulla Cloudflare-tilillä, kun ensimmäinen live-evidenssi kerätään?
- Jos D-099 joskus kumotaan ja market-workflow palautetaan aktiiviseksi,
  tarvitaanko sen validointi ja push eri jobeihin tai runnereihin vielä
  vahvempaa toimitusketjueristystä varten?
