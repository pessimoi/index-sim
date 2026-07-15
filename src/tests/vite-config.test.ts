import { isDirectScheduledPriceAssetRequest } from "../../vite.config";

describe("Vite scheduled price asset routing", () => {
  it("serves direct runtime assets through the repository middleware", () => {
    expect(isDirectScheduledPriceAssetRequest("GET", "/prices.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("HEAD", "/price-provenance.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("GET", "/alch.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("GET", "/price-history.json")).toBe(true);
  });

  it("leaves Vite raw-module imports to the Vite transform pipeline", () => {
    expect(isDirectScheduledPriceAssetRequest("GET", "/prices.json?import&raw")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("GET", "/price-provenance.json?raw")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("GET", "/price-history.json?import")).toBe(false);
  });

  it("leaves non-read methods and non-allowlisted paths untouched", () => {
    expect(isDirectScheduledPriceAssetRequest("POST", "/prices.json")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest(undefined, "/prices.json")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("GET", "/nested/prices.json")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("GET", "/unknown.json")).toBe(false);
  });
});
