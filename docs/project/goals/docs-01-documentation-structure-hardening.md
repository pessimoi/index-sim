# Goal

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project documentation and repository tooling
- Evidence: verified
- Contract: closed

- Id: DOCS-01
- Priority: high
- Estimated effort: L
- Parent specifications:
  [documentation structure hardening program](../documentation-structure/README.md)

## Tavoite

Toteuta dokumentaation rakenteellinen kovennus niin, että nykyinen totuus,
toteutuskelpoinen työ, generoitu raportti ja päivätty historiallinen evidence
ovat yksiselitteisesti erotettavissa. Säilytä nykyinen product/technical/
operations/project-omistajuus, mutta poista pääkarttojen duplikaatio ja
elävien dokumenttien muuttuvien lukujen driftiriski.

Goal toteuttaa seitsemän parent-speksiä järjestyksessä. Jokainen vaihe on oma
katselmoitava kokonaisuutensa; myöhempi vaihe ei saa piilottaa aiemman vaiheen
rikkinäisiä linkkejä tai metadatavirheitä.

## Aloita tästä

Lue standardin aloituksen lisäksi kokonaan:

- [ohjelman indeksi](../documentation-structure/README.md);
- kaikki seitsemän parent-speksiä;
- `docs/README.md`, `docs/technical/README.md` ja `docs/project/README.md`;
- `docs/technical/architecture.md` ja `docs/technical/testing.md`;
- `docs/project/testing-evidence.md`, `backlog.md` ja `decisions.md`; ja
- nykyiset dokumentaatioauditit vain päivättyinä evidence-lähteinä.

Tee ennen muokkausta uusi read-only-inventaario Markdown-tiedostoista,
sisään tulevista linkeistä, heading-ankkureista, dokumentoiduista npm-komennoista,
statusmuodoista ja elävissä dokumenteissa esiintyvistä moduuli-/testi-/artifact-
luvuista. Käytä inventaariota siirtymän baselineen; älä kopioi sen muuttuvia
lukuja uusiin living docs -kohtiin.

## Toteutusjärjestys

1. Toteuta [current facts and drift control](../documentation-structure/current-facts-spec.md).
2. Toteuta [metadata contract](../documentation-structure/metadata-spec.md).
3. Toteuta [navigation and consistency checks](../documentation-structure/navigation-spec.md).
4. Toteuta [living architecture owner](../documentation-structure/architecture-owner-spec.md).
5. Toteuta [testing truth and dated evidence](../documentation-structure/testing-evidence-spec.md).
6. Toteuta [technical specification lifecycle](../documentation-structure/technical-spec-lifecycle-spec.md).
7. Toteuta [project memory structure](../documentation-structure/project-memory-spec.md).

Metadata- ja navigointivaiheet luovat tarkistimen, jota kaikki myöhemmät vaiheet
käyttävät. Arkkitehtuuri- ja testausvaiheet voivat olla erillisissä
katselmoinneissa, mutta projektimuistin viimeistely tehdään vasta niiden jälkeen.

## Yhteiset rajaukset

Älä:

- muuta tuotantokoodin käyttäytymistä, laskentaa, dataa, skeemoja, providereita,
  deploy-mallia tai browser persistenceä;
- regeneroi game-dataa, hintoja, revision-impactia, audit-raportteja tai visual
  baselineja;
- poista historiallista evidenceä tai nimeä manuaalista/live-evidenceä
  suoritetuksi;
- siirrä 95 teknistä spesifikaatiota tai generator-owned raportteja fyysisesti;
- lisää dokumentaatiosivustoa, verkko-crawlausta, CI-provideria tai remote merge
  gatea; tai
- muuta käyttäjän ennestään muokkaamia tiedostoja laajemmin kuin goalin
  dokumentaatioreititys välttämättä vaatii.

`docs:check` saa lisätä repository-local scriptin, focused-testit ja
`package.json`-komennon. Se on read-only validation tooling, ei sovelluksen
runtime-ominaisuus.

## Pakolliset validoinnit

Toteutus lisää tarkistimelle focused-testit ja ajaa vähintään:

```sh
npm run typecheck
npm run architecture:check
npm run test
npm run format:check
git diff --check
```

Aja lisäksi toteutettu `docs:check` package script ennen koko verify-gatea.

Jos `npm run verify` sisältää lopullisen `docs:check`-vaiheen, aja myös koko
`npm run verify`. Browser-, visual-, live-provider- ja generated-data-sarjoja ei
tarvita, ellei diffi laajene niiden omistamiin lähteisiin tai artefakteihin.

Tarkista lisäksi, että:

- jokainen local Markdown -tiedostolinkki ja heading-ankkuri ratkeaa;
- jokainen dokumentoitu `npm run` -komento löytyy `package.json`:sta;
- jokainen dokumentti on saavutettavissa määritellyn indeksipolun kautta;
- metadata käyttää vain canonical-arvoja;
- living docs eivät sisällä kiellettyä muuttuvaa evidenceä; ja
- historiallisten arvojen päivämäärä ja claim boundary säilyvät.

## Dokumentaatiotilat

Kun toteutus alkaa, muuta goal `active`-tilaan ja merkitse vain työn alla oleva
parent-spec aktiiviseksi. Kun yksi vaihe valmistuu, merkitse sen spec
`implemented`-tilaan ja kirjaa todelliset muutokset sekä ajetut tarkistukset.
Älä merkitse koko goalia valmiiksi ennen seitsemännen vaiheen lopullista
ristiinvalidointia.

## Done

Goal on valmis vasta kun:

- kaikki seitsemän parent-speksiä ovat `implemented`;
- root documentation map on lyhyt owner-tason reititin;
- tekninen ja projekti-indeksi kattavat kaikki tiedostonsa ilman duplikaattista
  pääkarttaa;
- current-faktat, current-komennot ja dated evidence ovat eri omistajilla;
- arkkitehtuuridokumentti kuvaa nykyarkkitehtuuria ilman stale counts- tai
  implementation diary -sisältöä;
- aktiiviset, living, implemented ja historical specs erottuvat katalogissa;
- project memory erottaa nykytyön, goalit, generated reportit ja audit-historian;
- repository-local `docs:check` on osa normaalia verification-polkuja;
- kaikki pakolliset tarkistukset läpäisevät; ja
- mitään historiallista evidenceä tai käyttäjän ennestään olevaa muutosta ei
  ole hukattu.

## Lopuksi

Raportoi changed files omistajittain, ennen/jälkeen navigointimittarit,
normalisoitujen metadata-arvojen määrä, poistuneet stale current -väitteet,
evidence-siirrot, tarkistimen kattavuus, ajetut validoinnit sekä mahdolliset
fyysiset siirrot tai provider/CI/manual-evidence-rajat, jotka jätettiin
tarkoituksella myöhemmäksi.

## Toteutusevidence

Seitsemän parent-speksiä toteutettiin annetussa järjestyksessä. Root- ja
section-kartat, canonical metadata, lifecycle-katalogi, living architecture,
testing/evidence-erottelu ja project memory ovat käytössä. `docs:check` on osa
`npm run verify` -ketjua.

Lopullinen repository-gate läpäisi typecheckin, architecture- ja docs-checkit,
unit- ja legacy-golden-testit, build/artifact-validoinnin, lintin, Prettierin ja
`git diff --check`in. Päivätty tulos ja sitä edeltänyt erillään onnistunut
suorituskykytestin timeout-uusinta ovat
[testing evidencessä](../testing-evidence/2026-07-27.md). Browser-, visual-,
VoiceOver/NVDA-, branded Safari-, physical-device-, live-provider- tai deployed
Cloudflare -ajoa ei tehty, eikä niitä väitetä tämän dokumentaatiogoalin
evidencenä.
