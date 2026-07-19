import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  REWRITE_SETUP_VERSION,
  DEFAULT_FORM_STATE,
  savedSetupFromForm
} from "../app/state/ui-state";
import {
  SETUP_IMPORT_MAX_BYTES,
  SetupImportError,
  createRewriteSetupTransferEnvelope,
  parseSavedSetupExportText
} from "../app/state/setup-import";

function setupExportText(): string {
  return JSON.stringify({
    version: REWRITE_SETUP_VERSION,
    savedAt: "2026-07-11T12:00:00.000Z",
    data: savedSetupFromForm(DEFAULT_FORM_STATE)
  });
}

function expectSetupImportError(text: string, code: SetupImportError["code"], maxBytes?: number) {
  const { context } = createGeneratedRuntimeContext();
  try {
    parseSavedSetupExportText(text, context.gameData, maxBytes);
  } catch (error) {
    expect(error).toBeInstanceOf(SetupImportError);
    expect((error as SetupImportError).code).toBe(code);
    return error as SetupImportError;
  }
  throw new Error(`Expected setup import error ${code}`);
}

describe("rewrite setup import boundary", () => {
  it("accepts a current schema and current GameDataSnapshot export", () => {
    const { context } = createGeneratedRuntimeContext();
    const parsed = parseSavedSetupExportText(setupExportText(), context.gameData);

    expect(parsed.version).toBe(REWRITE_SETUP_VERSION);
    expect(parsed.format).toBe("legacy-storage-v3");
    expect(parsed.context).toBeNull();
    expect(parsed.data.form.monsterId).toBe("giant");
  });

  it("round trips the dedicated contextual envelope without prices or provenance", () => {
    const { context } = createGeneratedRuntimeContext();
    const envelope = createRewriteSetupTransferEnvelope(
      savedSetupFromForm(DEFAULT_FORM_STATE),
      context.gameData,
      new Date("2026-07-19T08:00:00.000Z")
    );
    const parsed = parseSavedSetupExportText(JSON.stringify(envelope), context.gameData);

    expect(parsed).toMatchObject({
      format: "contextual-v1",
      version: 1,
      exportedAt: "2026-07-19T08:00:00.000Z",
      context: { gameDataId: context.gameData.id, gameRevision: 274 }
    });
    expect(JSON.stringify(envelope)).not.toMatch(
      /priceSet|priceHistory|playerName|sourceCommit|generatedAt|provenance/i
    );

    const sameRevision = structuredClone(envelope);
    sameRevision.context.gameDataId = "another-revision-274-snapshot";
    expect(
      parseSavedSetupExportText(JSON.stringify(sameRevision), context.gameData).context
    ).toEqual({ gameDataId: "another-revision-274-snapshot", gameRevision: 274 });
  });

  it("rejects duplicate keys, malformed JSON, unsupported versions and oversized input", () => {
    const duplicateVersion = setupExportText().replace(
      `"version":${REWRITE_SETUP_VERSION}`,
      `"version":${REWRITE_SETUP_VERSION},"version":${REWRITE_SETUP_VERSION}`
    );
    expectSetupImportError(duplicateVersion, "duplicate_keys");
    expectSetupImportError("{bad", "invalid_json");
    expectSetupImportError(
      setupExportText().replace(
        `"version":${REWRITE_SETUP_VERSION}`,
        `"version":${REWRITE_SETUP_VERSION + 1}`
      ),
      "unsupported_version"
    );
    expectSetupImportError(setupExportText(), "body_too_large", 1);
    expectSetupImportError(
      JSON.stringify({ kind: "another-app", version: 1, exportedAt: "now", data: {} }),
      "unsupported_version"
    );
    expect(SETUP_IMPORT_MAX_BYTES).toBeGreaterThan(0);
  });

  it("rejects schema-valid setup entities that are unavailable in the current revision", () => {
    const envelope = JSON.parse(setupExportText()) as {
      data: ReturnType<typeof savedSetupFromForm>;
    };
    envelope.data.form.monsterId = "missing_monster";
    const error = expectSetupImportError(JSON.stringify(envelope), "incompatible_entities");

    expect(error.issues).toContain("form.monsterId");
    expect(JSON.stringify(error.issues)).not.toContain("missing_monster");
  });

  it("rejects unavailable custom-setup and cannon map keys without exposing their values", () => {
    const envelope = JSON.parse(setupExportText()) as {
      data: ReturnType<typeof savedSetupFromForm>;
    };
    envelope.data.customSetupsByMonster = {
      unavailable_custom_target: {
        ...DEFAULT_FORM_STATE,
        monsterId: "unavailable_custom_target"
      }
    };
    envelope.data.cannonByMonster = {
      unavailable_cannon_target: { enabled: true, targets: 3, respawnSec: null }
    };
    const error = expectSetupImportError(JSON.stringify(envelope), "incompatible_entities");

    expect(error.issues).toContain("customSetupsByMonster[0].monsterId");
    expect(error.issues).toContain("cannonByMonster[0].monsterId");
    expect(JSON.stringify(error.issues)).not.toContain("unavailable_");
  });

  it("rejects schema-valid but impossible weapon, ammo and shield combinations", () => {
    const envelope = JSON.parse(setupExportText()) as {
      data: ReturnType<typeof savedSetupFromForm>;
    };
    envelope.data.form.perStyleLoadouts.ranged.gear.shield = "rune_kite";
    envelope.data.form.perStyleLoadouts.ranged.ammoId = "rune_dart";
    const error = expectSetupImportError(JSON.stringify(envelope), "incompatible_entities");

    expect(error.issues).toEqual(
      expect.arrayContaining([
        "form.perStyleLoadouts.ranged.gear.shield",
        "form.perStyleLoadouts.ranged.ammoId"
      ])
    );
  });
});
