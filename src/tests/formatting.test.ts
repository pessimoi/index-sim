import { formatDuration, formatNumber } from "../app/view-models/formatting";

describe("view-model formatting", () => {
  it("formats sub-minute, non-finite and unlimited durations", () => {
    expect(formatDuration(12.34)).toBe("12.3 s");
    expect(formatDuration(Number.NaN)).toBe("-");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("unlimited");
  });

  it("carries rounded seconds into explicit minute and hour units", () => {
    expect(formatDuration(119.6)).toBe("2 min");
    expect(formatDuration(3599.6)).toBe("1 hr");
  });
});

describe("rewrite UI view models", () => {
  it("distinguishes unlimited values from invalid number formatting", () => {
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("unlimited");
    expect(formatNumber(Number.NaN)).toBe("-");
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe("-");
  });
});
