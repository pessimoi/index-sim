import { formatDuration, formatNumber } from "../app/view-models/formatting";

describe("view-model formatting", () => {
  it("formats sub-minute, non-finite and unlimited durations", () => {
    expect(formatDuration(12.34)).toBe("12.3s");
    expect(formatDuration(Number.NaN)).toBe("-");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("unlimited");
  });

  it("carries rounded seconds into the next minute", () => {
    expect(formatDuration(119.6)).toBe("2:00");
    expect(formatDuration(3599.6)).toBe("60:00");
  });
});

describe("rewrite UI view models", () => {
  it("distinguishes unlimited values from invalid number formatting", () => {
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("unlimited");
    expect(formatNumber(Number.NaN)).toBe("-");
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe("-");
  });
});
