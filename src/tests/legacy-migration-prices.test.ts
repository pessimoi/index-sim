import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import { createMemoryStorage } from "../adapters/storage";
import { inspectLegacySetupMigration } from "../app/state/legacy-storage-migration";
import type { GameDataSnapshot, PriceSet } from "../domain/shared";

describe("legacy price migration", () => {
  let gameData: GameDataSnapshot;

  beforeAll(async () => {
    const loaded = await loadBundledLegacyContext();
    gameData = loaded.context.gameData;
  });

  it("turns valid legacy price and alch maps into an explicit price set", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: 224, big_bones: 390 }),
      sim_alch_v1: JSON.stringify({ lobster: 90, big_bones: 0 }),
      sim_scraped_at_v1: "1700000000"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toMatchObject({
      id: "legacy-browser-prices",
      label: "Legacy browser prices",
      source: "imported",
      createdAt: "2023-11-14T22:13:20.000Z",
      itemPrices: { lobster: 224, big_bones: 390 }
    });
    expect(report.priceSet?.alchValues.lobster).toBe(gameData.items.lobster.alch);
    expect(report.priceSet?.alchValues.big_bones).toBe(gameData.items.big_bones.alch);
    expect(report.warnings).toContain(
      "Legacy high-alch overrides were replaced with current generated game data."
    );
    expect(report.importedFields).toContain("prices.priceSet");
  });

  it("skips malformed legacy price JSON safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: "{bad json",
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "sim_prices_v1", reason: "invalid JSON" },
        { field: "prices.priceSet", reason: "legacy price set could not be parsed safely" }
      ])
    );
  });

  it("skips duplicate-key legacy price JSON safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: '{"lobster":100,"lobster":200}',
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "sim_prices_v1", reason: "invalid JSON" },
        { field: "prices.priceSet", reason: "legacy price set could not be parsed safely" }
      ])
    );
  });

  it("skips invalid legacy price maps safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: -1 }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "prices.priceSet",
      reason: "legacy price set failed schema validation"
    });
  });

  it("skips unknown legacy price item ids safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ not_a_real_item: 12 }),
      sim_alch_v1: JSON.stringify({ not_a_real_item: 0 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "prices.priceSet",
      reason: "legacy price set includes unknown item ids"
    });
  });

  it("skips oversized legacy price payloads before parsing", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: 224, pad: "x".repeat(50) }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxPriceBytes: 20
    });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "sim_prices_v1", reason: "legacy value exceeds safe size limit" },
        { field: "prices.priceSet", reason: "legacy price set could not be parsed safely" }
      ])
    );
  });

  it("keeps the current price set when legacy price import fails", () => {
    const currentPriceSet: PriceSet = {
      id: "current-prices",
      label: "Current prices",
      source: "bundled",
      createdAt: "2026-07-05T12:00:00.000Z",
      itemPrices: { lobster: 203 },
      alchValues: { lobster: 90 }
    };
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: -1 }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });
    const selectedPriceSet = report.priceSet ?? currentPriceSet;

    expect(selectedPriceSet).toBe(currentPriceSet);
  });
});
