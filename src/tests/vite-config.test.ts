import { isDirectScheduledPriceAssetRequest } from "../../vite.config";

describe("Vite scheduled price asset routing", () => {
  it("serves direct runtime assets through the repository middleware", () => {
    expect(isDirectScheduledPriceAssetRequest("/prices.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("/price-provenance.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("/alch.json")).toBe(true);
    expect(isDirectScheduledPriceAssetRequest("/price-history.json")).toBe(true);
  });

  it("leaves Vite raw-module imports to the Vite transform pipeline", () => {
    expect(isDirectScheduledPriceAssetRequest("/prices.json?import&raw")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("/price-provenance.json?raw")).toBe(false);
    expect(isDirectScheduledPriceAssetRequest("/price-history.json?import")).toBe(false);
  });
});
