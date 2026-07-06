import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { ZodError } from "zod";
import { lookupItemPrice, collectMissingPriceWarnings } from "../domain/economy";
import {
  DataReliabilityError,
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  parseJsonWithDuplicateKeyCheck,
  type LegacySnapshotInput
} from "../data";
import {
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceHistorySchema,
  PriceSetSchema,
  PriceSetValidationError,
  createPriceSetFromLegacyRecords,
  parsePriceSetJson
} from "../data/schemas";
import { createLegacyRuntime } from "./helpers/legacy-sim";

function readTextFile(fileName: string): string {
  return readFileSync(join(process.cwd(), fileName), "utf8");
}

function readJsonFile(fileName: string): unknown {
  return parseJsonWithDuplicateKeyCheck(readTextFile(fileName), { source: fileName });
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

function expectDataReliabilityError(
  action: () => unknown,
  code: DataReliabilityError["code"]
): DataReliabilityError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DataReliabilityError);
    expect((error as DataReliabilityError).code).toBe(code);
    return error as DataReliabilityError;
  }
  throw new Error(`Expected DataReliabilityError with code ${code}`);
}

function expectGameDataSchemaError(action: () => unknown): ZodError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
    return error as ZodError;
  }
  throw new Error("Expected ZodError");
}

function minimalLegacyInput(loot: unknown): LegacySnapshotInput {
  return {
    gameData: {
      MONSTERS: [{ id: "rat", name: "Rat", hp: 2, loot }] as Array<Record<string, unknown>>,
      ITEM_PRICES: { bones: 1, coins: 1 },
      ALCH_VALUES: {}
    },
    simEngine: {
      WEAPONS: {},
      ARROWS: {},
      SPELLS: {}
    },
    equipment: {
      SLOT_DEFS: []
    }
  };
}

function jsPropertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (!("name" in property) || property.name === undefined) return null;
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function findDuplicateObjectLiteralKeys(sourceText: string, sourceLabel: string): string[] {
  const sourceFile = ts.createSourceFile(
    sourceLabel,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const issues: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Map<string, number>();
      for (const property of node.properties) {
        const key = jsPropertyName(property);
        if (key === null) continue;
        const previous = seen.get(key);
        if (previous !== undefined) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.getStart());
          issues.push(
            `${sourceLabel}:${line + 1}:${character + 1} duplicates object key '${key}' first seen at property ${previous + 1}`
          );
        } else {
          seen.set(key, seen.size);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return issues;
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

  it("rejects duplicate legacy monster ids before object conversion can hide them", () => {
    const runtime = createLegacyRuntime();
    const duplicatedMonster = { ...runtime.GameData.MONSTERS[0], id: "chicken" };
    const error = expectDataReliabilityError(
      () =>
        createGameDataSnapshotFromLegacy({
          gameData: {
            ...runtime.GameData,
            MONSTERS: [...runtime.GameData.MONSTERS, duplicatedMonster]
          },
          simEngine: runtime.SimEngine,
          equipment: runtime.Equipment as unknown as LegacySnapshotInput["equipment"]
        }),
      "duplicate_ids"
    );

    expect(error.issues.join("\n")).toContain("chicken");
    expect(error.message).not.toContain(process.cwd());
  });

  it.each([
    ["missing name", [{ key: "bones", chance: 1, qtyAvg: 1 }], "name"],
    ["missing chance", [{ name: "Bones", key: "bones", qtyAvg: 1 }], "chance"],
    ["chance over one", [{ name: "Bones", key: "bones", chance: 1.25, qtyAvg: 1 }], "chance"],
    ["missing qtyAvg", [{ name: "Bones", key: "bones", chance: 1 }], "qtyAvg"],
    ["negative qtyAvg", [{ name: "Bones", key: "bones", chance: 1, qtyAvg: -1 }], "qtyAvg"],
    [
      "malformed nested expand row",
      [
        {
          name: "Random table",
          chance: 0.5,
          qtyAvg: 1,
          _expand: [{ weight: 1, price: 10 }]
        }
      ],
      "_expand"
    ],
    [
      "empty nested expand row",
      [
        {
          name: "Random table",
          chance: 0.5,
          qtyAvg: 1,
          _expand: [{ name: "Empty row" }]
        }
      ],
      "_expand"
    ]
  ])("rejects malformed loot entries: %s", (_caseName, loot, expectedPath) => {
    const error = expectGameDataSchemaError(() =>
      createGameDataSnapshotFromLegacy(minimalLegacyInput(loot))
    );
    const issueText = JSON.stringify(error.issues);
    expect(issueText).toContain(expectedPath);
    expect(issueText).not.toContain(process.cwd());
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

  it("gates committed raw data files for duplicate keys before object parsing", () => {
    expect(() => readJsonFile("prices.json")).not.toThrow();
    expect(() => readJsonFile("alch.json")).not.toThrow();
    expect(() => readJsonFile("price-history.json")).not.toThrow();
  });

  it("detects duplicate object keys in JavaScript source fixtures", () => {
    expect(findDuplicateObjectLiteralKeys("const data = { lobster: 200, lobster: 250 };", "fixture"))
      .toEqual(["fixture:1:30 duplicates object key 'lobster' first seen at property 1"]);
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

  it("rejects duplicate keys in imported PriceSet JSON before JSON.parse drops values", () => {
    const duplicateJson = `{
      "id": "manual-check",
      "label": "Manual check",
      "source": "manual",
      "createdAt": "2026-07-06",
      "itemPrices": { "lobster": 200, "lobster": 250 },
      "alchValues": { "lobster": 0 }
    }`;

    const error = expectPriceSetError(() => parsePriceSetJson(duplicateJson), "duplicate_keys");
    expect(error.issues.join("\n")).toContain("itemPrices.lobster");
    expect(error.issues.join("\n")).not.toContain(process.cwd());
    expect(error.message).not.toContain(process.cwd());
  });

  it("detects duplicate raw data keys in synthetic fixtures", () => {
    const error = expectDataReliabilityError(
      () =>
        parseJsonWithDuplicateKeyCheck(
          `{"items":{"bones":{"name":"Bones"},"bones":{"name":"Other bones"}}}`,
          { source: "synthetic game data" }
        ),
      "duplicate_keys"
    );

    expect(error.issues.join("\n")).toContain("items.bones");
    expect(error.message).not.toContain(process.cwd());
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
