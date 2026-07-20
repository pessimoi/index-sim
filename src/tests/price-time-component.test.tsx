import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceTime, PriceTimeFactPair } from "../app/components/price-time";
import { createPriceTimeContext, presentPriceDateTime } from "../app/view-models/price-time";

describe("PriceTime", () => {
  const context = createPriceTimeContext(new Date("2026-07-20T01:00:00Z"), "UTC");

  it("renders one semantic canonical time with friendly full copy", () => {
    const markup = renderToStaticMarkup(
      createElement(PriceTime, {
        presentation: presentPriceDateTime("2026-07-20T00:00:00.000Z", context),
        display: "full"
      })
    );
    expect(markup).toContain('dateTime="2026-07-20T00:00:00.000Z"');
    expect(markup).toContain('title="20 Jul 2026, 00:00:00 UTC"');
    expect(markup).toContain("20 Jul 2026, 00:00 UTC · 1 hr ago");
    expect(markup.match(/<time/g)).toHaveLength(1);
    expect(markup).not.toContain(">2026-07-20T");
  });

  it("does not invent a time for date precision on a compact relative surface", () => {
    const markup = renderToStaticMarkup(
      createElement(PriceTime, {
        presentation: presentPriceDateTime("2026-07-20", context),
        display: "relative"
      })
    );
    expect(markup).toContain('dateTime="2026-07-20"');
    expect(markup).toContain("Exact time not recorded");
    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain("UTC");
  });

  it("uses ordinary bounded text for missing and invalid values", () => {
    const missing = renderToStaticMarkup(
      createElement(PriceTime, {
        presentation: presentPriceDateTime(null, context, { missingText: "Not evaluated" })
      })
    );
    const invalid = renderToStaticMarkup(
      createElement(PriceTime, {
        presentation: presentPriceDateTime("private invalid source", context)
      })
    );
    expect(missing).toBe("<span>Not evaluated</span>");
    expect(invalid).toBe("<span>Date unavailable</span>");
    expect(invalid).not.toContain("private invalid source");
  });

  it("pairs exact and relative visible facts with one announced time", () => {
    const markup = renderToStaticMarkup(
      createElement(PriceTimeFactPair, {
        presentation: presentPriceDateTime("2026-07-20T00:00:00Z", context),
        exactLabel: "Snapshot captured",
        relativeLabel: "Captured"
      })
    );
    expect(markup).toContain("Snapshot captured");
    expect(markup).toContain("Captured 1 hr ago");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup.match(/<time/g)).toHaveLength(1);
    expect(markup).toContain(
      'aria-label="20 July 2026 at 00:00 Coordinated Universal Time; 1 hour ago"'
    );
  });
});
