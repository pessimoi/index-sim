import { ACCESSIBILITY_JOURNEYS } from "./e2e/accessibility-manifest";

describe("assistive-technology journey manifest", () => {
  it("owns the exact AT-01 through AT-12 release matrix without silent exceptions", () => {
    expect(ACCESSIBILITY_JOURNEYS.map(({ id }) => id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `AT-${String(index + 1).padStart(2, "0")}`)
    );
    expect(new Set(ACCESSIBILITY_JOURNEYS.map(({ journey }) => journey)).size).toBe(12);
    expect(ACCESSIBILITY_JOURNEYS.every(({ exception }) => exception === null)).toBe(true);
  });

  it("keeps every journey reproducible and linked to automated and manual evidence", () => {
    for (const journey of ACCESSIBILITY_JOURNEYS) {
      expect(journey.fixture).not.toBe("");
      expect(journey.viewport.width).toBeGreaterThanOrEqual(320);
      expect(journey.viewport.height).toBeGreaterThan(0);
      expect(journey.entry).not.toBe("");
      expect(journey.expectedOutcomes.length).toBeGreaterThanOrEqual(3);
      expect(journey.announcements.length).toBeGreaterThan(0);
      expect(journey.scanCheckpoints.length).toBeGreaterThan(0);
      expect(journey.manualSteps.length).toBeGreaterThan(0);
      expect(journey.linkedTests.length).toBeGreaterThan(0);
    }
  });
});
