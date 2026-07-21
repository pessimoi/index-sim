# Goal

- Id: PF-06
- Status: completed 2026-07-21
- Priority: medium
- Estimated effort: M
- Parent specification:
  [Workbench browser history and page context](../../technical/workbench-browser-history-context-spec.md)
- Depends on: current 11-tab allowlist, lazy pane request lifecycle,
  share-fragment capture and safe-session query

## Tavoite

Tee active workbench pane selaimen history- ja page-context-stateksi exact
allowlisted `pane=<WorkbenchTabId>` -querylla. Tue initial deep link, reload,
user/routed navigation ja non-recursive Back/Forward nykyisen lazy-pane-
lifecycleen kautta. Päivitä ready `document.title` muotoon
`<Pane> · <Target> · 2004scape Combat Simulator`.

Säilytä queryttoman ensimmäisen käynnin Compare/Monsters-oletus eikä lisää
active panea persistenceen tai transfer payloadiin.

## Feature-inventory-tarkistus

Desktop workbench, keyboard navigation, mobile navigation ja lazy pane loading
ovat `Valmis`. Nykyinen `activeTab` alkaa aina `compare`-arvosta eikä URL/title
seuraa panea, joten reload ja Back/Forward katkaisevat työskentelykontekstin.
Tämä goal lisää browser-contextin nykyisiin 11 paneen, ei uutta panea tai uutta
default-päätöstä.

## Aloita tästä

Lue standardin aloituksen lisäksi:

- `docs/technical/workbench-browser-history-context-spec.md`
- `docs/technical/accessibility-keyboard-spec.md`
- `docs/technical/mobile-result-navigation-loop-spec.md`
- `docs/technical/lazy-pane-loading-failure-isolation-spec.md`
- `docs/technical/shareable-setup-permalink-spec.md`
- `src/app/view-models/app-shell.ts`
- `src/app/state/pane-delivery.ts`
- `src/app/components/shell/workbench-tab-navigation.tsx`
- `src/adapters/browser/shareable-url.ts`
- `src/app/application-recovery.ts`
- kaikki `activateWorkbenchTab()`-call sitet `App.tsx`:ssä
- pane-delivery, shell, share-url ja relevantit e2e-testit

Inventoi ja luokittele jokainen activation call site lähteeseen `initial-url`,
`user`, `routed-action`, `history` tai `internal-restore` ennen API-muutosta.

## Toteutusvaatimukset

### 1. Pure URL/title owner

- Käytä `WORKBENCH_TABS`/`WorkbenchTabId`-tyyppiä ainoana allowlistina.
- Parse exact case-sensitive single `pane`; reject empty/unknown/duplicate/
  control/path-like input.
- Missing pane → `compare` ilman että parametri lisätään.
- Invalid/duplicate → `compare` ja remove only invalid pane entries
  `replaceState`:lla, preserve other query/hash.
- URL writer preserve origin/base path, unknown queryt, safe-session-paramin ja
  unrelated fragmentin. Se ei lue/poista `#setup`-payloadia.
- Title formatter käyttää source-backed targetia ja dynamic Loadout labelia,
  fixed `Unknown target` fallbackia eikä koskaan player/raw id/erroria.

### 2. Initial and lazy lifecycle

- Initial `activeTab` tulee pure parserista.
- `createInitialRequestedPaneFamilies` ottaa initial tabin ja pyytää deep-linked
  optional familyä heti, mutta pre-React shell pysyy riippumattomana.
- Mount ei pushaa historya; vain invalid canonicalization replaceaa.
- Deep-linked pane failure pysyy nykyisen pane boundaryn sisällä.

### 3. Activation/history behavior

- User click, roving keyboard ja mobile More pushavat yhden entryn vain tabin
  vaihtuessa.
- Routed actions pushavat yhden entryn tabin vaihtuessa ja säilyttävät nykyisen
  post-ready focus/disclosure intentin.
- Same-tab route ei pushaa.
- Yksi `popstate` listener aktivoi/requestaa ilman push/replace-loopia.
- `internal-restore` ei tee harhaanjohtavaa Back-steppiä.
- Auditoi kaikki nykyiset call sitet ja tee activation source eksplisiittiseksi
  typed APIssa.
- Back/Forward palauttaa vain paneen, ei form/snapshot/scroll/calculation statea.

### 4. Title/focus/accessibility

- Static title säilyy ennen readinessiä.
- Ready title päivittyy paneen, targetin ja active Loadout style -labelin mukana.
- Effect cleanup palauttaa test/harnessin aiemman titlen.
- Tab-keyboard focus säilyy tabissa; routed focus säilyy ownerissaan.
- Popstate ei yleisesti steal focusa. Jos focused element jää hidden paneen,
  siirrä focus uuteen active tabiin sen mountin jälkeen.
- Älä scrollaa documenttia topiin tai lisää redundant live regionia.

### 5. Share/safe composition

- Existing share capture saa käsitellä `#setup` kerran ja preserveää `pane`+
  safe-session queryn.
- Workbench helper preserveää setup fragmentin eikä decodea sitä.
- Existing Share action tekee edelleen clean setup URL:n ilman pane- tai safe-
  session queryä.
- Testaa sub-path hosting ja unknown query/hash preservation.

## Rajaukset

Älä:

- muuta no-query defaultia pois Comparesta;
- persistoi active panea localStorageen, Workspaceen, setup/shareen tai saved
  snapshotiin;
- lisää router-libraryä tai server routea;
- laita setup statea/history.stateen;
- palauta Back/Forwardilla formia, resultia, scrollia tai row selectionia;
- renderöi arbitrary queryä DOM id:hen, selectorin tai titleen;
- muuta share payloadia tai safe-session semanticsia; tai
- lisää analyticsia/telemetryä.

## Pakolliset testit

```sh
npm run test -- src/tests/app-shell-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/pane-delivery.test.tsx src/tests/ui-adapters.test.ts src/tests/shareable-setup.test.ts src/tests/application-error-boundary.test.tsx
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "restores workbench pane through browser history"
npm run test:e2e:cross-browser
npm run verify
git diff --check
```

Pure-testit kattavat kaikki 11 id:tä, missing/invalid/duplicate/control/oversized,
root/sub-path preservationin, safe queryn, setup/unrelated fragmentin ja titlen.

Browser-flow:

1. avaa `?pane=planner` ja tarkista lazy load + title;
2. navigoi tab/routed/mobile More -reiteillä Planner → Economy → Trip;
3. Back/Forward kahdesti ilman loopia, URL/pane/title/state agreement;
4. reload Plannerissa;
5. invalid/duplicate canonicalization;
6. `pane` + safe-session + share fixture samassa URLissa;
7. keyboard focus ja 390 px mobile reveal.

Laajenna olemassa olevan CB-01–CB-12-manifestin pane/navigation-tapausta
history-reload/Back/Forward-evidencellä; älä muuta manifestin id-sopimusta vain
tätä goalia varten. Aja Chromium, Firefox ja WebKit. Branded Safari/physical
iOS eivät tule claimatuksi ilman owning manual evidenceä.

## Dokumentaatiopäivitykset

- merkitse parent-spec toteutetuksi todellisilla URL/history/title/check-tiedoilla;
- muuta backlog-kortti `Done`-tilaan;
- päivitä keyboard/mobile/lazy/current workbench -nykytilateksti;
- päivitä architecture uuden URL ownerin ja App compositionin osalta;
- pidä Compare-default-decision avoimena/ennallaan; ja
- merkitse tämä goal completed-checkeillä.

## Done

- [x] Kaikki 11 panea deep linkkaavat ja reloadavat.
- [x] Missing/invalid käyttäytyy parent-specin mukaan.
- [x] User/routed push, same-tab no-op, popstate ja internal restore eivät tee
      loopia.
- [x] Lazy family, visible pane, ARIA state, URL ja title ovat aina samassa
      tilassa.
- [x] Safe query/share fragment composeavat ilman data lossia.
- [x] Active-pane persistence/schema/default ei muuttunut.
- [x] Unit-, selain-, kolmen selainprofiilin, verify-, architecture- ja
      diff-evidence läpäisee ja on kirjattu.
- [x] Living documentation kuvaa nykyisen toiminnan.

## Lopuksi

Raportoi kaikkien activation call sitejen source-luokittelu, URL canonicalization-
tapaukset, History API -eventit, title examples, focus behavior ja selaimet/
manuaaliset ympäristöt joita ei voitu ajaa.
