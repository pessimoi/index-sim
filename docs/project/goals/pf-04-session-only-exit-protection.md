# Goal

- Id: PF-04
- Status: completed 2026-07-21
- Priority: high
- Estimated effort: M
- Parent specification:
  [Session-only exit protection and direct backup](../../technical/session-only-exit-protection-spec.md)
- Depends on: safe-session storage access, Workspace area registry/live capture,
  persistence-aware outcomes and typed file export result

## Tavoite

Suojaa current-tabissa oleva merkityksellinen session-only-työ. Näytä yksi
ready-shell-varoitus ja rekisteröi browser-native `beforeunload` vain silloin,
kun vähintään yksi Workspace-alue poikkeaa durable baselinesta eikä exact current
statea ole kuitattu siihen sisältyneellä onnistuneella Workspace download
requestilla.

Tarjoa varoituksesta suora `Download Workspace backup` käyttämällä nykyistä
coherent live capture-, privacy- ja truthful export -polkua. Älä lue tai muuta
safe-sessionin alkuperäistä localStorage-dataa.

## Feature-inventory-tarkistus

`Application failure recovery`, `Workspace backup and restore` ja local-state
recovery ovat `Valmis`. Nykyinen safe session kertoo muutosten olevan
session-only, mutta editointi+reload voi kadottaa työn ilman leave guardia eikä
notice tarjoa suoraa backupia. Tämä goal yhdistää valmiit omistajat; se ei lisää
uutta persistence-järjestelmää.

## Aloita tästä

Lue standardin aloituksen lisäksi:

- `docs/technical/session-only-exit-protection-spec.md`
- `docs/technical/application-error-boundary-spec.md`
- `docs/technical/workspace-backup-restore-spec.md`
- `docs/technical/file-export-outcome-feedback-spec.md`
- `docs/technical/cross-tab-local-state-conflict-spec.md`
- `src/app/application-recovery.ts`
- `src/app/components/shell/application-error-boundary.tsx`
- `src/app/state/workspace-backup.ts`
- `src/app/controllers/workspace-file-transfer.ts`
- `src/app/controllers/local-state-recovery.ts`
- `App`-tason storage access, Workspace live capture ja persistence outcomes
- relevantit application/workspace/recovery/cross-tab-testit

Inventoi kaikki `WORKSPACE_REQUIRED_AREA_IDS`, sensitive opt-in ja excluded
alueet sekä jokainen polku, joka voi julkaista durable/session-only/no-op-
mutation outcomea. Älä ylläpidä toista käsin kirjoitettua area-listaa.

## Toteutusvaatimukset

### 1. Pure durability guard

- Lisää DOM-vapaa core, jonka closed reasonit ovat `saved-data-ignored`,
  `storage-unavailable` ja `session-only-write`.
- Käytä Workspace registryä exact area classificationiin ja canonical semantic
  compareen. Sulje transient result/pane/disclosure/review/Undo state pois.
- Mallinna per area durable baseline, current value ja backup acknowledgement
  vain muistissa.
- Global safe/storage-unavailable startupin baseline syntyy vasta ready/default/
  loader-settlementin jälkeen; mode yksin ei ole dirty.
- Session-only mutaatio durable sessionissa säilyttää pre-mutation durable
  baselinen ja julkaisee new currentin.
- Durable verified save siirtää vain oman areansa baselinen; no-op ei muuta
  mitään; exact revert baselineen clearaa arean.
- Uusi Workspace registry -area failaa exhaustive classification testin.

### 2. Shell presentation

- Composea nykyinen `Session-only safe mode` ja dirty warning yhdeksi näkyväksi
  owneriksi; älä luo kilpailevia live regioneja.
- Ennen editointia säilytä nykyinen informational mode notice ilman leave guardia.
- Dirty state näyttää `Unsaved session-only changes`, menetysriskin, reason-
  summaryn, affected area countin ja `Download Workspace backup` -actionin.
- Announcea vain siirtymä dirtyyn ja backup success/failure, ei joka keystrokea.
- Pidä notice/action saavutettavana desktop-, compact-landscape- ja mobile-
  layoutissa.

### 3. Direct Workspace backup and acknowledgement

- Käytä yhtä `captureCurrentWorkspaceLiveState()`-hetkeä ja nykyistä Workspace
  privacy togglea/export controlleria.
- Laajenna typed success outcomea palauttamaan actual included area ids, jos
  caller ei jo saa niitä.
- Acknowledgea vain exact dirty area state, joka oli request-envelopeen
  sisällytetty.
- Jos dirty Hiscores player jätettiin opt-inillä pois, pidä guard armed ja näytä
  fixed privacy guidance.
- Failed export ei acknowledgea mitään; post-backup edit invalidioi exact
  acknowledgementin.
- Käytä truthful copya: download request started, filesystem savea ei voida
  todistaa.

### 4. `beforeunload`

- Yksi thin hook/effect lisää stable listenerin vain armed-tilassa ja poistaa
  saman listenerin disarmissa/unmountissa.
- Handler kutsuu `preventDefault()` ja asettaa `returnValue = ""`.
- Käytä latest armed refiä; handler ei setStatea, persistoi, exporttaa, clearaa
  eikä rakenna async-työtä.
- Älä rekisteröi ennen readinessiä tai durable/no-op-stateen.
- Internal pane/history/focus-muutokset eivät laukaise guardia.
- Älä käytä `unload`, `pagehide`, `visibilitychange`, beaconia tai auto-downloadia.

## Rajaukset

Älä:

- lisää localStorage/sessionStorage keytä guardille tai acknowledgementille;
- muuta Workspace envelopea, required/sensitive policyä tai import/Undoa;
- lue, overwriteä tai clearaa safe-sessionin original localStoragea;
- käsittele cross-tab conflictiä tämän guardin reasonina;
- lisää custom leave modal -tekstiä tai väitä selaimen näyttävän custom-copya;
- lisää service worker-, cloud-, server- tai account-recoverya; tai
- tallenna/loggaa raw values/fingerprints/exported JSONia.

## Pakolliset testit

```sh
npm run test -- src/tests/application-error-boundary.test.tsx src/tests/local-state-recovery-controller.test.ts src/tests/workspace-backup.test.ts src/tests/workspace-backup-controller.test.ts src/tests/workspace-backup-panel.test.tsx src/tests/cross-tab-conflicts.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "protects session-only changes before leaving"
npm run test:e2e:cross-browser
npm run verify
git diff --check
```

Lisää pure tests vähintään no-edit, edit, exact revert, durable save, session-only
write, included backup, omitted sensitive area, failed backup ja post-backup edit
-tapauksille.

Lisää listener-testit: absent → exactly one → removed; `preventDefault` ja
`returnValue`; no React mutation handlerissa.

Production-preview-case menee oikean safe recovery -polun kautta, todistaa
localStorage-bytes unchanged, dialog eventin, cancelin, download eventin,
acknowledgementin ja re-arm-editin. Kata storage unavailable/session-only
outcome sekä privacy opt-in off/on. Laajenna olemassa olevan CB-01–CB-12-
manifestin sopivaa recovery/Workspace-tapausta; älä lisää tai nimeä manifestin
id:tä uudelleen vain grep-komennon vuoksi. Cross-browser-ajossa älä väitä
branded Safari/physical iOS -näyttöä.

## Dokumentaatiopäivitykset

- merkitse parent-spec toteutetuksi ja lisää todellinen guard/export evidence;
- muuta backlog-kortti `Done`-tilaan;
- päivitä application recovery/Workspace current-state-tekstit;
- päivitä architecture, jos uusi core/hook on living owner;
- pidä Workspace schema/privacy, cross-tab ja file-export truth erillisinä; ja
- merkitse tämä goal completed-checkeillä.

## Done

- mode ilman editointia ei armaudu;
- meaningful non-durable Workspace edit näyttää notice+direct backupin ja armaa
  yhden leave listenerin;
- exact revert/durable save/complete exact included backup disarmaa oikein;
- failure, omitted dirty sensitive area ja myöhempi edit pitää/re-armaa;
- original saved data on byte-for-byte muuttumaton;
- ei uusia storage key/skeemoja eikä listener leakia;
- unit, browser, cross-browser, verify, architecture ja diff läpäisevät; ja
- dokumentaatio kuvaa nykyisen toteutuksen.

## Lopuksi

Raportoi guardin area/reason-matriisi, baseline/acknowledgement-lifecycle,
Workspace included-id -evidence, listener cleanup, original-storage-todiste ja
kaikki selaimet/manuaaliset ympäristöt joita ei voitu ajaa.

## Toteutusevidenssi 2026-07-21

- [x] DOM-vapaa guard käyttää suoraan Workspace-rekisterin kymmentä
      transferable-aluetta ja sen codecien canonical semantic -vertailua.
- [x] Suljettu reason-joukko on `saved-data-ignored`, `storage-unavailable` ja
      `session-only-write`; cross-tab-conflict ei ole guard-reason.
- [x] Ready-settlement muodostaa vain muistissa olevan baselinen. Safe mode
      ilman editointia ei armaudu; exact revert ja verified durable save
      purkavat oman alueensa suojan.
- [x] Yksi composed ready-shell owner näyttää riskin, area countin, suoran
      Workspace-backupin ja truthful request/failure-outcomen.
- [x] Workspace-exportin typed requested-outcome palauttaa todelliset included
      area id:t. Exact included state kuittaantuu, sensitiivisen Hiscores-alueen
      opt-out ei kuittaannu ja post-backup edit re-armaa.
- [x] Thin `beforeunload`-hook asentaa yhden stable listenerin vain armed-tilaan,
      käyttää latest refiä ja poistaa saman listenerin disarmissa/unmountissa.
- [x] Pure/controller/component-kierros läpäisee 8 tiedostoa / 71 testiä.
- [x] Nimetty Chromium safe-recovery -polku läpäisee 1/1; yhdistetty
      safe-recovery + runtime session-only -kierros läpäisee 2/2.
- [x] CB-06:n laajennus ja koko cross-browser-portti läpäisevät 36/36:
      Firefox, desktop-WebKit ja iPhone 13 -emuloitu mobiili-WebKit.
- [x] Architecture check läpäisee 176 lähdemoduulilla, 162 client-reachable
      moduulilla, kahdeksalla entrypointilla ja ilman syklejä.
- [x] Puhdas `npm run verify` läpäisee 116/116 testitiedostoa,
      1 115/1 115 testiä, 19/19 legacy goldenia, buildin, artifactin, lintin,
      Prettierin ja diff-tarkistuksen.
- [x] Safe-recovery browser-evidence vertaa kaikki alkuperäiset localStorage
      key/value-bytet ennen ja jälkeen editin, dialogin cancelin, exporttien ja
      re-arm-editin; ne pysyvät samoina.

Guard tai kuittaus ei lisää storage keytä, muuta Workspace-envelopea tai
privacy-policyä eikä lue safe-sessionin alkuperäistä localStoragea. Branded
Safari, fyysinen iOS, VoiceOver ja NVDA jäivät manuaalisesti ajamatta;
cross-browser-evidence koskee Playwrightin Firefox/WebKit-projekteja.
