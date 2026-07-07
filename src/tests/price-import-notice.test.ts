import { describe, expect, it } from "vitest";
import {
  createPriceImportSuccessNotice,
  describePriceImportError
} from "../app/state/price-import";
import { parsePriceSetFileText } from "../adapters/market";
import { PRICE_SET_IMPORT_MAX_BYTES } from "../data/schemas";

function noticeFromImport(importText: string) {
  try {
    parsePriceSetFileText(importText);
  } catch (error) {
    return describePriceImportError(error);
  }
  throw new Error("Expected import to fail");
}

describe("price import notices", () => {
  const inactiveDetail =
    "Import was not applied. The current PriceSet remains active and price history was not changed.";

  it("formats invalid JSON without raw parse dumps", () => {
    const notice = noticeFromImport("{not-json");

    expect(notice).toMatchObject({
      tone: "error",
      code: "invalid_json",
      message: "Price import failed: the file is not valid JSON."
    });
    expect(notice.details).toContain(inactiveDetail);
    expect(notice.message).not.toContain("{not-json");
    expect(notice.message).not.toContain("SyntaxError");
    expect(notice.details?.join("\n")).not.toContain("{not-json");
    expect(notice.details?.join("\n")).not.toContain("SyntaxError");
  });

  it("formats duplicate key errors with a short corrective detail", () => {
    const notice = noticeFromImport(`{
      "id": "manual-check",
      "label": "Manual check",
      "source": "manual",
      "createdAt": "2026-07-07T12:00:00.000Z",
      "itemPrices": { "lobster": 200, "lobster": 250 },
      "alchValues": { "lobster": 0 }
    }`);

    expect(notice.code).toBe("duplicate_keys");
    expect(notice.message).toContain("duplicate keys");
    expect(notice.details?.join("\n")).toContain("itemPrices.lobster");
    expect(notice.details).toContain(inactiveDetail);
    expect(notice.details?.join("\n")).not.toContain(process.cwd());
  });

  it("formats schema errors with bounded field details", () => {
    const notice = noticeFromImport(
      JSON.stringify({
        id: "manual-check",
        label: "Manual check",
        source: "manual",
        createdAt: "2026-07-07T12:00:00.000Z",
        itemPrices: { lobster: -1, shark: "expensive", big_bones: -2, rune_arrow: -3 },
        alchValues: { lobster: 0 }
      })
    );

    expect(notice.code).toBe("validation_failed");
    expect(notice.message).toContain("not a valid PriceSet export");
    expect(notice.details?.length).toBe(5);
    expect(notice.details?.join("\n")).toContain("itemPrices.lobster");
    expect(notice.details?.join("\n")).toContain("itemPrices.shark");
    expect(notice.details).toContain(inactiveDetail);
    expect(notice.details?.join("\n")).not.toContain("expensive");
    expect(notice.details?.join("\n")).not.toContain(process.cwd());
  });

  it("formats oversized files from schema and browser file-size guards", () => {
    const schemaNotice = noticeFromImport(" ".repeat(PRICE_SET_IMPORT_MAX_BYTES + 1));
    const fileNotice = describePriceImportError(
      new Error(`File exceeds ${PRICE_SET_IMPORT_MAX_BYTES} bytes`)
    );

    expect(schemaNotice.code).toBe("body_too_large");
    expect(fileNotice.code).toBe("body_too_large");
    expect(schemaNotice.message).toContain("too large");
    expect(schemaNotice.message).toContain("1 MB");
    expect(fileNotice.message).toBe(schemaNotice.message);
    expect(schemaNotice.details).toContain(inactiveDetail);
    expect(fileNotice.details).toContain(inactiveDetail);
  });

  it("formats import success consistently", () => {
    expect(createPriceImportSuccessNotice("Imported fixture prices")).toEqual({
      tone: "success",
      message: "Imported price set: Imported fixture prices"
    });
  });
});
