import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARKET_SOURCE_ITEM_ALLOWLIST,
  MARKET_SOURCE_MAPPINGS,
  MARKET_SOURCE_MAPPING_PROVENANCE
} from "../data/market-source-mapping";
import {
  HISCORES_PLAYER_MAX_CHARS,
  IntegrationErrorResponseSchema,
  LIVE_INTEGRATION_JSON_MAX_BYTES,
  LiveIntegrationValidationError,
  MARKET_SYNC_MAX_ITEMS,
  createPriceSetFromMarketFixtureItems,
  parseHiscoresLookupRequest,
  parseHiscoresResponse,
  parseHiscoresResponseJson,
  parseMarketSourceMappings,
  parseMarketSyncRequest,
  parseMarketSyncRequestJson,
  parseMarketSyncResponse,
  parseMarketUpstreamFixtureItems,
  validateMarketSourceMappingCoverage
} from "../data/schemas";

function readFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src/tests/fixtures/live-integrations", fileName), "utf8")
  ) as unknown;
}

function readFixtureText(fileName: string): string {
  return readFileSync(
    join(process.cwd(), "src/tests/fixtures/live-integrations", fileName),
    "utf8"
  );
}

function expectLiveIntegrationError(
  action: () => unknown,
  code: LiveIntegrationValidationError["code"]
): LiveIntegrationValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(LiveIntegrationValidationError);
    expect((error as LiveIntegrationValidationError).code).toBe(code);
    return error as LiveIntegrationValidationError;
  }
  throw new Error(`Expected LiveIntegrationValidationError with code ${code}`);
}

describe("hiscores integration schemas", () => {
  it("validates a mocked hiscores success fixture", () => {
    const response = parseHiscoresResponse(readFixture("hiscores-api-success.json"));

    expect(response.player).toBe("Fixture Player");
    expect(response.skills.attack?.level).toBe(61);
    expect(response.skills.magic?.xp).toBe(203254);
    expect(response.warnings).toHaveLength(0);
  });

  it("validates a mocked hiscores not-found error fixture", () => {
    const response = IntegrationErrorResponseSchema.parse(
      readFixture("hiscores-api-not-found.json")
    );

    expect(response.error.code).toBe("not-found");
    expect(response.warnings?.[0]?.severity).toBe("info");
  });

  it("sanitizes invalid JSON and invalid skill levels", () => {
    expectLiveIntegrationError(() => parseHiscoresResponseJson("{not-json"), "invalid_json");
    expectLiveIntegrationError(
      () =>
        parseHiscoresResponseJson(
          readFixtureText("hiscores-api-success.json").replace(
            '"player": "Fixture Player"',
            '"player": "Fixture Player", "player": "Shadowed Player"'
          )
        ),
      "invalid_json"
    );

    const successFixture = readFixture("hiscores-api-success.json") as Record<string, unknown>;
    const validationError = expectLiveIntegrationError(
      () =>
        parseHiscoresResponse({
          ...successFixture,
          skills: {
            attack: { level: 120 }
          }
        }),
      "validation_failed"
    );

    expect(validationError.issues.join("\n")).toContain("skills.attack.level");
    expect(validationError.message).not.toContain(process.cwd());
  });

  it("validates and bounds player lookup input", () => {
    expect(parseHiscoresLookupRequest({ player: "  Fixture Player  " })).toEqual({
      player: "Fixture Player"
    });

    expectLiveIntegrationError(
      () => parseHiscoresLookupRequest({ player: "../local/path" }),
      "validation_failed"
    );

    expectLiveIntegrationError(
      () => parseHiscoresLookupRequest({ player: "x".repeat(HISCORES_PLAYER_MAX_CHARS + 1) }),
      "validation_failed"
    );
  });

  it("rejects oversized hiscores payloads before parsing", () => {
    expectLiveIntegrationError(
      () => parseHiscoresResponseJson(" ".repeat(LIVE_INTEGRATION_JSON_MAX_BYTES + 1)),
      "body_too_large"
    );
  });
});

describe("market integration schemas", () => {
  it("validates item-scope market requests against the allowlist", () => {
    expect(
      parseMarketSyncRequest(
        { scope: "items", itemIds: ["lobster", "rune_scimitar"], includeAlch: true },
        { allowedItemIds: MARKET_SOURCE_ITEM_ALLOWLIST }
      )
    ).toMatchObject({
      scope: "items",
      itemIds: ["lobster", "rune_scimitar"],
      includeAlch: true
    });

    const error = expectLiveIntegrationError(
      () =>
        parseMarketSyncRequest(
          { scope: "items", itemIds: ["lobster", "not_a_market_item"] },
          { allowedItemIds: MARKET_SOURCE_ITEM_ALLOWLIST }
        ),
      "disallowed_market_items"
    );
    expect(error.issues.join("\n")).toContain("not_a_market_item");
  });

  it("rejects malformed market requests and excessive item counts", () => {
    expectLiveIntegrationError(() => parseMarketSyncRequestJson("{not-json"), "invalid_json");

    expectLiveIntegrationError(
      () => parseMarketSyncRequest({ scope: "monster" }),
      "validation_failed"
    );

    expectLiveIntegrationError(
      () =>
        parseMarketSyncRequest({
          scope: "items",
          itemIds: Array.from(
            { length: MARKET_SYNC_MAX_ITEMS + 1 },
            (_, index) => `lobster_${index}`
          )
        }),
      "item_count_exceeded"
    );
  });

  it("validates partial market sync response fixtures", () => {
    const response = parseMarketSyncResponse(readFixture("market-sync-response-partial.json"));

    expect(response.priceSet.source).toBe("scraped");
    expect(response.priceSet.itemPrices.lobster).toBe(210);
    expect(response.report).toMatchObject({
      requested: 3,
      updated: 2,
      failed: 1
    });
    expect(response.report.items[2]).toMatchObject({
      itemId: "dragon_bones",
      status: "failed",
      reason: "Mock upstream timeout"
    });
  });

  it("rejects duplicate market report rows and invalid report chronology", () => {
    const fixture = readFixture("market-sync-response-partial.json") as {
      report: {
        updated: number;
        skipped: number;
        failed: number;
        finishedAt: string;
        items: Array<{ itemId: string; status: string }>;
      };
    };
    const duplicate = structuredClone(fixture);
    duplicate.report.items[1] = structuredClone(duplicate.report.items[0]!);
    duplicate.report.updated = duplicate.report.items.filter(
      (item) => item.status === "updated"
    ).length;
    duplicate.report.skipped = duplicate.report.items.filter(
      (item) => item.status === "skipped"
    ).length;
    duplicate.report.failed = duplicate.report.items.filter(
      (item) => item.status === "failed"
    ).length;
    expect(() => parseMarketSyncResponse(duplicate)).toThrowError(
      expect.objectContaining({ code: "validation_failed" })
    );

    const reversed = structuredClone(fixture);
    reversed.report.finishedAt = "2000-01-01T00:00:00.000Z";
    expect(() => parseMarketSyncResponse(reversed)).toThrowError(
      expect.objectContaining({ code: "validation_failed" })
    );
  });

  it("parses mocked market upstream fixtures into a PriceSet without live calls", () => {
    const upstreamItems = parseMarketUpstreamFixtureItems(
      readFixture("market-upstream-items.json")
    );
    const priceSet = createPriceSetFromMarketFixtureItems({
      id: "fixture-price-set",
      label: "Fixture price set",
      createdAt: "2026-07-05T12:00:00.000Z",
      items: upstreamItems
    });

    expect(priceSet.source).toBe("scraped");
    expect(priceSet.itemPrices.lobster).toBe(210);
    expect(priceSet.itemPrices.rune_scimitar).toBe(23000);
    expect(priceSet.alchValues.rune_scimitar).toBe(15360);
    expect(priceSet.provenance?.notes).toContain("mocked market upstream fixtures");
  });

  it("rejects oversized market request bodies before parsing", () => {
    expectLiveIntegrationError(
      () => parseMarketSyncRequestJson(" ".repeat(LIVE_INTEGRATION_JSON_MAX_BYTES + 1)),
      "body_too_large"
    );
  });

  it("keeps fixture JSON free of local paths and real known player names", () => {
    const joinedFixtureText = [
      readFixtureText("hiscores-api-success.json"),
      readFixtureText("hiscores-api-not-found.json"),
      readFixtureText("market-upstream-items.json"),
      readFixtureText("market-sync-response-partial.json")
    ].join("\n");

    expect(joinedFixtureText).not.toContain(process.cwd());
    expect(joinedFixtureText).not.toMatch(/zezima|durial|mod ash/i);
  });
});

describe("market source mapping foundation", () => {
  it("validates the source-catalog-audited market mapping", () => {
    const mappings = parseMarketSourceMappings(MARKET_SOURCE_MAPPINGS);

    expect(MARKET_SOURCE_MAPPING_PROVENANCE.sourceRef).toContain("api/items");
    expect(mappings.length).toBeGreaterThan(70);
    expect(MARKET_SOURCE_ITEM_ALLOWLIST.has("lobster")).toBe(true);
    expect(MARKET_SOURCE_ITEM_ALLOWLIST.has("herb_guam")).toBe(true);
    expect(mappings.find((mapping) => mapping.itemId === "herb_guam")).toMatchObject({
      sourceSlug: "guam_leaf",
      notes: expect.stringContaining("item catalog")
    });
    expect(mappings.find((mapping) => mapping.itemId === "airrune")?.sourceSlug).toBe("airrune");
    expect(mappings.find((mapping) => mapping.itemId === "loop_half_key")?.sourceSlug).toBe(
      "keyhalf2"
    );
    expect(mappings.find((mapping) => mapping.itemId === "tooth_half_key")?.sourceSlug).toBe(
      "keyhalf1"
    );
  });

  it("reports missing market mapping coverage without claiming canonical completeness", () => {
    const missing = validateMarketSourceMappingCoverage({
      mappings: MARKET_SOURCE_MAPPINGS,
      requiredItemIds: ["lobster", "dragonhide_black", "not_real_item"]
    });

    expect(missing).toEqual(["dragonhide_black", "not_real_item"]);
  });

  it("rejects duplicate source slugs as ambiguous mappings", () => {
    const source = MARKET_SOURCE_MAPPINGS[0]!;
    const error = expectLiveIntegrationError(
      () =>
        parseMarketSourceMappings([source, { ...source, itemId: `${source.itemId}_duplicate` }]),
      "validation_failed"
    );
    expect(error.issues.join("\n")).toContain("duplicate market source slug");
  });
});
