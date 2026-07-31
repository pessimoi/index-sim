import { readFileSync } from "node:fs";
import { loadCurrentTestContext } from "./helpers/current-sim";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  PLANNER_NOTICE_CODE_REGISTRY,
  createPlannerNoticePresentation,
  createPlannerViewModel
} from "../app/view-models/planner";
import type { PlannerPlan } from "../domain/planner";
import type { SimulationWarning } from "../domain/shared";

const REACHABLE_PLANNER_NOTICE_CODES = [
  "planner-truncated",
  "manual-planner-requirement-fallback",
  "missing-planner-weapon",
  "missing-planner-equipment",
  "hypothetical-planner-equipment",
  "dragon-halberd-npc-size-fallback",
  "missing-price",
  "missing-alch-value",
  "price-fallback-used",
  "price-generated-fallback",
  "price-market-retained",
  "price-freshness-unknown",
  "price-alias-used",
  "approximate-data-source",
  "unidentified-herb-price-approximation",
  "incoming-attack-partial-model",
  "incoming-attack-compatibility-fallback"
] as const;

function warning(
  code: string,
  severity: SimulationWarning["severity"],
  message: string,
  overrides: Partial<SimulationWarning> = {}
): SimulationWarning {
  return { code, severity, message, ...overrides };
}

async function planFixture(): Promise<{
  plan: PlannerPlan;
  context: Awaited<ReturnType<typeof loadCurrentTestContext>>["context"];
}> {
  const { context } = await loadCurrentTestContext();
  const source = createPlannerViewModel(DEFAULT_FORM_STATE, context);
  expect(source.steps.length).toBeGreaterThanOrEqual(2);

  const repeatedPriceWarning = warning(
    "missing-price",
    "warning",
    "Rune scimitar has no current price.",
    {
      itemId: "rune_scimitar",
      priceContext: { consumer: "supply", affectsCurrentResult: false }
    }
  );
  const currentRepeatedPriceWarning: SimulationWarning = {
    ...repeatedPriceWarning,
    priceContext: { consumer: "supply", affectsCurrentResult: true }
  };
  const longUnknownMessage = `  Unknown   producer\n${"detail ".repeat(60)}`;
  const producerWarnings = [
    warning("unknown-planner-producer", "error", longUnknownMessage),
    repeatedPriceWarning,
    warning("missing-price", "warning", "Rune scimitar has no current price in loot.", {
      itemId: "rune_scimitar",
      priceContext: {
        consumer: "loot",
        affectsCurrentResult: false,
        lootRowId: "rune-scimitar-drop"
      }
    }),
    warning(
      "manual-planner-requirement-fallback",
      "info",
      "Rune scimitar uses the manual requirement fallback.",
      { itemId: "rune_scimitar" }
    ),
    warning(
      "incoming-attack-partial-model",
      "warning",
      "Incoming damage has partial source coverage."
    )
  ];

  const steps = source.steps.slice(0, 2).map((step, index) => ({
    ...step,
    cfg: {
      ...step.cfg,
      warnings: [index === 1 ? currentRepeatedPriceWarning : repeatedPriceWarning]
    },
    trainingCfg: { ...step.trainingCfg, warnings: [repeatedPriceWarning] }
  }));

  return {
    context,
    plan: {
      ...source,
      truncated: true,
      warnings: producerWarnings,
      start: {
        ...source.start,
        cfg: { ...source.start.cfg, warnings: [repeatedPriceWarning] }
      },
      steps
    }
  };
}

describe("Planner notice presentation", () => {
  it("keeps the explicit producer registry exhaustive", () => {
    const producerCodes = new Set<string>(["planner-truncated", "missing-alch-value"]);
    for (const path of [
      "../domain/planner/index.ts",
      "../domain/combat/index.ts",
      "../domain/trip/index.ts"
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      for (const match of source.matchAll(/code:\s*"([^"]+)"/g)) {
        producerCodes.add(match[1]!);
      }
    }

    expect([...producerCodes].sort()).toEqual([...REACHABLE_PLANNER_NOTICE_CODES].sort());
    expect(Object.keys(PLANNER_NOTICE_CODE_REGISTRY).sort()).toEqual([...producerCodes].sort());
  });

  it("presents every distinct notice with stable identities and bounded occurrences", async () => {
    const { plan, context } = await planFixture();
    const presentation = createPlannerNoticePresentation(plan, context);
    const repeated = presentation.rows.find(
      (row) => row.code === "missing-price" && row.action.kind === "correct-price"
    );
    const unknown = presentation.rows.find((row) => row.code === "unknown-planner-producer");

    expect(presentation.rows.length).toBeGreaterThan(4);
    expect(presentation.rows[0]).toMatchObject({
      code: "unknown-planner-producer",
      severity: "error",
      category: "other",
      title: "Planner notice",
      action: { kind: "review-planner-inputs" }
    });
    expect(presentation.rows.map((row) => row.code)).toContain("planner-truncated");
    expect(presentation.rows.filter((row) => row.code === "missing-price")).toHaveLength(2);
    expect(repeated).toMatchObject({
      itemDisplayLabel: { name: "Rune scimitar", technicalId: "rune_scimitar" },
      occurrences: { totalCount: 5, hiddenCount: 2 },
      affectsCurrentResult: true
    });
    expect(repeated?.occurrences.visibleLabels).toHaveLength(3);
    expect(unknown?.detail.length).toBeLessThanOrEqual(240);
    expect(unknown?.detail).not.toMatch(/\s{2,}/);
    expect(presentation.issueCount).toBe(
      presentation.rows.filter((row) => row.severity !== "info").length
    );
    expect(presentation.noteCount).toBe(
      presentation.rows.filter((row) => row.severity === "info").length
    );
    expect(presentation.occurrenceCount).toBe(
      presentation.rows.reduce((sum, row) => sum + row.occurrences.totalCount, 0)
    );

    expect(createPlannerNoticePresentation(plan, context)).toEqual(presentation);
    expect(() => JSON.stringify(presentation)).not.toThrow();
  }, 15_000);

  it("omits the synthetic limit issue when the plan is complete", async () => {
    const { plan, context } = await planFixture();
    const presentation = createPlannerNoticePresentation({ ...plan, truncated: false }, context);

    expect(presentation.rows.map((row) => row.code)).not.toContain("planner-truncated");
  }, 15_000);
});
