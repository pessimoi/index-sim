import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import {
  LEGACY_GOLDEN_CAPTURE,
  LEGACY_GOLDEN_CLASSIFICATIONS
} from "./fixtures/legacy-golden-manifest";

interface GoldenFixture {
  capturedAt: string;
  source: {
    sourceCommit: string;
    captureScriptSha256: string;
  };
  tolerances: {
    defaultNumericAbs: number;
  };
  cases: Array<{
    id: string;
    description: string;
    input: Record<string, unknown>;
    expected: unknown;
  }>;
}

const fixtures = fixtureSet as GoldenFixture;

function expectFiniteNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), path).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => expectFiniteNumbers(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      expectFiniteNumbers(entry, `${path}.${key}`);
    }
  }
}

describe("legacy golden fixtures", () => {
  it("keeps immutable fixture IDs and normalized inputs aligned with case definitions", () => {
    expect(fixtures.cases.map((testCase) => testCase.id)).toEqual(
      LEGACY_GOLDEN_CASES.map((definition) => definition.id)
    );
    for (const [index, definition] of LEGACY_GOLDEN_CASES.entries()) {
      const fixture = fixtures.cases[index]!;
      expect(fixture.description).toBe(definition.description);
      expect(fixture.input.combatType).toBe(definition.combatType);
      expect(fixture.input.monsterId).toBe(definition.monsterId);
    }
  });

  it("records final capture provenance and one reviewed classification per case", () => {
    expect(fixtures.capturedAt).toBe(LEGACY_GOLDEN_CAPTURE.capturedAt);
    expect(fixtures.source.sourceCommit).toBe(LEGACY_GOLDEN_CAPTURE.sourceCommit);
    expect(fixtures.source.captureScriptSha256).toBe(LEGACY_GOLDEN_CAPTURE.captureScriptSha256);
    expect(Object.keys(LEGACY_GOLDEN_CLASSIFICATIONS)).toEqual(
      fixtures.cases.map((testCase) => testCase.id)
    );
    expect(Object.values(LEGACY_GOLDEN_CLASSIFICATIONS)).not.toContain("historical-only");
  });

  it("keeps accepted output immutable, finite and tolerance-controlled", () => {
    expect(fixtures.tolerances.defaultNumericAbs).toBeGreaterThan(0);
    for (const testCase of fixtures.cases) {
      expect(testCase.expected).toBeTypeOf("object");
      expectFiniteNumbers(testCase.expected, testCase.id);
    }
  });
});
