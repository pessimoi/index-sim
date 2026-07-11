import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  REWRITE_SETUP_VERSION,
  DEFAULT_FORM_STATE,
  savedSetupFromForm
} from "../app/state/ui-state";
import {
  SETUP_IMPORT_MAX_BYTES,
  SetupImportError,
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
    expect(parsed.data.form.monsterId).toBe("giant");
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
