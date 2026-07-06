import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import { runLegacyCase, summarizeLegacyResult } from "./helpers/legacy-sim";

interface GoldenFixture {
  tolerances: {
    defaultNumericAbs: number;
  };
  cases: Array<{
    id: string;
    expected: unknown;
  }>;
}

const fixtures = fixtureSet as GoldenFixture;
const definitionsById = new Map(
  LEGACY_GOLDEN_CASES.map((definition) => [definition.id, definition])
);

function compareWithTolerance(
  actual: unknown,
  expected: unknown,
  tolerance: number,
  path: string
): void {
  if (typeof expected === "number") {
    expect(typeof actual, path).toBe("number");
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(tolerance);
    return;
  }

  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    const actualArray = actual as unknown[];
    expect(actualArray.length, path).toBe(expected.length);
    expected.forEach((value, index) => {
      compareWithTolerance(actualArray[index], value, tolerance, `${path}[${index}]`);
    });
    return;
  }

  if (expected && typeof expected === "object") {
    expect(actual && typeof actual === "object" && !Array.isArray(actual), path).toBe(true);
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    expect(Object.keys(actualRecord).sort(), path).toEqual(Object.keys(expectedRecord).sort());
    for (const [key, value] of Object.entries(expectedRecord)) {
      compareWithTolerance(actualRecord[key], value, tolerance, `${path}.${key}`);
    }
    return;
  }

  expect(actual, path).toEqual(expected);
}

describe("legacy golden fixtures", () => {
  it("keeps fixture IDs aligned with case definitions", () => {
    expect(fixtures.cases.map((testCase) => testCase.id)).toEqual(
      LEGACY_GOLDEN_CASES.map((definition) => definition.id)
    );
  });

  for (const testCase of fixtures.cases) {
    it(`matches ${testCase.id}`, () => {
      const definition = definitionsById.get(testCase.id);
      expect(definition, `Missing case definition for ${testCase.id}`).toBeDefined();
      if (!definition) {
        throw new Error(`Missing case definition for ${testCase.id}`);
      }

      const actual = summarizeLegacyResult(runLegacyCase(definition));
      compareWithTolerance(
        actual,
        testCase.expected,
        fixtures.tolerances.defaultNumericAbs,
        testCase.id
      );
    });
  }
});
