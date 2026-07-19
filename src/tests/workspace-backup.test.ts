import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createMemoryStorage } from "../adapters/storage";
import { createBrowserStorageAccess } from "../app/application-recovery";
import { DEFAULT_DUEL_SNAPSHOTS_STATE } from "../app/state/duel-snapshots";
import { DEFAULT_HIDDEN_GEAR_TIERS_STATE } from "../app/state/hidden-gear-tiers";
import {
  LOCAL_STATE_HEALTH_DESCRIPTORS,
  type LocalStateHealthItemId
} from "../app/state/local-state-health";
import { DEFAULT_LOOT_PREFS_STATE } from "../app/state/loot-prefs";
import { DEFAULT_LOOT_SETTINGS_STATE } from "../app/state/loot-settings";
import { DEFAULT_MANUAL_PRICE_OVERRIDES_STATE } from "../app/state/manual-price-overrides";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import {
  WORKSPACE_AREA_REGISTRY,
  WORKSPACE_AREA_TRANSFER_VERSION,
  WORKSPACE_BACKUP_IMPORT_MAX_BYTES,
  WORKSPACE_REQUIRED_AREA_IDS,
  createWorkspaceBackupExport,
  createWorkspaceBackupFileName,
  parseWorkspaceBackupText,
  WorkspaceBackupError,
  type WorkspaceLiveState
} from "../app/state/workspace-backup";

interface MutableWorkspaceArea {
  id: string;
  version: number;
  data: unknown;
  extra?: unknown;
}

interface MutableWorkspaceFile {
  kind: string;
  version: number;
  exportedAt: string;
  context: { gameDataId: string; gameRevision: number };
  areas: MutableWorkspaceArea[];
  extra?: unknown;
}

const gameData = createGeneratedRuntimeContext().context.gameData;

function liveState(player = "  Rune Hero  "): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm(DEFAULT_FORM_STATE),
    "planner-ui": DEFAULT_PLANNER_UI_STATE,
    "loot-prefs": DEFAULT_LOOT_PREFS_STATE,
    "loot-settings": DEFAULT_LOOT_SETTINGS_STATE,
    "hidden-gear-tiers": DEFAULT_HIDDEN_GEAR_TIERS_STATE,
    "duel-snapshots": DEFAULT_DUEL_SNAPSHOTS_STATE,
    "price-history": DEFAULT_PRICE_HISTORY_STATE,
    "selected-price-set": null,
    "manual-price-overrides": DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
    "hiscores-last-player": { player }
  };
}

function buildExport(includeLastHiscoresPlayer = false) {
  return createWorkspaceBackupExport({
    gameData,
    liveState: liveState(),
    storageAccess: createBrowserStorageAccess(),
    includeLastHiscoresPlayer,
    now: new Date("2026-07-19T12:34:56.000Z")
  });
}

function mutableFile(text = buildExport().text): MutableWorkspaceFile {
  return JSON.parse(text) as MutableWorkspaceFile;
}

function stringify(value: MutableWorkspaceFile): string {
  return JSON.stringify(value);
}

function expectWorkspaceError(action: () => unknown, code: WorkspaceBackupError["code"]): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(WorkspaceBackupError);
    expect((error as WorkspaceBackupError).code).toBe(code);
    expect((error as Error).message).toBe(code);
    return;
  }
  throw new Error(`Expected WorkspaceBackupError(${code})`);
}

describe("Workspace backup V1 registry and envelope", () => {
  it("classifies every health descriptor exactly once with nine required areas", () => {
    const healthIds = LOCAL_STATE_HEALTH_DESCRIPTORS.map((descriptor) => descriptor.id).sort();
    const registryIds = (Object.keys(WORKSPACE_AREA_REGISTRY) as LocalStateHealthItemId[]).sort();

    expect(registryIds).toEqual(healthIds);
    expect(registryIds.filter((id) => WORKSPACE_AREA_REGISTRY[id].policy === "included")).toEqual(
      [...WORKSPACE_REQUIRED_AREA_IDS].sort()
    );
    expect(WORKSPACE_AREA_REGISTRY["hiscores-last-player"]).toMatchObject({
      policy: "sensitive-opt-in",
      required: false,
      localVersion: 1,
      restoreModes: ["replace"]
    });
    expect(WORKSPACE_AREA_REGISTRY["legacy-migration-dismissed"]).toEqual({
      id: "legacy-migration-dismissed",
      label: "Legacy migration dismissed state",
      policy: "excluded",
      required: false,
      localVersion: 1,
      restoreModes: []
    });
    for (const id of WORKSPACE_REQUIRED_AREA_IDS) {
      const registration = WORKSPACE_AREA_REGISTRY[id];
      expect(registration.required).toBe(true);
      expect(registration.codec.version).toBe(WORKSPACE_AREA_TRANSFER_VERSION);
    }
  });

  it("builds one validated nine-area export with null selected PriceSet and no raw storage envelope", () => {
    const exported = buildExport();
    const parsed = parseWorkspaceBackupText(exported.text);

    expect(exported.envelope).toMatchObject({
      kind: "index-sim-workspace",
      version: 1,
      exportedAt: "2026-07-19T12:34:56.000Z",
      context: {
        gameDataId: "lostcity-376072662e78-runtime",
        gameRevision: 274
      }
    });
    expect(exported.envelope.areas.map((area) => area.id)).toEqual(WORKSPACE_REQUIRED_AREA_IDS);
    expect(exported.envelope.areas).toHaveLength(9);
    expect(exported.envelope.areas.find((area) => area.id === "selected-price-set")?.data).toBe(
      null
    );
    expect(parsed.areas.every((area) => area.status === "ready")).toBe(true);
    expect(exported.byteSize).toBe(new TextEncoder().encode(exported.text).byteLength);
    expect(exported.fileName).toBe("index-sim-workspace-274-2026-07-19T12-34-56.000Z.json");
    expect(exported.text).not.toContain("hiscores-last-player");
    expect(exported.text).not.toContain("legacy-migration-dismissed");
    expect(exported.text).not.toContain("index-sim:rewrite-setup");
    expect(exported.text).not.toContain('"savedAt"');
  });

  it("adds only a normalized Hiscores record after an explicit opt-in", () => {
    const exported = buildExport(true);
    const parsed = parseWorkspaceBackupText(exported.text);
    const hiscores = parsed.areas.find((area) => area.id === "hiscores-last-player");

    expect(exported.envelope.areas).toHaveLength(10);
    expect(hiscores).toEqual({
      id: "hiscores-last-player",
      version: 1,
      status: "ready",
      data: { player: "Rune Hero" }
    });
    expect(exported.text).not.toContain("legacy-migration-dismissed");
  });

  it("requires the App-selected BrowserStorageAccess capability without reading raw storage", () => {
    let readCount = 0;
    const access = createBrowserStorageAccess();
    const storageAccess = {
      ...access,
      storage: {
        ...createMemoryStorage(),
        getItem: () => {
          readCount += 1;
          return "raw private local state";
        }
      }
    };

    const exported = createWorkspaceBackupExport({
      gameData,
      liveState: liveState(),
      storageAccess,
      now: new Date("2026-07-19T12:34:56.000Z")
    });

    expect(readCount).toBe(0);
    expect(exported.text).not.toContain("raw private local state");
  });

  it("rejects duplicate JSON keys before materializing a candidate", () => {
    const text = buildExport().text.replace(
      '"kind": "index-sim-workspace"',
      '"kind": "index-sim-workspace",\n  "kind": "index-sim-workspace"'
    );
    expectWorkspaceError(() => parseWorkspaceBackupText(text), "duplicate_keys");
    expectWorkspaceError(() => parseWorkspaceBackupText('{"kind":'), "invalid_json");
  });

  it("rejects duplicate, missing and unknown area ids", () => {
    const duplicate = mutableFile();
    duplicate.areas[1] = { ...duplicate.areas[0] };
    expectWorkspaceError(() => parseWorkspaceBackupText(stringify(duplicate)), "duplicate_area");

    const missing = mutableFile();
    missing.areas.pop();
    expectWorkspaceError(() => parseWorkspaceBackupText(stringify(missing)), "missing_area");

    const unknown = mutableFile();
    unknown.areas[0].id = "future-untrusted-area";
    expectWorkspaceError(() => parseWorkspaceBackupText(stringify(unknown)), "unknown_area");

    const excluded = mutableFile();
    excluded.areas[0].id = "legacy-migration-dismissed";
    expectWorkspaceError(() => parseWorkspaceBackupText(stringify(excluded)), "unknown_area");
  });

  it("keeps unsupported and malformed known areas unselectable without retaining raw data", () => {
    const unsupported = mutableFile();
    const unsupportedArea = unsupported.areas.find((area) => area.id === "rewrite-setup");
    if (!unsupportedArea) throw new Error("missing setup fixture area");
    unsupportedArea.version = 2;
    unsupportedArea.data = { secret: "unsupported raw secret" };
    const unsupportedParsed = parseWorkspaceBackupText(stringify(unsupported));
    expect(unsupportedParsed.areas.find((area) => area.id === "rewrite-setup")).toEqual({
      id: "rewrite-setup",
      version: 2,
      status: "unsupported-version",
      reason: "unsupported_area_version"
    });
    expect(JSON.stringify(unsupportedParsed)).not.toContain("unsupported raw secret");

    const malformed = mutableFile();
    const malformedArea = malformed.areas.find((area) => area.id === "hidden-gear-tiers");
    if (!malformedArea) throw new Error("missing hidden tiers fixture area");
    malformedArea.data = { bronze: "private malformed value" };
    const malformedParsed = parseWorkspaceBackupText(stringify(malformed));
    expect(malformedParsed.areas.find((area) => area.id === "hidden-gear-tiers")).toEqual({
      id: "hidden-gear-tiers",
      version: 1,
      status: "invalid-data",
      reason: "invalid_area_data"
    });
    expect(JSON.stringify(malformedParsed)).not.toContain("private malformed value");
  });

  it("rejects duplicate Duel and price-history identities inside otherwise valid areas", () => {
    const duplicateDuel = mutableFile();
    const duel = duplicateDuel.areas.find((area) => area.id === "duel-snapshots")!;
    duel.data = {
      snapshots: [
        { id: "duplicate", name: "First", form: DEFAULT_FORM_STATE },
        { id: "duplicate", name: "Second", form: DEFAULT_FORM_STATE }
      ]
    };
    expect(
      parseWorkspaceBackupText(stringify(duplicateDuel)).areas.find(
        (area) => area.id === "duel-snapshots"
      )
    ).toMatchObject({ status: "invalid-data" });

    const duplicateHistory = mutableFile();
    const history = duplicateHistory.areas.find((area) => area.id === "price-history")!;
    const snapshot = {
      capturedAt: "2026-07-19T12:00:00.000Z",
      sourcePriceSetId: "duplicate",
      label: "Duplicate history",
      itemPrices: { lobster: 100 }
    };
    history.data = { snapshots: [snapshot, snapshot] };
    expect(
      parseWorkspaceBackupText(stringify(duplicateHistory)).areas.find(
        (area) => area.id === "price-history"
      )
    ).toMatchObject({ status: "invalid-data" });
  });

  it("rejects wrong envelope identity and non-strict envelope or area fields", () => {
    const wrongKind = mutableFile();
    wrongKind.kind = "another-workspace";
    expectWorkspaceError(() => parseWorkspaceBackupText(stringify(wrongKind)), "unsupported_kind");

    const wrongVersion = mutableFile();
    wrongVersion.version = 2;
    expectWorkspaceError(
      () => parseWorkspaceBackupText(stringify(wrongVersion)),
      "unsupported_version"
    );

    const extraEnvelopeField = mutableFile();
    extraEnvelopeField.extra = "private";
    expectWorkspaceError(
      () => parseWorkspaceBackupText(stringify(extraEnvelopeField)),
      "invalid_envelope"
    );

    const extraAreaField = mutableFile();
    extraAreaField.areas[0].extra = "private";
    expectWorkspaceError(
      () => parseWorkspaceBackupText(stringify(extraAreaField)),
      "invalid_envelope"
    );
  });

  it("uses a 10,000,000-byte UTF-8 cap and rejects unsafe prototype keys", () => {
    expect(WORKSPACE_BACKUP_IMPORT_MAX_BYTES).toBe(10_000_000);
    expectWorkspaceError(() => parseWorkspaceBackupText('"ää"', 5), "body_too_large");

    const unsafe = buildExport().text.replace(
      '"form": {',
      '"__proto__": {"polluted": true},\n        "form": {'
    );
    expectWorkspaceError(() => parseWorkspaceBackupText(unsafe), "unsafe_key");
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("sanitizes every dynamic file-name segment", () => {
    const fileName = createWorkspaceBackupFileName("../274 private", "../../19:00 / secret");
    expect(fileName).toMatch(/^index-sim-workspace-[A-Za-z0-9._-]+-[A-Za-z0-9._-]+\.json$/);
    expect(fileName).not.toContain("/");
    expect(fileName).not.toContain(" ");
  });
});
