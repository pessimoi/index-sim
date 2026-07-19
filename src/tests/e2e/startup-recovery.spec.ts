import { expect, test } from "./scaffold-fixture";

test("recovers a ready-pane render failure without changing saved browser data", async ({
  page
}) => {
  const localStorageSnapshot = () =>
    page.evaluate(() =>
      JSON.stringify(
        Object.keys(window.localStorage)
          .sort()
          .map((key) => [key, window.localStorage.getItem(key)])
      )
    );

  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup"));
  const savedBeforeFailure = await localStorageSnapshot();

  await page.evaluate(() => {
    Object.defineProperty(Number.prototype, "toLocaleString", {
      configurable: true,
      value() {
        const error = new Error("raw browser pane failure at /private/source.ts:42");
        error.stack = "private browser stack at /private/browser-stack.ts:7";
        throw error;
      }
    });
  });
  await page.getByLabel("TARGET", { exact: true }).selectOption("lesser_demon");

  const failure = page.getByRole("alert");
  await expect(failure).toContainText(
    "The simulator encountered an unexpected display error and could not continue safely."
  );
  await expect(failure).toContainText("Reload simulator");
  await expect(failure).toContainText("Open with saved data ignored for this session");
  await expect(failure).not.toContainText("raw browser pane failure");
  await expect(failure).not.toContainText("private/source.ts");
  await expect(failure).not.toContainText("private browser stack");
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  await Promise.all([
    page.waitForNavigation(),
    failure.getByRole("button", { name: "Open with saved data ignored for this session" }).click()
  ]);

  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  const safeModeNotice = page.getByRole("status", { name: "Session-only safe mode" });
  await expect(safeModeNotice).toContainText("Changes are session-only");
  await expect(safeModeNotice).toContainText("existing saved data has not been changed");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("giant");
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  await page.getByLabel("TARGET", { exact: true }).selectOption("lesser_demon");
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);
});
