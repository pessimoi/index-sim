# Goal

- Id: RP-01
- Status: completed 2026-07-22
- Priority: critical
- Estimated effort: M
- Parent specification:
  [Workspace backup discoverability](../../technical/release-polish-workspace-backup-discoverability-spec.md)
- Depends on: existing Workspace backup/restore and setup transfer surfaces

## Tavoite

Tee täysi Workspace-varmuuskopio löydettäväksi suoraan setup-siirron yhteydessä.
Käyttäjän pitää päästä headerin setup-scope-varoituksesta olemassa olevaan
Workspace backup -omistajaan ilman että syntyy toinen backup-formaatti.

## Aloita tästä

Lue parent-specin lisäksi:

- `src/app/components/shell/app-header.tsx`
- `src/app/components/settings/workspace-backup-panel.tsx`
- Workspace backup controller/view-model tests
- app shell focus-routing tests

Inventoi nykyiset setup export/import -copyt ja kaikki Settings-fokusreitit
ennen editointia.

## Toteutusvaatimukset

- Lisää setup-siirtopinnan viereen suora route/action `Download full Workspace
backup` tai vastaava parent-specin mukainen toiminto.
- Käytä nykyistä Settings/Workspace controlleria ja Hiscores privacy opt-inia.
- Toteuta one-shot focus Workspace backup -headingiin tai export-kontrolliin.
- Säilytä setup exportin ja Workspace backupin scope-copyt erillisinä.

## Rajaukset

Älä muuta setup- tai Workspace-envelopeä, restore-plania, Apply/Undoa,
privacy-defaultteja, storage keytä tai filename/outcome-contractia.

## Pakolliset testit

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/economy-settings-pane.test.ts src/tests/workspace-backup-panel.test.tsx src/tests/workspace-backup-controller.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer"
git diff --check
```

## Evidence

- Header now includes `Download full Workspace backup` beside setup-transfer
  scope copy and routes to Settings' existing Workspace export owner with
  one-shot focus.
- Passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/economy-settings-pane.test.ts src/tests/workspace-backup-panel.test.tsx src/tests/workspace-backup-controller.test.ts`.
- `npm run typecheck` passed after implementation.

## Done

- [x] Setup-siirtopinnalta löytyy suora täyden Workspace backupin reitti.
- [x] Reitti käyttää olemassa olevaa Workspace-omistajaa ja fokus toimii.
- [x] Hiscores privacy opt-in säilyy default-off.
- [x] Kapea viewport ei peitä tai katkaise toimintoa unit-/layout-regression
      omistajien mukaan; erillistä visual baseline -päivitystä ei tehty.
- [x] Dokumentit ja backlog päivitetään vasta toteutusevidencen jälkeen.
