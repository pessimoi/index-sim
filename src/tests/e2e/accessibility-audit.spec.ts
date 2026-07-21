import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { ACCESSIBILITY_JOURNEYS } from "./accessibility-manifest";
import { expect, expectPageWidthContained, searchableCombobox, test } from "./scaffold-fixture";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

function conciseViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map(
      ({ id, impact, nodes }) =>
        `${impact ?? "unknown"} ${id} (${nodes.length} node${nodes.length === 1 ? "" : "s"}: ${nodes
          .slice(0, 4)
          .map(({ target }) => target.join(" "))
          .join(", ")})`
    )
    .join(", ");
}

async function scan(page: Page, testInfo: TestInfo, checkpoint: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
  const blocking = result.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical"
  );
  const lowerImpact = result.violations.filter(
    ({ impact }) => impact !== "serious" && impact !== "critical"
  );
  testInfo.annotations.push({
    type: "axe-summary",
    description: `${checkpoint}: ${result.passes.length} rules passed; ${result.violations.length} violations`
  });

  expect(blocking.length, `${checkpoint}: ${conciseViolations(blocking)}`).toBe(0);
  expect(
    lowerImpact.length,
    `${checkpoint}: lower-impact findings require an explicit disposition: ${conciseViolations(lowerImpact)}`
  ).toBe(0);
}

async function boot(page: Page, id: string): Promise<void> {
  const journey = ACCESSIBILITY_JOURNEYS.find((candidate) => candidate.id === id);
  if (!journey) throw new Error(`Unknown accessibility journey ${id}`);
  await page.setViewportSize(journey.viewport);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openTab(page: Page, name: string): Promise<void> {
  const tab = page.getByLabel("Workbench tabs").getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

test.describe("AT-01 through AT-12 automated accessibility manifest", () => {
  test("AT-01 scans the startup shell and selected Stats pane", async ({ page }, testInfo) => {
    await boot(page, "AT-01");
    await scan(page, testInfo, "AT-01 root shell");
    await openTab(page, "Stats");
    await scan(page, testInfo, "AT-01 Stats tab selected");
  });

  test("AT-02 scans combat setup and the open searchable selector", async ({ page }, testInfo) => {
    await boot(page, "AT-02");
    await openTab(page, "Melee setup");
    await scan(page, testInfo, "AT-02 Melee setup");

    const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
    await searchableCombobox(loadout, "Weapon").click();
    await expect(loadout.getByRole("combobox", { name: "Weapon", exact: true })).toBeFocused();
    await scan(page, testInfo, "AT-02 Weapon selector open");
  });

  test("AT-03 scans Stats and the Reset review", async ({ page }, testInfo) => {
    await boot(page, "AT-03");
    await page.getByLabel("Player levels").getByLabel("ATT", { exact: true }).fill("66");
    await openTab(page, "Stats");
    await scan(page, testInfo, "AT-03 Stats results");

    await page
      .getByLabel("Setup actions")
      .getByRole("button", { name: "Reset active setup" })
      .click();
    await expect(page.getByLabel("Reset active setup review")).toBeVisible();
    await scan(page, testInfo, "AT-03 Reset active setup review");
  });

  test("AT-04 scans the Dense table and its empty state", async ({ page }, testInfo) => {
    await boot(page, "AT-04");
    await openTab(page, "Monsters");
    await expect
      .poll(async () =>
        page.getByRole("table", { name: "All monsters" }).locator("tbody tr").count()
      )
      .toBeGreaterThan(8);
    await scan(page, testInfo, "AT-04 All monsters table");

    await page.getByLabel("Monster filter").fill("no matching monster fixture");
    await scan(page, testInfo, "AT-04 empty monster filter");
  });

  test("AT-05 scans empty and saved setup comparison states", async ({ page }, testInfo) => {
    await boot(page, "AT-05");
    await openTab(page, "Setups");
    await scan(page, testInfo, "AT-05 empty Setups");
    const setups = page.getByRole("region", { name: "Setup comparison", exact: true });
    await setups.getByRole("button", { name: "Save current setup" }).click();
    await expect(setups.getByRole("table")).toBeVisible();
    await scan(page, testInfo, "AT-05 saved setup comparison");
  });

  test("AT-06 scans Loot and Trip at the compact viewport", async ({ page }, testInfo) => {
    await boot(page, "AT-06");
    await openTab(page, "Loot");
    await scan(page, testInfo, "AT-06 Loot");
    await openTab(page, "Trip");
    await scan(page, testInfo, "AT-06 Trip");
  });

  test("AT-07 scans Risk and Cannon lifecycle surfaces", async ({ page }, testInfo) => {
    await boot(page, "AT-07");
    await openTab(page, "Risk");
    await scan(page, testInfo, "AT-07 Risk");
    await openTab(page, "Cannon");
    await scan(page, testInfo, "AT-07 Cannon");
  });

  test("AT-08 scans Planner controls and output", async ({ page }, testInfo) => {
    await boot(page, "AT-08");
    await openTab(page, "Planner");
    await expect(page.getByRole("region", { name: "Planner", exact: true })).toBeVisible();
    await scan(page, testInfo, "AT-08 Planner");
  });

  test("AT-09 scans Economy provenance, chart and manual-price surfaces", async ({
    page
  }, testInfo) => {
    await boot(page, "AT-09");
    await openTab(page, "Economy");
    await expect(page.getByRole("region", { name: "Economy", exact: true })).toBeVisible();
    await scan(page, testInfo, "AT-09 Economy overview");
  });

  test("AT-10 scans Settings backup and recovery surfaces", async ({ page }, testInfo) => {
    await boot(page, "AT-10");
    await openTab(page, "Settings");
    await expect(page.getByRole("region", { name: "Settings", exact: true })).toBeVisible();
    await scan(page, testInfo, "AT-10 Settings");
  });

  test("AT-11 scans the deterministic unavailable Hiscores state", async ({ page }, testInfo) => {
    await page.route("**/api/hiscores/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: false,
          source: { id: "disabled", label: "Hiscores provider disabled" },
          limits: { requestsPerMinute: 30 }
        })
      });
    });
    await boot(page, "AT-11");
    await expect(page.getByRole("region", { name: "Hiscores" })).toContainText(
      "Live hiscores lookup is not configured"
    );
    await scan(page, testInfo, "AT-11 Hiscores unavailable");
  });

  test("AT-12 scans the native Share dialog", async ({ page }, testInfo) => {
    await boot(page, "AT-12");
    await page.getByRole("button", { name: "Share setup" }).click();
    await expect(page.getByRole("dialog", { name: "Share setup" })).toBeVisible();
    await scan(page, testInfo, "AT-12 Share dialog");
  });
});

test("Reflow keeps navigation, focus and Settings available at 320 CSS pixels with 200% text", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });

  await expectPageWidthContained(page);
  const skipLink = page.getByRole("link", { name: "Skip to active workbench pane" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.getByRole("tabpanel")).toBeFocused();

  await openTab(page, "Settings");
  await expectPageWidthContained(page);
  await expect(page.getByRole("region", { name: "Settings", exact: true })).toBeVisible();
  await scan(page, testInfo, "320 CSS pixel reflow with 200% text");
});
