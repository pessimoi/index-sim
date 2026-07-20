import {
  createPriceTimeContext,
  presentPriceDateTime,
  presentPriceDateTimeOccurrences
} from "../app/view-models/price-time";

describe("price date and time presentation", () => {
  const utc = (now = "2026-07-20T00:00:00.000Z") => createPriceTimeContext(new Date(now), "UTC");

  it("formats canonical instants in a deterministic local zone and retains source identity", () => {
    const context = createPriceTimeContext(new Date("2026-07-20T00:01:00.000Z"), "Europe/Helsinki");
    const summer = presentPriceDateTime("2026-07-20T00:00:00.000Z", context);
    const winter = presentPriceDateTime("2026-01-05T00:00:00.000Z", context);

    expect(summer).toMatchObject({
      precision: "instant",
      dateTime: "2026-07-20T00:00:00.000Z",
      exactVisible: "20 Jul 2026, 03:00 EEST",
      relativeVisible: "1 min ago",
      relativeAccessible: "1 minute ago"
    });
    expect(winter.exactVisible).toBe("5 Jan 2026, 02:00 EET");
    expect(summer.exactAccessible).toContain("Eastern European Summer Time");
    expect(summer.exactUtcTitle).toBe("20 Jul 2026, 00:00:00 UTC");
  });

  it("normalizes Z and signed-offset inputs only for presentation, not dateTime", () => {
    const z = presentPriceDateTime("2026-07-20T00:00:00Z", utc());
    const positive = presentPriceDateTime("2026-07-20T03:00:00+03:00", utc());
    const negative = presentPriceDateTime("2026-07-19T20:00:00-04:00", utc());

    expect([z.exactVisible, positive.exactVisible, negative.exactVisible]).toEqual([
      "20 Jul 2026, 00:00 UTC",
      "20 Jul 2026, 00:00 UTC",
      "20 Jul 2026, 00:00 UTC"
    ]);
    expect(positive.dateTime).toBe("2026-07-20T03:00:00+03:00");
    expect(negative.dateTime).toBe("2026-07-19T20:00:00-04:00");
  });

  it("falls back to UTC for an invalid zone and handles local date boundaries", () => {
    const fallback = createPriceTimeContext(new Date("2026-01-01T00:00:00Z"), "Mars/Olympus");
    const crossYear = presentPriceDateTime("2025-12-31T23:30:00Z", fallback);
    expect(fallback.timeZone).toBe("UTC");
    expect(crossYear.exactVisible).toBe("31 Dec 2025, 23:30 UTC");

    const helsinki = createPriceTimeContext(new Date(0), "Europe/Helsinki");
    expect(presentPriceDateTime("2025-12-31T23:30:00Z", helsinki).exactVisible).toBe(
      "1 Jan 2026, 01:30 EET"
    );
  });

  it("preserves date-only precision and rejects invalid or permissive date input", () => {
    expect(presentPriceDateTime("2024-02-29", utc())).toEqual({
      precision: "date",
      dateTime: "2024-02-29",
      exactVisible: "29 Feb 2024",
      exactAccessible: "29 February 2024",
      exactUtcTitle: null,
      relativeVisible: null,
      relativeAccessible: null
    });
    expect(presentPriceDateTime("2023-02-29", utc())).toMatchObject({
      precision: "invalid",
      dateTime: null,
      exactVisible: "Date unavailable"
    });
    const permissive = presentPriceDateTime("July 20, 2026", utc());
    expect(permissive.precision).toBe("invalid");
    expect(JSON.stringify(permissive)).not.toContain("July 20, 2026");
    expect(presentPriceDateTime(null, utc(), { missingText: "Not recorded" }).exactVisible).toBe(
      "Not recorded"
    );
  });

  it.each([
    ["2026-07-19T23:59:31Z", "just now", "less than 1 minute ago"],
    ["2026-07-19T23:59:00Z", "1 min ago", "1 minute ago"],
    ["2026-07-19T23:58:00Z", "2 min ago", "2 minutes ago"],
    ["2026-07-19T23:00:00Z", "1 hr ago", "1 hour ago"],
    ["2026-07-19T22:00:00Z", "2 hr ago", "2 hours ago"],
    ["2026-07-19T00:00:00Z", "1 day ago", "1 day ago"],
    ["2026-07-18T00:00:00Z", "2 days ago", "2 days ago"],
    ["2026-07-20T00:00:30Z", "in less than 1 minute", "in less than 1 minute"],
    ["2026-07-20T00:01:00Z", "in 1 min", "in 1 minute"],
    ["2026-07-20T01:00:00Z", "in 1 hr", "in 1 hour"],
    ["2026-07-21T00:00:00Z", "in 1 day", "in 1 day"]
  ])("formats signed relative boundary %s", (value, visible, accessible) => {
    expect(presentPriceDateTime(value, utc())).toMatchObject({
      relativeVisible: visible,
      relativeAccessible: accessible
    });
  });

  it("adds seconds and stable ordinals only when selectable captures collide", () => {
    const values = ["2026-07-20T00:00:01Z", "2026-07-20T00:00:40Z", "2026-07-20T00:00:01Z"];
    const presentations = presentPriceDateTimeOccurrences(values, utc());
    expect(presentations.map((item) => item.exactVisible)).toEqual([
      "20 Jul 2026, 00:00:01 UTC (1 of 2)",
      "20 Jul 2026, 00:00:40 UTC",
      "20 Jul 2026, 00:00:01 UTC (2 of 2)"
    ]);
    expect(presentations.map((item) => item.dateTime)).toEqual(values);
  });

  it("uses instant equality for collision ordinals without rewriting offset source values", () => {
    const values = ["2026-07-20T00:00:01Z", "2026-07-20T03:00:01+03:00"];
    const presentations = presentPriceDateTimeOccurrences(values, utc());
    expect(presentations.map((item) => item.exactVisible)).toEqual([
      "20 Jul 2026, 00:00:01 UTC (1 of 2)",
      "20 Jul 2026, 00:00:01 UTC (2 of 2)"
    ]);
    expect(presentations.map((item) => item.dateTime)).toEqual(values);
  });
});
