import { expect, expectPageWidthContained, readDownloadText, test } from "./scaffold-fixture";

const FIXED_NOW = new Date("2026-07-21T14:32:05.000Z");
const COMBAT_SCOPE =
  "Combat setup files replace setup, custom-monster, cannon and Dense preferences. They are not full Workspace backups and do not include loot or prices.";
const COLLECTION_SCOPE =
  "This file contains the saved comparison collection only. It does not replace the active setup until you later load an individual saved row.";

test("names and explains transfer artifacts", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    window.localStorage.setItem("index-sim:hidden-gear-tiers", "{invalid local fixture");
  });
  await page.goto("/");

  const tabs = page.getByLabel("Workbench tabs");
  const topbarActions = page.locator(".topbar > .actions");
  const setupInput = page.getByLabel("Review combat setup file");
  const setupExport = page.getByRole("button", { name: "Export combat setup" });
  await expect(topbarActions.getByText(COMBAT_SCOPE, { exact: true })).toBeHidden();
  await expect(
    topbarActions.getByRole("button", { name: "Download full Workspace backup" })
  ).toHaveCount(0);
  await expect(setupInput).toHaveAccessibleDescription(COMBAT_SCOPE);
  await expect(setupExport).toHaveAccessibleDescription(COMBAT_SCOPE);

  const setupDownloadPromise = page.waitForEvent("download");
  await setupExport.click();
  const setupDownload = await setupDownloadPromise;
  expect(setupDownload.suggestedFilename()).toBe(
    "2004scape-combat-setup-hill-giant-rev-274-20260721T143205Z.json"
  );
  const setupArtifact = JSON.parse(await readDownloadText(setupDownload)) as {
    data: { form: { levels: { attack: number } } };
  };
  setupArtifact.data.form.levels.attack += 1;
  await setupInput.setInputFiles({
    name: "index-sim-rewrite-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(setupArtifact))
  });
  const setupReview = page.getByRole("region", { name: "Setup import review" });
  await expect(setupReview).toContainText(COMBAT_SCOPE);
  await setupReview.getByRole("button", { name: "Apply imported setup" }).click();

  await tabs.getByRole("tab", { name: "Setups" }).click();
  const savedSetups = page.getByRole("region", { name: "Setup comparison", exact: true });
  await savedSetups.getByRole("button", { name: "Save current setup" }).click();
  await savedSetups.getByText("Manage saved setups", { exact: true }).click();
  const collectionInput = savedSetups.getByLabel("Review saved setup collection");
  const collectionExport = savedSetups.getByRole("button", {
    name: "Export saved setup collection"
  });
  await expect(savedSetups).toContainText(COLLECTION_SCOPE);
  await expect(collectionInput).toHaveAccessibleDescription(COLLECTION_SCOPE);
  await expect(collectionExport).toHaveAccessibleDescription(COLLECTION_SCOPE);

  const collectionDownloadPromise = page.waitForEvent("download");
  await collectionExport.click();
  const collectionDownload = await collectionDownloadPromise;
  expect(collectionDownload.suggestedFilename()).toBe(
    "2004scape-saved-setup-collection-rev-274-20260721T143205Z.json"
  );
  const collectionArtifact = JSON.parse(await readDownloadText(collectionDownload)) as {
    data: { snapshots: Array<{ id: string; name: string }> };
  };
  collectionArtifact.data.snapshots[0]!.id = "old-fixed-name-copy";
  collectionArtifact.data.snapshots[0]!.name = "Old fixed-name copy";
  await collectionInput.setInputFiles({
    name: "index-sim-saved-setups.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(collectionArtifact))
  });
  await savedSetups
    .getByRole("region", { name: "Saved setup import review" })
    .getByRole("button", { name: "Merge selected setups" })
    .click();
  await expect(savedSetups.getByLabel("Rename saved setup Old fixed-name copy")).toBeVisible();

  await tabs.getByRole("tab", { name: "Economy" }).click();
  const market = page.getByLabel("Market price data");
  const priceTools = market.locator("details.advanced-price-set-tools");
  await priceTools.locator(":scope > summary").click();
  const priceInput = priceTools.getByLabel("Review PriceSet file");
  const priceExport = priceTools.getByRole("button", { name: "Export active PriceSet" });
  const priceScope =
    "A PriceSet file contains its validated item prices, metadata, provenance and compatible alchValues field. Manual item prices and price history are separate browser-local state.";
  await expect(priceTools).toContainText(priceScope);
  await expect(priceInput).toHaveAccessibleDescription(/Manual item prices and price history/);
  await expect(priceExport).toHaveAccessibleDescription(/Manual item prices and price history/);
  await priceInput.setInputFiles({
    name: "user-renamed-prices.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "scheduled",
        label: "Scheduled fixture",
        source: "manual",
        createdAt: FIXED_NOW.toISOString(),
        itemPrices: { lobster: 250 },
        alchValues: { lobster: 0 }
      })
    )
  });
  const priceDownloadPromise = page.waitForEvent("download");
  await priceExport.click();
  const priceDownload = await priceDownloadPromise;
  expect(priceDownload.suggestedFilename()).toBe(
    "2004scape-price-set-scheduled-rev-274-20260721T143205Z.json"
  );

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const workspace = page.getByRole("region", { name: "Workspace backup and restore" });
  const workspaceScope =
    "Download one versioned file containing the active local Workspace. Import prepares a read-only review and does not change this browser. It includes setup, Planner, Loot, saved setups, prices and local history. Calculated output, pending reviews and Undo are excluded.";
  const workspaceInput = workspace.getByLabel("Review Workspace backup file");
  const workspaceExport = workspace.getByRole("button", {
    name: "Download full Workspace backup"
  });
  await expect(workspace).toContainText(workspaceScope);
  await expect(workspace).toContainText("Required areas 9");
  await expect(workspace).toContainText("session-only and is not saved");
  await expect(workspaceInput).toHaveAccessibleDescription(/active local Workspace/);
  await expect(workspaceExport).toHaveAccessibleDescription(/active local Workspace/);
  const workspaceDownloadPromise = page.waitForEvent("download");
  await workspaceExport.click();
  const workspaceDownload = await workspaceDownloadPromise;
  expect(workspaceDownload.suggestedFilename()).toBe(
    "2004scape-workspace-backup-rev-274-20260721T143205Z.json"
  );

  const recovery = page.getByRole("region", { name: "Local state recovery" });
  const recoveryScope =
    "This report helps diagnose local-state health. It contains no raw saved values and cannot restore the Workspace.";
  const recoveryExport = recovery.getByRole("button", {
    name: "Export metadata-only recovery report"
  });
  await expect(recovery).toContainText(recoveryScope);
  await expect(recoveryExport).toHaveAccessibleDescription(recoveryScope);
  const recoveryDownloadPromise = page.waitForEvent("download");
  await recoveryExport.click();
  const recoveryDownload = await recoveryDownloadPromise;
  expect(recoveryDownload.suggestedFilename()).toBe(
    "2004scape-local-state-recovery-report-20260721T143205Z.json"
  );

  await tabs.getByRole("tab", { name: "Economy" }).click();
  if ((await priceTools.getAttribute("open")) === null) {
    await priceTools.locator(":scope > summary").click();
  }
  await priceInput.setInputFiles({
    name: "renamed-long-context.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "x".repeat(100),
        label: "Long context fixture",
        source: "manual",
        createdAt: FIXED_NOW.toISOString(),
        itemPrices: { lobster: 250 },
        alchValues: { lobster: 0 }
      })
    )
  });
  const longDownloadPromise = page.waitForEvent("download");
  await priceExport.click();
  const longDownload = await longDownloadPromise;
  expect(longDownload.suggestedFilename()).toBe(
    `2004scape-price-set-${"x".repeat(48)}-rev-274-20260721T143205Z.json`
  );
  await expect(market.getByLabel("Market action notice")).toContainText(
    longDownload.suggestedFilename()
  );
  await expectPageWidthContained(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expectPageWidthContained(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPageWidthContained(page);
});
