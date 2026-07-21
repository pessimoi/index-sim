import { expect, readDownloadText, test } from "./scaffold-fixture";

test("Workspace backup export opens a zero-mutation review and Dismiss returns focus", async ({
  page
}) => {
  await page.goto("/");

  const hiscores = page.getByRole("region", { name: "Hiscores" });
  await hiscores.getByLabel("Player", { exact: true }).fill("Private Fixture Hero");
  const attack = page.getByLabel("Combat setup").getByLabel("ATT", { exact: true });
  const attackBefore = await attack.inputValue();

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const panel = page.getByRole("region", { name: "Workspace backup and restore" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Revision 274");
  await expect(panel).toContainText("LostCity source-backed runtime 376072662e78");

  const optIn = panel.getByLabel("Include last Hiscores player name");
  await expect(optIn).not.toBeChecked();
  await expect(panel).toContainText("session-only and is not saved");

  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup") !== null);
  const localStorageBefore = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );

  const downloadWorkspaceButton = panel.getByRole("button", {
    name: "Download full Workspace backup"
  });
  const downloadPromise = page.waitForEvent("download");
  await downloadWorkspaceButton.focus();
  await downloadWorkspaceButton.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^2004scape-workspace-backup-rev-274-\d{8}T\d{6}Z\.json$/
  );
  await expect(panel.getByLabel("Workspace transfer notice")).toHaveText(
    `Workspace backup download started: ${download.suggestedFilename()}. Check your browser downloads.`
  );
  await expect(downloadWorkspaceButton).toBeFocused();
  const exportedText = await readDownloadText(download);
  const exported = JSON.parse(exportedText) as {
    kind: string;
    version: number;
    context: { gameDataId: string; gameRevision: number };
    areas: Array<{ id: string }>;
  };
  expect(exported).toMatchObject({
    kind: "index-sim-workspace",
    version: 1,
    context: {
      gameDataId: "lostcity-376072662e78-runtime",
      gameRevision: 274
    }
  });
  expect(exported.areas).toHaveLength(9);
  expect(exported.areas.map((area) => area.id)).not.toContain("hiscores-last-player");
  expect(exportedText).not.toContain("Private Fixture Hero");

  const importInput = panel.getByLabel("Review Workspace backup file");
  await importInput.setInputFiles({
    name: "workspace-review.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedText)
  });
  const reviewHeading = panel.getByRole("heading", { name: "Review before restore" });
  await expect(reviewHeading).toBeFocused();
  const reviewTable = panel.getByRole("table", { name: "Workspace restore areas" });
  await expect(reviewTable.locator("tbody tr")).toHaveCount(9);
  await expect(reviewTable).toContainText("Transfer v1 · local v3");
  await expect(reviewTable.getByRole("checkbox")).toHaveCount(9);
  await expect(reviewTable.getByRole("checkbox").first()).toBeChecked();
  await expect(
    reviewTable.getByRole("combobox", { name: "Loot preferences restore mode" })
  ).toHaveValue("replace");
  await expect(reviewTable).toContainText("result");
  await expect(panel.getByRole("button", { name: "Apply selected areas" })).toBeEnabled();
  await expect(importInput).toHaveValue("");
  await expect(attack).toHaveValue(attackBefore);

  const localStorageAfterReview = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(localStorageAfterReview).toEqual(localStorageBefore);

  await panel.getByRole("button", { name: "Dismiss" }).click();
  await expect(reviewHeading).toHaveCount(0);
  await expect(importInput).toBeFocused();
  await expect(attack).toHaveValue(attackBefore);
  const localStorageAfterDismiss = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(localStorageAfterDismiss).toEqual(localStorageBefore);
});

test("workspace multi-area Replace applies one durable transaction and one Undo restores every raw value", async ({
  page
}) => {
  await page.goto("/");
  const attack = page.getByLabel("Combat setup").getByLabel("ATT", { exact: true });
  const attackBefore = await attack.inputValue();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const panel = page.getByRole("region", { name: "Workspace backup and restore" });
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup") !== null);
  const durableBefore = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );

  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download full Workspace backup" }).click();
  const workspace = JSON.parse(await readDownloadText(await downloadPromise)) as {
    areas: Array<{ id: string; data: unknown }>;
  };
  const setup = workspace.areas.find((area) => area.id === "rewrite-setup")!.data as {
    form: { monsterId: string; levels: { attack: number } };
  };
  setup.form.levels.attack = 55;
  const planner = workspace.areas.find((area) => area.id === "planner-ui")!.data as {
    metric: string;
  };
  planner.metric = "gph";
  const lootSettings = workspace.areas.find((area) => area.id === "loot-settings")!.data as Record<
    string,
    unknown
  >;
  lootSettings[setup.form.monsterId] = {
    highAlch: true,
    overheadSec: 11,
    talismanSpot: "overground"
  };
  const duel = workspace.areas.find((area) => area.id === "duel-snapshots")!.data as {
    snapshots: unknown[];
  };
  duel.snapshots = [
    { id: "workspace-browser", name: "Workspace browser", form: structuredClone(setup.form) }
  ];
  const manual = workspace.areas.find((area) => area.id === "manual-price-overrides")!.data as {
    items: Record<string, unknown>;
  };
  manual.items = {
    lobster: { price: 4321, updatedAt: "2026-07-19T18:30:00.000Z" }
  };

  await panel.getByLabel("Review Workspace backup file").setInputFiles({
    name: "workspace-replace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace))
  });
  const restoreTable = panel.getByRole("table", { name: "Workspace restore areas" });
  await restoreTable.getByRole("checkbox", { name: "Restore Hidden gear tiers" }).uncheck();
  await panel.getByRole("button", { name: "Apply selected areas" }).click();
  await expect(attack).toHaveValue("55");
  const applied = await page.evaluate(() => ({
    planner: JSON.parse(window.localStorage.getItem("index-sim:planner-ui")!).data.metric,
    loot: JSON.parse(window.localStorage.getItem("index-sim:loot-settings")!).data,
    duel: JSON.parse(window.localStorage.getItem("index-sim:duel-snapshots")!).data.snapshots
      .length,
    manual: JSON.parse(window.localStorage.getItem("index-sim:manual-price-overrides")!).data.items
  }));
  expect(applied).toMatchObject({ planner: "gph", duel: 1 });
  expect(applied.loot[setup.form.monsterId]).toMatchObject({ overheadSec: 11 });
  expect(applied.manual.lobster).toMatchObject({ price: 4321 });

  const undo = page.getByRole("status", { name: "Local state undo" });
  await expect(undo).toContainText("Restored 8 Workspace areas");
  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(attack).toHaveValue(attackBefore);
  const durableAfterUndo = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(durableAfterUndo).toEqual(durableBefore);
});

test("workspace restore mixed Merge preview retains unrelated current rows and supports keyboard choices", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const hiddenTiers = page.getByRole("region", { name: "Hidden gear tiers" });
  const iron = hiddenTiers.getByLabel("Hide iron gear", { exact: true });
  await iron.check();
  await expect(iron).toBeChecked();

  const panel = page.getByRole("region", { name: "Workspace backup and restore" });
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download full Workspace backup" }).click();
  const workspace = JSON.parse(await readDownloadText(await downloadPromise)) as {
    context: { gameDataId: string; gameRevision: number };
    areas: Array<{ id: string; version: number; data: unknown }>;
  };
  const hiddenArea = workspace.areas.find((area) => area.id === "hidden-gear-tiers")!;
  hiddenArea.data = { bronze: true };

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  await page
    .getByRole("region", { name: "Setup comparison", exact: true })
    .getByRole("button", { name: "Save current setup" })
    .click();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  await page.getByRole("button", { name: "Save local comparison" }).click();
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:price-history") !== null);
  const currentRows = await page.evaluate(() => ({
    duel: JSON.parse(window.localStorage.getItem("index-sim:duel-snapshots")!).data.snapshots[0],
    history: JSON.parse(window.localStorage.getItem("index-sim:price-history")!).data.snapshots[0]
  }));
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();

  const duelArea = workspace.areas.find((area) => area.id === "duel-snapshots")!;
  const duelData = duelArea.data as {
    snapshots: Array<{ id: string; name: string; form: unknown }>;
  };
  duelData.snapshots = [
    {
      ...structuredClone(currentRows.duel),
      id: "workspace-merge-added",
      name: "Workspace merge added"
    }
  ];
  const historyArea = workspace.areas.find((area) => area.id === "price-history")!;
  const historyData = historyArea.data as {
    snapshots: Array<{ capturedAt: string; sourcePriceSetId: string }>;
  };
  historyData.snapshots = [
    {
      ...structuredClone(currentRows.history),
      capturedAt: "2026-07-19T18:45:00.000Z",
      sourcePriceSetId: "workspace-merge-added"
    }
  ];

  await panel.getByLabel("Review Workspace backup file").setInputFiles({
    name: "workspace-mixed-merge.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace))
  });
  const table = panel.getByRole("table", { name: "Workspace restore areas" });
  const hiddenRow = table.getByRole("row").filter({ hasText: "Hidden gear tiers" });
  const hiddenChoice = hiddenRow.getByRole("checkbox", { name: "Restore Hidden gear tiers" });
  const hiddenMode = hiddenRow.getByRole("combobox", {
    name: "Hidden gear tiers restore mode"
  });

  await hiddenChoice.focus();
  await page.keyboard.press("Space");
  await expect(hiddenChoice).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(hiddenChoice).toBeChecked();
  await hiddenMode.focus();
  await page.keyboard.press("m");
  await expect(hiddenMode).toHaveValue("merge");
  await expect(hiddenRow).toContainText("added 1");
  await expect(hiddenRow).toContainText("retained 1");

  const lootMode = table.getByRole("combobox", { name: "Loot preferences restore mode" });
  await lootMode.selectOption("merge");
  await expect(lootMode).toHaveValue("merge");
  await expect(table.getByRole("combobox", { name: "Rewrite setup restore mode" })).toHaveValue(
    "replace"
  );
  const duelMode = table.getByRole("combobox", { name: "Saved setups restore mode" });
  await duelMode.selectOption("merge");
  const duelRow = table.getByRole("row").filter({ hasText: "Saved setups" });
  await expect(duelRow).toContainText("added 1");
  await expect(duelRow).toContainText("retained 1");
  const historyMode = table.getByRole("combobox", { name: "Price history restore mode" });
  await historyMode.selectOption("merge");
  const historyRow = table.getByRole("row").filter({ hasText: "Price history" });
  await expect(historyRow).toContainText("added 1");
  await expect(historyRow).toContainText("retained 1");
  await expect(panel).toContainText("No changes have been applied");
  await panel.getByRole("button", { name: "Apply selected areas" }).click();
  await expect(iron).toBeChecked();
  await expect(hiddenTiers.getByLabel("Hide bronze gear", { exact: true })).toBeChecked();
  const mergedCounts = await page.evaluate(() => ({
    duel: JSON.parse(window.localStorage.getItem("index-sim:duel-snapshots")!).data.snapshots
      .length,
    history: JSON.parse(window.localStorage.getItem("index-sim:price-history")!).data.snapshots
      .length
  }));
  expect(mergedCounts).toEqual({ duel: 2, history: 2 });
});

test("workspace restore warns on a different Revision and disables incompatible rows", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const panel = page.getByRole("region", { name: "Workspace backup and restore" });
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download full Workspace backup" }).click();
  const workspace = JSON.parse(await readDownloadText(await downloadPromise)) as {
    context: { gameDataId: string; gameRevision: number };
    areas: Array<{
      id: string;
      version: number;
      data: { form?: { monsterId?: string } };
    }>;
  };
  workspace.context = { gameDataId: "older-revision-snapshot", gameRevision: 273 };
  const setup = workspace.areas.find((area) => area.id === "rewrite-setup")!;
  setup.data.form!.monsterId = "removed_monster";

  await panel.getByLabel("Review Workspace backup file").setInputFiles({
    name: "workspace-different-revision.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace))
  });
  await expect(panel.getByRole("alert").first()).toContainText(
    "Created for Revision 273; this app uses Revision 274"
  );
  const table = panel.getByRole("table", { name: "Workspace restore areas" });
  const setupRow = table.getByRole("row").filter({ hasText: "Rewrite setup" });
  await expect(setupRow).toContainText("Unavailable references");
  await expect(setupRow.getByRole("checkbox")).toBeDisabled();
  await expect(setupRow.getByRole("combobox")).toBeDisabled();
  const plannerRow = table.getByRole("row").filter({ hasText: "Planner UI state" });
  await expect(plannerRow.getByRole("checkbox")).toBeEnabled();
  await expect(plannerRow.getByRole("checkbox")).toBeChecked();
});

test("workspace storage failure changes nothing until explicit session-only Apply and live-only Undo", async ({
  page
}) => {
  await page.goto("/");
  const attack = page.getByLabel("Combat setup").getByLabel("ATT", { exact: true });
  const attackBefore = await attack.inputValue();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const panel = page.getByRole("region", { name: "Workspace backup and restore" });
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup") !== null);
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download full Workspace backup" }).click();
  const workspace = JSON.parse(await readDownloadText(await downloadPromise)) as {
    areas: Array<{ id: string; data: unknown }>;
  };
  const setup = workspace.areas.find((area) => area.id === "rewrite-setup")!.data as {
    form: { levels: { attack: number } };
  };
  setup.form.levels.attack = 66;
  await panel.getByLabel("Review Workspace backup file").setInputFiles({
    name: "workspace-storage-failure.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace))
  });
  const durableBefore = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (!failed && key === "index-sim:planner-ui") {
        failed = true;
        throw new DOMException("forced private quota failure", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });

  await panel.getByRole("button", { name: "Apply selected areas" }).click();
  await expect(panel.getByText(/Storage was rolled back exactly/)).toBeVisible();
  await expect(attack).toHaveValue(attackBefore);
  const durableAfterFailure = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(durableAfterFailure).toEqual(durableBefore);

  await panel.getByRole("button", { name: "Apply for this session" }).click();
  await expect(attack).toHaveValue("66");
  const durableAfterSessionApply = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(durableAfterSessionApply).toEqual(durableBefore);

  const undo = page.getByRole("status", { name: "Local state undo" });
  await expect(undo).toContainText("for this session only");
  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(attack).toHaveValue(attackBefore);
  const durableAfterUndo = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  expect(durableAfterUndo).toEqual(durableBefore);
});
