# Shareable setup permalink specification

- Status: implemented
- Date: 2026-07-10
- Owner: product UI and browser adapters
- Evidence: verified
- Contract: living

- Source: promoted from `docs/project/idea-inbox.md`
- Related current workflows: Basic combat setup, setup JSON export/import,
  per-monster Cannon and loot state, Duel snapshots

Current extension: the implemented
[game revision and setup-transfer context contract](game-revision-transfer-context-spec.md)
supersedes only this document's external version/context details. New links use
version 2 with the shared revision/snapshot stamp; version 1 remains readable
with exact-id or unknown-revision normalization. Size, privacy, review,
compatibility, Load/Dismiss/Undo and browser-adapter boundaries below remain
current.

## Feature-inventory check

Basic combat setup and Duel snapshots remain `Valmis`. This implementation does
not reimplement either workflow. It completes one bounded `Valmis` capability:
sharing the currently active setup through a static URL. Account-backed saves,
shared snapshot collections and server short links remain separate ideas.

## Implementation evidence

- Contract, bounded codec, compatibility review and pure apply/undo:
  `src/app/state/shareable-setup.ts`.
- Fragment capture/removal, current-base URL creation and clipboard wrapper:
  `src/adapters/browser/shareable-url.ts`.
- Review-before-load, Share dialog, Load/Dismiss/Undo and sanitized notices:
  `src/app/App.tsx`.
- Focused contract/adapter tests: `src/tests/shareable-setup.test.ts` and
  `src/tests/ui-adapters.test.ts`.
- Production-preview workflow coverage:
  `src/tests/e2e/shareable-setup.spec.ts`.

## Goal

Let a user create a versioned URL for the active combat setup and let a
recipient review and explicitly load that setup in the static root app without
a database, account, backend or production-domain dependency.

The link should reproduce current combat/trip inputs plus current-monster
Cannon and loot choices. It must not silently overwrite browser-local state or
pretend to reproduce price-sensitive outputs when the recipient has a different
active `PriceSet`.

## User workflow

### Create a link

1. Add a `Share setup` command next to the existing setup export/import actions.
2. Open a compact dialog summarizing the shared target, combat style and the
   fact that player levels and current-monster modifiers are included.
3. Generate the URL only from validated current app state.
4. Show the URL in a read-only, selectable field with a `Copy` command.
5. On successful clipboard write, show `Link copied` without closing the dialog.
6. If the Clipboard API is unavailable or rejects, keep the selectable URL
   visible and show a non-fatal manual-copy message.

Do not require the Web Share API. Native sharing can be considered later, but
v1 uses one deterministic dialog and clipboard fallback path.

### Open a link

1. Read the share fragment once during bootstrap, after the generated runtime
   context is available.
2. Validate and retain the candidate only in memory. Do not write storage or
   mutate the active setup during inspection.
3. Remove the fragment from the address bar with `history.replaceState` after
   capturing it, preserving the current origin, base path and query string.
4. Show a review notice with target, combat style, included modifier counts,
   source game-data id and any compatibility warning.
5. Offer `Load setup` and `Dismiss` commands.
6. `Load setup` applies the candidate through existing setup/Cannon/loot state
   update paths and then persists through existing versioned keys.
7. After loading, offer one in-memory `Undo` that restores the pre-load form,
   current-monster Cannon settings, loot preferences and loot settings.
8. `Dismiss` leaves active and persisted state unchanged.

Invalid, unsupported or oversized links show one sanitized non-fatal notice and
leave all current state unchanged.

## URL contract

Use a URL fragment, not a query parameter:

```text
<current-origin><current-base-path>#setup=<base64url-payload>
```

The fragment is not sent in normal HTTP requests and works on static hosting.
The base URL must be derived from `window.location.origin` plus the current
pathname so sub-path deployments work without knowing the production domain.
Drop any existing share fragment when generating a new link.

Encoding rules:

- UTF-8 JSON encoded as unpadded base64url.
- No compression in version 1.
- Maximum encoded fragment value: 12,000 characters.
- Maximum decoded JSON: 8,192 UTF-8 bytes.
- Reject invalid base64url, invalid UTF-8, duplicate JSON keys, invalid JSON,
  unsupported kind/version and schema-invalid data before app state access.
- If current validated state cannot fit, do not create a partial link; direct
  the user to the existing setup JSON export instead.

## Data contract

Add a dedicated external contract rather than exposing a localStorage envelope:

```ts
interface ShareableSetupEnvelopeV1 {
  kind: "index-sim-setup";
  version: 1;
  gameDataId: string;
  data: {
    form: CombatSetupFormState;
    cannon: CannonSettings;
    lootPreferences: Record<string, LootAction>;
    lootSettings: MonsterLootSettings;
  };
}
```

The Cannon and loot fields apply only to `data.form.monsterId`. Every generated
link includes them, using current defaults when no explicit override exists, so
round trips are deterministic.

External parsing must be strict. Existing persistence schemas with `.catch()`
or defaults may be reused only after the untrusted envelope has passed a strict
shape/range gate; malformed share fields must not silently become defaults.

## Included state

- Active `CombatSetupFormState`, including player levels, active/per-style
  loadouts, prayers, boosts, special attack, manual overrides, Trip assumptions,
  Ring of Wealth and planner target levels already owned by that form.
- Current monster's effective Cannon settings.
- Current monster's valid loot row action preferences.
- Current monster's effective high-alch/overhead/talisman settings.
- Current generated `GameDataSnapshot.id` as compatibility metadata.

## Excluded state

- Player name and hiscores response/source metadata.
- Active `PriceSet`, item prices, alch maps and price history.
- Custom setup collection, default form history and setup mode.
- Duel snapshot collection or calculated Duel matrix output.
- Planner UI state outside fields already present in the active form.
- Hidden gear tier preferences, Dense Compare filters and irrelevant rows.
- Legacy storage keys, migration payloads and local-state health details.
- Computed simulation results, warnings, provenance payloads and raw source
  paths.
- Account ids, tenant ids, secrets, tokens or analytics identifiers.

The review notice and share dialog must state that the recipient uses their
current price data, so GP values can differ even when combat inputs match.

## Compatibility and validation

After envelope validation:

- Compare `gameDataId` with the active generated snapshot id.
- Matching ids: show no revision warning.
- Different ids with all referenced entities still valid: allow load with a
  visible `Different game-data version` warning.
- Unknown monster, weapon, ammo, spell, gear, prayer, boost or special-attack
  id: reject the candidate rather than silently replacing the setup.
- Loot preference row ids that no longer exist for the target monster: drop
  only those rows, show the sanitized dropped-row count and keep the rest.
- Never accept an entity label as an id fallback.

The external contract version is independent from
`REWRITE_SETUP_VERSION`. A future local persistence migration must not
implicitly reinterpret permalink v1; add an explicit permalink version parser
when its contract changes.

## Architecture and ownership

Recommended implementation boundaries:

- `src/app/state/shareable-setup.ts`: strict Zod contract, canonical envelope
  builder, bounded encode/decode, compatibility report and pure apply/undo data.
- `src/adapters/browser/shareable-url.ts`: current-base URL creation, fragment
  capture/removal and Clipboard API wrapper.
- `src/app/App.tsx`: dialog/review/notice orchestration and explicit application
  through existing state setters.
- Existing `ui-state.ts`, `loot-prefs.ts` and `loot-settings.ts` remain owners of
  their internal schemas and update helpers.

Do not add permalink fields to `SimulationRequest`, `SavedSetupSchema`, Duel
storage, local state health or domain result contracts. Do not create a new
localStorage key merely to remember a received link.

## Accessibility and UI behavior

- `Share setup` is a clear command and may use text because no icon library is
  currently installed.
- The dialog has a programmatic title, initial focus, keyboard dismissal and
  returns focus to the triggering command.
- The read-only URL field has an accessible label and does not truncate the
  copied value, even if its visual presentation uses overflow handling.
- Review, load, dismiss, copy failure and undo notices must be screen-reader
  discoverable without stealing focus repeatedly.
- Long target/item labels must wrap without resizing fixed controls or
  overlapping adjacent actions.

## Security and privacy

- Treat the fragment as untrusted external input.
- Enforce encoded and decoded size limits before expensive parsing.
- Use duplicate-key-safe JSON parsing and strict Zod validation.
- Never render raw fragment text, raw Zod issues, absolute paths or parser
  diagnostics in the UI.
- Do not use `innerHTML`, runtime code execution, redirects or remote URL fetches.
- Do not persist or apply data before explicit `Load setup` confirmation.
- Remove the captured fragment to prevent repeated imports on refresh and reduce
  accidental re-sharing from the address bar.
- Explain in the share dialog that anyone with the link can read the included
  levels and setup choices; the link is encoded, not encrypted.
- Clipboard failure must remain non-fatal and must not trigger legacy copy APIs
  that inject HTML.

There is no auth, account, tenant, payment, database, admin or server-side state
impact.

## Tests

### Unit tests

Add focused tests for:

- deterministic build and encode/decode round trip
- Unicode-safe unpadded base64url
- encoded and decoded size boundaries
- invalid base64url/UTF-8/JSON and duplicate-key rejection
- strict kind/version/schema rejection
- exclusion of prices, player name, collections, computed results and raw
  provenance
- game-data match and mismatch reports
- unknown critical entity rejection
- stale loot-row dropping with sanitized counts
- no mutation of input state
- apply and one-step undo restoration
- URL creation for root and sub-path deployments
- fragment removal preserving path and query
- Clipboard API success and failure wrappers

### Browser tests

Add production-preview Playwright coverage for:

1. Share dialog summary and deterministic read-only link.
2. Successful copy status using a mocked Clipboard API.
3. Clipboard failure with selectable manual-copy fallback.
4. Opening a valid link shows review without localStorage writes.
5. `Load setup` applies form, Cannon and loot state through existing versioned
   stores and leaves unrelated local keys unchanged.
6. One-step Undo restores the complete pre-load state.
7. `Dismiss` leaves active and persisted state unchanged.
8. Invalid, oversized, unsupported-version and unknown-id links are non-fatal,
   sanitized and removed from the address bar.
9. Different game-data id shows the compatibility warning.
10. PriceSet and price history remain the recipient's current state.

Do not call live upstreams.

## Documentation updates on implementation

- Change `Setup sharing` from `Suunniteltu` to `Valmis` in feature inventory.
- Update architecture with the actual module locations and URL bootstrap path.
- Update testing with focused commands and passing evidence.
- Mark the backlog card `Done` and remove any superseded open questions.
- Keep account-backed saves, server short links and shared Duel collections in
  the idea inbox unless separately promoted.

## Done criteria

- A validated current setup produces a bounded fragment URL on root and sub-path
  deployments.
- Opening the link never changes active or persisted state before confirmation.
- Review, load, dismiss, copy fallback and one-step undo are implemented.
- Current form, current-monster Cannon and current-monster loot choices round
  trip; excluded state demonstrably does not.
- Different revision and stale loot-row behavior is visible and deterministic.
- Invalid input is bounded, sanitized and non-fatal.
- Unit, typecheck, focused Playwright, full functional Playwright and
  `git diff --check` pass.
- Security review confirms no server, account, tenant, secret or raw provenance
  exposure.

## Decision boundaries

This specification does not add URL shortening, a redirect service, accounts,
shared cloud state, public setup discovery, analytics, encryption, QR codes,
native Web Share behavior or full Duel/Planner collection sharing. Each would
need separate product and security review.
