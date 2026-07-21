import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildShareableSetupEnvelope,
  encodeShareableSetupEnvelope
} from "../../app/state/shareable-setup";
import { DEFAULT_FORM_STATE } from "../../app/state/ui-state";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { expectPageWidthContained } from "./scaffold-fixture";

const GAME_DATA = parseGameDataSnapshot(
  JSON.parse(readFileSync(new URL("../../data/generated/game-data.json", import.meta.url), "utf8"))
);

function fixtureSharePayload(): string {
  return encodeShareableSetupEnvelope(
    buildShareableSetupEnvelope({
      gameData: GAME_DATA,
      form: DEFAULT_FORM_STATE,
      cannon: { enabled: false, targets: 3, respawnSec: null },
      lootPreferences: {},
      lootSettings: { highAlch: true, overheadSec: 2, talismanSpot: "overground" }
    })
  );
}

async function expectActivePane(
  page: Page,
  input: { tab: string; pane: string; family: string }
): Promise<void> {
  const tabs = page.getByRole("tablist", { name: "Workbench tabs" });
  await expect(tabs.getByRole("tab", { name: input.tab, exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  const panel = page.getByRole("tabpanel", { name: input.tab, exact: true });
  await expect(panel).toHaveAttribute("data-pane-family", input.family);
  await expect(panel).toHaveAttribute("data-pane-load-state", "ready", { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`[?&]pane=${input.pane}(?:[&#]|$)`));
  await expect(page).toHaveTitle(`${input.tab} · Hill Giant · 2004scape Combat Simulator`);
}

test("restores workbench pane through browser history", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/?pane=planner");
  await expectActivePane(page, { tab: "Planner", pane: "planner", family: "planner" });
  const planner = page.getByRole("region", { name: "Planner", exact: true });
  await planner.getByLabel("Attack target").fill("75");
  const playerAttack = page
    .getByRole("region", { name: "Player setup" })
    .getByLabel("ATT", { exact: true });
  await playerAttack.fill("73");

  const initialHistoryLength = await page.evaluate(() => history.length);
  await page.getByRole("tab", { name: "Economy", exact: true }).click();
  await expectActivePane(page, { tab: "Economy", pane: "economy", family: "economy-settings" });
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 1);

  await page.getByRole("button", { name: "Edit potion carry and prayer restore" }).click();
  await expectActivePane(page, { tab: "Trip", pane: "trip", family: "trip" });
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 2);
  await page.getByRole("tab", { name: "Trip", exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 2);

  await page.goBack();
  await expectActivePane(page, { tab: "Economy", pane: "economy", family: "economy-settings" });
  await page.goBack();
  await expectActivePane(page, { tab: "Planner", pane: "planner", family: "planner" });
  await expect(planner.getByLabel("Attack target")).toHaveValue("75");

  await page.goForward();
  await expectActivePane(page, { tab: "Economy", pane: "economy", family: "economy-settings" });
  await page.goForward();
  await expectActivePane(page, { tab: "Trip", pane: "trip", family: "trip" });
  const tripSafespot = page
    .getByRole("region", { name: "Trip assumptions" })
    .getByLabel("Safespot");
  await tripSafespot.focus();
  await expect(tripSafespot).toBeFocused();
  await page.goBack();
  await expectActivePane(page, { tab: "Economy", pane: "economy", family: "economy-settings" });
  await expect(page.getByRole("tab", { name: "Economy", exact: true })).toBeFocused();
  await page.goBack();
  await expectActivePane(page, { tab: "Planner", pane: "planner", family: "planner" });

  await page.reload();
  await expectActivePane(page, { tab: "Planner", pane: "planner", family: "planner" });
  await expect(playerAttack).toHaveValue("73");

  const plannerTab = page.getByRole("tab", { name: "Planner", exact: true });
  await plannerTab.focus();
  await page.keyboard.press("ArrowRight");
  await expectActivePane(page, { tab: "Economy", pane: "economy", family: "economy-settings" });
  await expect(page.getByRole("tab", { name: "Economy", exact: true })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const more = page.locator("details.workbench-more-tabs");
  await more.locator(":scope > summary").click();
  await more.getByRole("button", { name: "Trip", exact: true }).click();
  await expectActivePane(page, { tab: "Trip", pane: "trip", family: "trip" });
  await expectPageWidthContained(page);

  await page.goto("/?x=1&pane=bad&pane=trip#note=keep");
  await expect(page.getByRole("tab", { name: "Monsters", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page).toHaveURL(/\/?x=1#note=keep$/);
  await expect(page).toHaveTitle("Monsters · Hill Giant · 2004scape Combat Simulator");

  await page.goto(
    `/?pane=planner&index_sim_safe_session=1#setup=${fixtureSharePayload()}&note=keep`
  );
  await expectActivePane(page, { tab: "Planner", pane: "planner", family: "planner" });
  await expect(page.getByRole("status", { name: "Session-only safe mode" })).toBeVisible();
  await expect(page.getByLabel("Shared setup review")).toBeVisible();
  await expect(page).toHaveURL(/\?pane=planner&index_sim_safe_session=1#note=keep$/);

  await page.getByRole("button", { name: "Share setup" }).click();
  const cleanShareUrl = await page
    .getByRole("dialog", { name: "Share setup" })
    .getByLabel("Setup link")
    .inputValue();
  expect(cleanShareUrl).toMatch(/^http:\/\/127\.0\.0\.1:5173\/#setup=/);
  expect(cleanShareUrl).not.toContain("pane=");
  expect(cleanShareUrl).not.toContain("index_sim_safe_session");
});
