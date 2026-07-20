import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceTrendChart, PriceTrendSparkline } from "../app/components/price-history-charts";
import {
  createPriceHistorySources,
  createEconomyHistoryPresentation
} from "../app/view-models/price-data";

describe("price history charts", () => {
  const history = createEconomyHistoryPresentation({
    sources: createPriceHistorySources({
      scheduledSnapshotStatus: null,
      localPriceHistory: {
        snapshots: [
          {
            capturedAt: "2026-07-20T00:00:00.000Z",
            sourcePriceSetId: "latest",
            label: "Latest",
            itemPrices: { lobster: 250 },
            itemPriceMetadata: {
              lobster: {
                valueOrigin: "market-observation",
                refreshStatus: "retained",
                quality: "medium",
                sourceId: "markets.lostcity.rs",
                sourceSlug: "lobster",
                valueObservedAt: "2026-07-18T12:00:00.000Z",
                evaluatedAt: "2026-07-20T00:00:00.000Z",
                reasonCode: "source-item-unavailable"
              }
            },
            itemPriceStatuses: { lobster: "retained" }
          },
          {
            capturedAt: "2026-07-19T00:00:00.000Z",
            sourcePriceSetId: "baseline",
            label: "Baseline",
            itemPrices: { lobster: 200 },
            itemPriceMetadata: {
              lobster: {
                valueOrigin: "imported",
                refreshStatus: "not-evaluated",
                quality: "unknown"
              }
            },
            itemPriceStatuses: { lobster: "legacy-unknown" }
          }
        ]
      }
    }),
    itemLabels: { lobster: "Lobster" },
    controls: {
      baselineMode: "previous",
      snapshotKey: "",
      itemFilter: "",
      trendItemId: "lobster",
      sort: { key: "item", direction: "asc" }
    },
    timeZone: "UTC"
  });

  it("uses friendly semantic capture, observation and evaluation times", () => {
    const markup = renderToStaticMarkup(createElement(PriceTrendChart, { trend: history.trend }));
    expect(markup).toContain('dateTime="2026-07-19T00:00:00.000Z"');
    expect(markup).toContain(">19 Jul 2026, 00:00 UTC</time>");
    expect(markup).toContain("Value observed");
    expect(markup).toContain("18 Jul 2026, 12:00 UTC");
    expect(markup).toContain("Last evaluated");
    expect(markup).toContain("retained");
    expect(markup).not.toContain(">2026-07-19T00:00:00.000Z<");
  });

  it("adds first and latest friendly capture dates to sparkline accessibility", () => {
    const markup = renderToStaticMarkup(
      createElement(PriceTrendSparkline, { row: history.movers.rows[0]! })
    );
    expect(markup).toContain(
      "price trend from 19 July 2026 at 00:00 Coordinated Universal Time to 20 July 2026 at 00:00 Coordinated Universal Time"
    );
    expect(markup).toContain("200 to 250");
    expect(markup).not.toContain("2026-07-19T");
  });
});
