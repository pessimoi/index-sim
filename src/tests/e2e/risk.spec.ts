import { chooseSearchableOption, expect, searchableCombobox, test } from "./scaffold-fixture";

test("runs, invalidates and cancels modeled Risk analysis", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Trip" }).click();
  await expect(page.locator('[aria-label="Trip summary"]')).toBeAttached();
  await tabs.getByRole("tab", { name: "Risk" }).click();

  const risk = page.locator('section[aria-label="Risk"]');
  await expect(risk).toBeVisible();
  await expect(risk).toContainText("Run the analysis");
  await risk.getByLabel("Target kills").fill("10");
  await risk.getByLabel("Horizon min").fill("10");
  await risk.getByLabel("GP target").fill("0");
  await searchableCombobox(risk, "Target drop").click();
  await risk
    .getByRole("listbox", { name: "Target drop options" })
    .getByRole("option")
    .nth(1)
    .click();
  await risk.getByRole("button", { name: "Run analysis" }).click();

  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  const results = page.getByLabel("Modeled risk results");
  await expect(results).toContainText("P10 / median / P90");
  for (const label of [
    "Kill time",
    "Food runs out",
    "Kills / trip",
    "Trip cycle",
    "10 min net GP",
    "Reach GP target",
    "Target drop"
  ]) {
    await expect(results.locator(".metric").filter({ hasText: label })).toBeVisible();
  }
  await expect(results.getByLabel("Risk model coverage")).toContainText("Loot occurrence");
  await expect(results.getByLabel("Risk model coverage")).toContainText("Source-backed");
  await expect(page.locator('[aria-label="Trip summary"]')).toContainText("Source-backed");
  await expect(results.getByLabel("Risk warnings")).toContainText("Monte Carlo probabilities");

  await chooseSearchableOption(page.getByLabel("Setup context"), "Monster", "Black Dragon");
  await expect(page.locator('[aria-label="Trip summary"]')).toContainText("Partial model");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(results.getByLabel("Risk model coverage")).toContainText("Partial model");
  await expect(results.getByLabel("Risk model coverage")).toContainText("mean-only");
  await expect(results.getByLabel("Risk warnings")).toContainText(
    "Contextual or partial incoming attacks"
  );

  await risk.getByLabel("Target kills").fill("11");
  await expect(risk.getByText("Stale", { exact: true })).toBeVisible();
  await expect(risk).toContainText(
    "Inputs changed. These results do not include the current setup, prices, loot policy or analysis controls."
  );

  await risk.getByLabel("Horizon min").fill("1440");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await risk.getByRole("button", { name: "Cancel" }).click();
  await expect(risk.getByText("Stale", { exact: true })).toBeVisible();
});
