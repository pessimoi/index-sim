import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lookupItemPrice, collectMissingPriceWarnings } from "../domain/economy";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../data/legacy-adapter";
import {
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceHistorySchema,
  PriceSetSchema,
  PriceSetValidationError,
  createPriceSetFromLegacyRecords,
  parsePriceSetJson
} from "../data/schemas";
import { createLegacyRuntime } from "./helpers/legacy-sim";

function readJsonFile(fileName: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), fileName), "utf8"));
}

function expectPriceSetError(
  action: () => unknown,
  code: PriceSetValidationError["code"]
): PriceSetValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PriceSetValidationError);
    expect((error as PriceSetValidationError).code).toBe(code);
    return error as PriceSetValidationError;
  }
  throw new Error(`Expected PriceSetValidationError with code ${code}`);
}

describe("validated game data snapshots", () => {
  it("adapts the current legacy runtime into a validated GameDataSnapshot", () => {
    const runtime = createLegacyRuntime();
    const snapshot = createGameDataSnapshotFromLegacy({
      gameData: runtime.GameData,
      simEngine: runtime.SimEngine,
      equipment: runtime.Equipment as unknown as LegacySnapshotInput["equipment"]
    });

    expect(snapshot.id).toBe("legacy-runtime");
    expect(snapshot.provenance?.source).toBe("manual");
    expect(Object.keys(snapshot.monsters).length).toBeGreaterThan(20);
    expect(snapshot.monsters.chicken?.loot?.length).toBeGreaterThan(0);
    expect(snapshot.weapons.rune_scimitar?.type).toBe("melee");
    expect(snapshot.equipment.ring.ring_of_recoil?.recoil).toBe(true);
    expect(snapshot.items.dragon_bones?.name).toMatch(/dragon bones/i);
  });

  it("creates a validated bundled PriceSet from the legacy runtime without metadata keys", () => {
    const runtime = createLegacyRuntime();
    const priceSet = createPriceSetFromLegacyGameData({ gameData: runtime.GameData });

    expect(PriceSetSchema.parse(priceSet)).toMatchObject({
      id: "legacy-bundled-prices",
      source: "bundled"
    });
    expect(priceSet.itemPrices.dragon_bones).toBeGreaterThan(0);
    expect(priceSet.itemPrices).not.toHaveProperty("_scraped_at");
    expect(priceSet.itemPrices).not.toHaveProperty("_randomherb_avg");
    expect(priceSet.alchValues).not.toHaveProperty("_randomherb_avg");
  });
});

describe("price file schemas", () => {
  it("validates committed prices, alch values and price history", () => {
    const priceSet = createPriceSetFromLegacyRecords({
      id: "legacy-price-files",
      label: "Legacy price files",
      itemPrices: readJsonFile("prices.json"),
      alchValues: readJsonFile("alch.json")
    });
    const priceHistory = PriceHistorySchema.parse(readJsonFile("price-history.json"));

    expect(priceSet.itemPrices.rune_scimitar).toBeGreaterThan(0);
    expect(priceSet.alchValues.rune_scimitar).toBeGreaterThan(0);
    expect(priceSet.itemPrices).not.toHaveProperty("_scraped_at");
    expect(priceHistory.length).toBeGreaterThan(0);
    expect(priceHistory[0]?.prices.rune_scimitar).toBeGreaterThan(0);
  });

  it("rejects malformed imported PriceSet JSON with sanitized errors", () => {
    const validImport = {
      id: "manual-check",
      label: "Manual check",
      source: "manual",
      createdAt: "2026-07-05",
      itemPrices: { lobster: 200 },
      alchValues: { lobster: 0 }
    };

    expect(parsePriceSetJson(JSON.stringify(validImport))).toMatchObject({
      id: "manual-check",
      source: "manual"
    });

    expectPriceSetError(
      () => parsePriceSetJson(" ".repeat(PRICE_SET_IMPORT_MAX_BYTES + 1)),
      "body_too_large"
    );
    expectPriceSetError(() => parsePriceSetJson("{not-json"), "invalid_json");

    const validationError = expectPriceSetError(
      () =>
        parsePriceSetJson(
          JSON.stringify({
            ...validImport,
            itemPrices: { lobster: -1, shark: "expensive" }
          })
        ),
      "validation_failed"
    );
    const issueText = validationError.issues.join("\n");
    expect(issueText).toContain("itemPrices.lobster");
    expect(issueText).toContain("itemPrices.shark");
    expect(issueText).not.toContain(process.cwd());
    expect(validationError.message).not.toContain(process.cwd());
  });
});

describe("economy price lookup warnings", () => {
  it("reports missing prices without mutating the PriceSet", () => {
    const priceSet = PriceSetSchema.parse({
      id: "test-prices",
      label: "Test prices",
      source: "manual",
      createdAt: "2026-07-05",
      itemPrices: { lobster: 200 },
      alchValues: {}
    });
    const originalPrices = { ...priceSet.itemPrices };

    expect(lookupItemPrice(priceSet, "lobster")).toEqual({ itemId: "lobster", value: 200 });
    expect(lookupItemPrice(priceSet, "missing_item")).toMatchObject({
      itemId: "missing_item",
      value: null,
      warning: {
        code: "missing-price",
        severity: "warning",
        itemId: "missing_item",
        priceSetId: "test-prices"
      }
    });
    expect(priceSet.itemPrices).toEqual(originalPrices);
    expect(collectMissingPriceWarnings(priceSet, ["lobster", "missing_item"])).toHaveLength(1);
  });
});
