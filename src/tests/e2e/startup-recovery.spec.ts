import { expect, expectPageWidthContained, readDownloadText, test } from "./scaffold-fixture";

test("protects session-only changes before leaving after safe recovery", async ({ page }) => {
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
  const guard = page.getByRole("status", { name: "Unsaved session-only changes" });
  await expect(guard).toContainText("Affected Workspace areas: 1");
  await expect(guard).toContainText("Saved browser data is ignored in this tab");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPageWidthContained(page);
  await expect(guard.getByRole("button", { name: "Download full Workspace backup" })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expectPageWidthContained(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })
  ).toBe(true);

  const dialogPromise = page.waitForEvent("dialog");
  const reloadAttempt = page.evaluate(() => window.location.reload()).catch(() => undefined);
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reloadAttempt;
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  const downloadPromise = page.waitForEvent("download");
  await guard.getByRole("button", { name: "Download full Workspace backup" }).click();
  const download = await downloadPromise;
  const workspace = JSON.parse(await readDownloadText(download)) as {
    areas: Array<{ id: string }>;
  };
  expect(workspace.areas.map((area) => area.id)).toEqual([
    "rewrite-setup",
    "planner-ui",
    "loot-prefs",
    "loot-settings",
    "hidden-gear-tiers",
    "duel-snapshots",
    "price-history",
    "selected-price-set",
    "manual-price-overrides"
  ]);
  const backedUp = page.getByRole("status", { name: "Session-only changes backed up" });
  await expect(backedUp).toContainText("saving the file cannot be verified");
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })
  ).toBe(false);
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  await page.getByLabel("Player", { exact: true }).fill("Private Hero");
  await expect(guard).toContainText("Affected Workspace areas: 1");
  const omittedDownloadPromise = page.waitForEvent("download");
  await guard.getByRole("button", { name: "Download full Workspace backup" }).click();
  const omittedWorkspace = JSON.parse(await readDownloadText(await omittedDownloadPromise)) as {
    areas: Array<{ id: string }>;
  };
  expect(omittedWorkspace.areas.map((area) => area.id)).not.toContain("hiscores-last-player");
  await expect(guard).toContainText("The last Hiscores player was not included");

  await page.getByRole("tab", { name: "Settings" }).click();
  const workspacePanel = page.getByLabel("Workspace backup and restore");
  await workspacePanel.getByLabel("Include last Hiscores player name").check();
  const includedDownloadPromise = page.waitForEvent("download");
  await guard.getByRole("button", { name: "Download full Workspace backup" }).click();
  const includedWorkspace = JSON.parse(await readDownloadText(await includedDownloadPromise)) as {
    areas: Array<{ id: string }>;
  };
  expect(includedWorkspace.areas.map((area) => area.id)).toContain("hiscores-last-player");
  await expect(guard).toHaveCount(0);
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);

  await page.getByLabel("Player", { exact: true }).fill("Private Hero 2");
  await expect(guard).toBeVisible();
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })
  ).toBe(true);
  expect(await localStorageSnapshot()).toBe(savedBeforeFailure);
});
