import { expect, test } from "./scaffold-fixture";
import { REWRITE_SETUP_STORAGE_KEY } from "../../app/state/ui-state";

async function waitForReady(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await page.waitForFunction(
    (key) => window.localStorage.getItem(key) !== null,
    REWRITE_SETUP_STORAGE_KEY
  );
}

async function savedAttack(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw).data.form.levels.attack : -1;
  }, REWRITE_SETUP_STORAGE_KEY);
}

test("another tab cannot overwrite a newer setup and both reviewed resolutions stay guarded", async ({
  page,
  context
}) => {
  test.setTimeout(90_000);
  await waitForReady(page);
  const second = await context.newPage();
  await waitForReady(second);

  const firstSetup = page.getByLabel("Combat setup");
  const secondSetup = second.getByLabel("Combat setup");
  await firstSetup.getByLabel("ATT", { exact: true }).fill("70");
  await page.waitForFunction(
    (key) =>
      JSON.parse(window.localStorage.getItem(key) ?? "null")?.data?.form?.levels?.attack === 70,
    REWRITE_SETUP_STORAGE_KEY
  );

  const attention = second.getByRole("complementary", {
    name: "Data changed in another tab"
  });
  await expect(attention).toBeVisible();
  await expect(attention).toContainText("Rewrite setup");

  await secondSetup.getByLabel("STR", { exact: true }).fill("71");
  await expect.poll(() => savedAttack(second)).toBe(70);

  await attention.getByRole("button", { name: "Review conflicts" }).click();
  const review = second.getByRole("region", { name: "Data changed in another tab" });
  const heading = review.getByRole("heading", { name: "Data changed in another tab" });
  await expect(review).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(review.getByRole("row", { name: /Rewrite setup.*Changed.*Paused/ })).toBeVisible();
  await expect(
    review.getByRole("button", { name: "Download full Workspace backup" })
  ).toBeVisible();
  await expect(review).not.toContainText("savedAt");

  await review.getByRole("button", { name: "Use saved data" }).click();
  await expect(second.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await expect(second.getByLabel("Combat setup").getByLabel("ATT", { exact: true })).toHaveValue(
    "70"
  );
  await expect(
    second.getByRole("complementary", { name: "Data changed in another tab" })
  ).toHaveCount(0);

  await second.getByLabel("Combat setup").getByLabel("ATT", { exact: true }).fill("72");
  await second.waitForFunction(
    (key) =>
      JSON.parse(window.localStorage.getItem(key) ?? "null")?.data?.form?.levels?.attack === 72,
    REWRITE_SETUP_STORAGE_KEY
  );
  const firstAttention = page.getByRole("complementary", {
    name: "Data changed in another tab"
  });
  await expect(firstAttention).toBeVisible();
  await firstAttention.getByRole("button", { name: "Review conflicts" }).click();
  const firstReview = page.getByRole("region", { name: "Data changed in another tab" });
  await firstReview.getByRole("button", { name: "Keep this tab's data" }).click();
  await expect.poll(() => savedAttack(page)).toBe(70);
  const undoStatus = page.getByRole("status", { name: "Local state undo" });
  await expect(undoStatus).toContainText(/Kept this tab's data for \d+ areas?/);
  const undoButton = undoStatus.getByRole("button", { name: "Undo" });
  await expect(undoButton).toBeVisible();
  await undoButton.click();
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await expect(page.getByLabel("Combat setup").getByLabel("ATT", { exact: true })).toHaveValue(
    "72"
  );

  await second.close();
});
