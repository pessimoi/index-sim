import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  captureShareableSetupFragment,
  createShareableSetupUrl,
  writeShareableSetupToClipboard
} from "../adapters/browser/shareable-url";
import { loadGeneratedRuntimeContext } from "../adapters/generated";
import {
  SHAREABLE_SETUP_MAX_ENCODED_CHARS,
  SHAREABLE_SETUP_MAX_JSON_BYTES,
  ShareableSetupError,
  applyShareableSetup,
  buildShareableSetupEnvelope,
  decodeShareableSetupEnvelope,
  encodeShareableSetupEnvelope,
  reviewShareableSetup,
  type ShareableSetupEnvelopeV1
} from "../app/state/shareable-setup";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  normalizeFormState
} from "../app/state/ui-state";
import { DEFAULT_MONSTER_LOOT_SETTINGS } from "../app/state/loot-settings";
import type { SimulationContext } from "../domain/shared";
import { lootPreferenceKeysForMonster } from "../domain/trip";

function encodeRawText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fixtureEnvelope(gameDataId: string): ShareableSetupEnvelopeV1 {
  return buildShareableSetupEnvelope({
    gameDataId,
    form: normalizeFormState(DEFAULT_FORM_STATE),
    cannon: DEFAULT_CANNON_SETTINGS,
    lootPreferences: {},
    lootSettings: DEFAULT_MONSTER_LOOT_SETTINGS
  });
}

describe("shareable setup contract", () => {
  let context: SimulationContext;

  beforeAll(async () => {
    context = (await loadGeneratedRuntimeContext()).context;
  });

  it("round trips a deterministic versioned setup without local collections or prices", () => {
    const envelope = fixtureEnvelope(context.gameData.id);
    const first = encodeShareableSetupEnvelope(envelope);
    const second = encodeShareableSetupEnvelope(envelope);
    const decoded = decodeShareableSetupEnvelope(first);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toContain("=");
    expect(decoded).toEqual(envelope);
    expect(Object.keys(decoded.data).sort()).toEqual([
      "cannon",
      "form",
      "lootPreferences",
      "lootSettings"
    ]);
    expect(JSON.stringify(decoded)).not.toMatch(
      /priceSet|priceHistory|duel|playerName|provenance/i
    );
  });

  it("rejects malformed encodings, duplicate keys, unsupported versions and implicit defaults", () => {
    expect(() => decodeShareableSetupEnvelope("%%%")).toThrowError(ShareableSetupError);
    expect(() =>
      decodeShareableSetupEnvelope(encodeRawText('{"kind":"index-sim-setup","kind":"x"}'))
    ).toThrowError(expect.objectContaining({ code: "duplicate_keys" }));
    expect(() =>
      decodeShareableSetupEnvelope(
        encodeRawText(JSON.stringify({ ...fixtureEnvelope(context.gameData.id), version: 2 }))
      )
    ).toThrowError(expect.objectContaining({ code: "unsupported_version" }));

    const missingHitpoints = fixtureEnvelope(context.gameData.id) as unknown as Record<
      string,
      unknown
    >;
    const data = missingHitpoints.data as Record<string, unknown>;
    const form = data.form as Record<string, unknown>;
    const levels = form.levels as Record<string, unknown>;
    delete levels.hitpoints;
    expect(() =>
      decodeShareableSetupEnvelope(encodeRawText(JSON.stringify(missingHitpoints)))
    ).toThrowError(expect.objectContaining({ code: "invalid_schema" }));
  });

  it("enforces encoded and decoded payload limits before applying data", () => {
    expect(() =>
      decodeShareableSetupEnvelope("a".repeat(SHAREABLE_SETUP_MAX_ENCODED_CHARS + 1))
    ).toThrowError(expect.objectContaining({ code: "body_too_large" }));

    const envelope = fixtureEnvelope(context.gameData.id);
    envelope.data.lootPreferences = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => [
        `${index}-${"x".repeat(100)}`,
        index % 2 === 0 ? "loot" : "skip"
      ])
    );
    expect(new TextEncoder().encode(JSON.stringify(envelope)).byteLength).toBeGreaterThan(
      SHAREABLE_SETUP_MAX_JSON_BYTES
    );
    expect(() => encodeShareableSetupEnvelope(envelope)).toThrowError(
      expect.objectContaining({ code: "body_too_large" })
    );
  });

  it("reports game-data mismatches, rejects unknown setup entities and drops stale loot rows", () => {
    const envelope = fixtureEnvelope("older-game-data");
    envelope.data.lootPreferences = { "missing-row": "loot" };
    const review = reviewShareableSetup(envelope, context.gameData);

    expect(review.gameDataMismatch).toBe(true);
    expect(review.droppedLootRowCount).toBe(1);
    expect(review.envelope.data.lootPreferences).toEqual({});

    const incompatible = structuredClone(envelope);
    incompatible.data.form.perStyleLoadouts.melee.weaponId = "missing_weapon";
    expect(() => reviewShareableSetup(incompatible, context.gameData)).toThrowError(
      expect.objectContaining({ code: "incompatible_entities" })
    );
  });

  it("applies only the target setup state, preserves unrelated rows and returns a complete undo", () => {
    const envelope = fixtureEnvelope(context.gameData.id);
    const lootRowId = lootPreferenceKeysForMonster(context.gameData.monsters.giant)[0] ?? "";
    expect(lootRowId).toBeTruthy();
    envelope.data.cannon = { enabled: true, targets: 4, respawnSec: 18 };
    envelope.data.lootPreferences = { [lootRowId]: "bury" };
    envelope.data.lootSettings = {
      highAlch: true,
      overheadSec: 3,
      talismanSpot: "overground"
    };
    const review = reviewShareableSetup(envelope, context.gameData);
    const current = {
      form: normalizeFormState({ ...DEFAULT_FORM_STATE, monsterId: "dragon_blue" }),
      cannonByMonster: {
        dragon_blue: { enabled: true, targets: 2, respawnSec: null }
      },
      lootPrefsByMonster: { dragon_blue: { "dragon_blue:bones:0": "bury" as const } },
      lootSettingsByMonster: {
        dragon_blue: { overheadSec: 4, talismanSpot: "underground" as const }
      }
    };
    const original = structuredClone(current);

    const result = applyShareableSetup(current, review);

    expect(current).toEqual(original);
    expect(result.undo).toEqual(original);
    expect(result.state.form.monsterId).toBe("giant");
    expect(result.state.cannonByMonster.giant).toEqual(envelope.data.cannon);
    expect(result.state.lootPrefsByMonster.giant).toEqual(envelope.data.lootPreferences);
    expect(result.state.lootSettingsByMonster.giant).toEqual(envelope.data.lootSettings);
    expect(result.state.cannonByMonster.dragon_blue).toEqual(current.cannonByMonster.dragon_blue);
  });

  it("removes explicit target entries when a shared setup uses effective defaults", () => {
    const review = reviewShareableSetup(fixtureEnvelope(context.gameData.id), context.gameData);
    const result = applyShareableSetup(
      {
        form: normalizeFormState(DEFAULT_FORM_STATE),
        cannonByMonster: { giant: { enabled: false, targets: 5, respawnSec: 20 } },
        lootPrefsByMonster: { giant: { "giant:bones:0": "bury" } },
        lootSettingsByMonster: {
          giant: { highAlch: true, overheadSec: 5, talismanSpot: "overground" }
        }
      },
      review
    );

    expect(result.state.cannonByMonster.giant).toBeUndefined();
    expect(result.state.lootPrefsByMonster.giant).toBeUndefined();
    expect(result.state.lootSettingsByMonster.giant).toBeUndefined();
  });
});

describe("shareable setup browser URL adapter", () => {
  it("creates root and sub-path URLs without carrying query or old fragment state", () => {
    expect(
      createShareableSetupUrl("abc", {
        origin: "https://example.test",
        pathname: "/",
        search: "?debug=1",
        hash: "#old=1"
      })
    ).toBe("https://example.test/#setup=abc");
    expect(
      createShareableSetupUrl("abc", {
        origin: "https://example.test",
        pathname: "/sim/",
        search: "",
        hash: ""
      })
    ).toBe("https://example.test/sim/#setup=abc");
  });

  it("captures setup once and removes only that fragment parameter", () => {
    const replaceState = vi.fn();
    const payload = captureShareableSetupFragment(
      {
        origin: "https://example.test",
        pathname: "/sim/",
        search: "?mode=test",
        hash: "#setup=abc&pane=trip"
      },
      { replaceState }
    );

    expect(payload).toBe("abc");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/sim/?mode=test#pane=trip");
  });

  it("uses the Clipboard API when available and keeps failures non-fatal", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(writeShareableSetupToClipboard("link", { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("link");

    await expect(
      writeShareableSetupToClipboard("link", {
        writeText: vi.fn().mockRejectedValue(new Error("denied"))
      })
    ).resolves.toBe(false);
    await expect(writeShareableSetupToClipboard("link", null)).resolves.toBe(false);
  });
});
