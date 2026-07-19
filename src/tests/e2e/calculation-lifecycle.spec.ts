import { expect, test } from "./scaffold-fixture";
import type { Page } from "@playwright/test";

type CalculationKind = "dense-compare" | "planner" | "risk-analysis";

async function failNextCalculation(page: Page, kind: CalculationKind): Promise<void> {
  await page.evaluate((nextKind) => {
    (window as unknown as { failNextCalculationKind: string | null }).failNextCalculationKind =
      nextKind;
  }, kind);
}

test("keeps Dense, Planner and Risk failures recoverable across first and refresh calculations", async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const browserWindow = window as unknown as {
      failNextCalculationKind: string | null;
    };
    browserWindow.failNextCalculationKind = "dense-compare";
    const postMessage = Worker.prototype.postMessage as (this: Worker, message: unknown) => void;
    Worker.prototype.postMessage = function (message: unknown): void {
      const kind =
        typeof message === "object" && message !== null && "kind" in message
          ? String(message.kind)
          : null;
      if (kind && browserWindow.failNextCalculationKind === kind) {
        browserWindow.failNextCalculationKind = null;
        queueMicrotask(() => {
          this.onerror?.call(
            this,
            new ErrorEvent("error", { message: `private ${kind} worker path /Users/example` })
          );
        });
        return;
      }
      postMessage.call(this, message);
    };
  });
  await page.goto("/");

  const compare = page.getByRole("region", { name: "Monster comparison" });
  const denseTable = compare.getByRole("table", { name: "All monsters" });
  await expect(compare.getByRole("alert").locator("span")).toHaveText(
    "Comparison could not be calculated. Your inputs are unchanged."
  );
  await expect(compare.getByRole("button", { name: "Retry comparison" })).toBeEnabled();
  await expect(denseTable.locator("tbody tr")).toHaveCount(0);
  await expect(compare).not.toContainText("private dense-compare worker path");

  await compare.getByRole("button", { name: "Retry comparison" }).click();
  await expect(compare.getByRole("status", { name: /Compare calculation status/i })).toHaveText(
    "Current",
    { timeout: 30_000 }
  );
  await expect.poll(async () => denseTable.locator("tbody tr").count()).toBeGreaterThan(8);
  const denseRowCount = await denseTable.locator("tbody tr").count();

  await failNextCalculation(page, "dense-compare");
  await page.getByLabel("Combat setup").getByLabel("DEF", { exact: true }).fill("7");
  await expect(compare.getByRole("alert").locator("span")).toHaveText(
    "Comparison could not be calculated. Showing the previous result."
  );
  await expect(compare.getByLabel("Previous Dense result")).toBeVisible();
  await expect(denseTable.locator("tbody tr")).toHaveCount(denseRowCount);
  await compare.getByRole("button", { name: "Retry comparison" }).click();
  await expect(compare.getByRole("status", { name: /Compare calculation status/i })).toHaveText(
    "Current",
    { timeout: 30_000 }
  );

  await failNextCalculation(page, "planner");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();
  const planner = page.getByRole("region", { name: "Planner" });
  await expect(planner.getByRole("alert").locator("span")).toHaveText(
    "Planner could not compute the current plan. Your inputs are unchanged."
  );
  await expect(planner.getByRole("button", { name: "Retry plan" })).toBeEnabled();
  await expect(planner.getByLabel("Planner output")).toHaveCount(0);
  await expect(planner).not.toContainText("private planner worker path");

  await planner.getByRole("button", { name: "Retry plan" }).click();
  await expect(planner.getByText("ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  const previousPlan = planner.getByLabel("Planner output");
  await expect(previousPlan).toBeVisible();

  await failNextCalculation(page, "planner");
  await planner.getByLabel("Optimize metric").selectOption("dps");
  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByRole("alert").locator("span")).toHaveText(
    "Planner could not compute the current plan. Showing the previous result."
  );
  await expect(previousPlan).toBeVisible();
  await planner.getByRole("button", { name: "Retry plan" }).click();
  await expect(planner.getByText("ready", { exact: true })).toBeVisible({ timeout: 30_000 });

  await failNextCalculation(page, "risk-analysis");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Risk" }).click();
  const risk = page.getByRole("region", { name: "Risk" });
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByRole("alert")).toHaveText(
    "Risk analysis could not be completed. Your inputs are unchanged."
  );
  await expect(risk.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
  await expect(risk.getByLabel("Modeled risk results")).toHaveCount(0);
  await expect(risk).not.toContainText("private risk-analysis worker path");

  await risk.getByRole("button", { name: "Retry analysis" }).click();
  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  const previousRisk = risk.getByLabel("Modeled risk results");
  await expect(previousRisk).toBeVisible();

  await failNextCalculation(page, "risk-analysis");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByRole("alert")).toHaveText(
    "Risk analysis could not be completed. Showing the previous result."
  );
  await expect(previousRisk).toBeVisible();
  await risk.getByRole("button", { name: "Retry analysis" }).click();
  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
});
