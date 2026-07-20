import { createGeneratedRuntimeContext } from "../adapters/generated";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { MARKET_SOURCE_MAPPINGS } from "../data/market-source-mapping";

describe("default scenario price completeness", () => {
  it("keeps active mapped prices market-backed in the production default", () => {
    const { context } = createGeneratedRuntimeContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const mappedItemIds = new Set(
      MARKET_SOURCE_MAPPINGS.filter((mapping) => mapping.syncPrice).map((mapping) => mapping.itemId)
    );
    const activeMappedIssues = result.priceNotices.issues
      .filter((notice) => notice.itemId && mappedItemIds.has(notice.itemId))
      .map((notice) => notice.itemId);

    expect(activeMappedIssues).toEqual([]);
    expect(context.priceSet.itemPrices.rune_spear).toEqual(expect.any(Number));
    expect(context.priceSet.itemPriceMetadata?.rune_spear).toMatchObject({
      valueOrigin: "market-observation",
      refreshStatus: "observed"
    });
  });
});
