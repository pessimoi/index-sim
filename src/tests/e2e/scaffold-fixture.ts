import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createGeneratedRuntimePriceSet } from "../../adapters/generated/price-fallback";
import { createScheduledStaticPriceSnapshotStatus } from "../../adapters/market";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION } from "../../app/state/loot-prefs";
import { LOOT_SETTINGS_STORAGE_KEY, LOOT_SETTINGS_VERSION } from "../../app/state/loot-settings";
import {
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY
} from "../../app/state/manual-price-overrides";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  createDuelSnapshot
} from "../../app/state/duel-snapshots";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupEnvelopeSchema,
  savedSetupFromForm
} from "../../app/state/ui-state";
import { formatDuration, formatNumber } from "../../app/view-models/formatting";
import { createSimulationViewModel } from "../../app/view-models/simulation";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { LEGACY_GOLDEN_CASES } from "../fixtures/legacy-case-definitions";
import { createRewriteFixtureCase } from "../helpers/rewrite-fixture";

const RESULT_NUMERIC_LABELS = [
  "DPS",
  "MAX HIT",
  "HIT %",
  "XP/HR",
  "GP/HR NET",
  "KILLS/HR",
  "GP/KILL",
  "SUPPLY/KILL"
] as const;

export const ALL_FIXTURE_NUMERIC_LABELS = [
  "DPS",
  "MAX HIT",
  "HIT %",
  "TTK",
  "KILLS/HR",
  "XP/HR",
  "GP/HR",
  "GP/HR NET",
  "SUPPLY/KILL",
  "GP/KILL"
] as const;

const GENERATED_BROWSER_FIXTURE_GAME_DATA = parseGameDataSnapshot(
  JSON.parse(readFileSync(new URL("../../data/generated/game-data.json", import.meta.url), "utf8"))
);
const GENERATED_BROWSER_FIXTURE_PRICE_STATUS = createScheduledStaticPriceSnapshotStatus(
  {
    pricesText: readFileSync(new URL("../../../prices.json", import.meta.url), "utf8"),
    priceProvenanceText: readFileSync(
      new URL("../../../price-provenance.json", import.meta.url),
      "utf8"
    ),
    alchText: readFileSync(new URL("../../../alch.json", import.meta.url), "utf8"),
    priceHistoryText: readFileSync(new URL("../../../price-history.json", import.meta.url), "utf8")
  },
  { loadedAt: "2026-07-10T00:00:00.000Z" }
);
if (
  GENERATED_BROWSER_FIXTURE_PRICE_STATUS.status !== "loaded" ||
  GENERATED_BROWSER_FIXTURE_PRICE_STATUS.scheduledPriceSet === null
) {
  throw new Error("Scheduled browser fixture PriceSet is unavailable.");
}
export const GENERATED_BROWSER_FIXTURE_CONTEXT = {
  gameData: GENERATED_BROWSER_FIXTURE_GAME_DATA,
  priceSet: createGeneratedRuntimePriceSet(
    GENERATED_BROWSER_FIXTURE_PRICE_STATUS.scheduledPriceSet,
    GENERATED_BROWSER_FIXTURE_GAME_DATA
  )
};

export async function readDownloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export const CANNON_NUMERIC_LABELS = [
  "Effective targets",
  "Cannon DPS",
  "Balls/hr",
  "Balls/kill",
  "Cannon Ranged XP/hr",
  "Effective XP/hr",
  "Effective net GP/hr",
  "Ball cost/hr",
  "Ball cost/kill",
  "Ball price",
  "Cannonballs/trip",
  "Ball gp/trip",
  "K/hr uplift"
] as const;

export const TRIP_NUMERIC_LABELS = [
  "Prayer/kill",
  "Prayer slots",
  "Max kills prayer",
  "Food count",
  "Food/kill",
  "Kills/trip",
  "Effective K/hr",
  "Recoil/kill",
  "Recoil gp/kill"
] as const;

export async function metricSnapshot(region: Locator, labels: readonly string[]) {
  await expect(region).toBeVisible();
  const entries = await region.locator(".metric").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.querySelector("span")?.textContent?.trim() ?? "",
      value: node.querySelector("strong")?.textContent?.trim() ?? ""
    }))
  );

  return Object.fromEntries(
    labels.map((label) => {
      const entry = entries.find((item) => item.label === label);
      expect(entry?.value, `Missing metric ${label}`).toBeDefined();
      return [label, entry?.value ?? ""];
    })
  );
}

export async function resultMetricSnapshot(page: Page) {
  return metricSnapshot(page.getByLabel("Simulation results"), RESULT_NUMERIC_LABELS);
}

export function allFixtureExpectedMetrics(vm: ReturnType<typeof createSimulationViewModel>) {
  return {
    DPS: formatNumber(vm.combat.effectiveDps, 2),
    "MAX HIT": formatNumber(vm.combat.maxHit, 1),
    "HIT %": `${formatNumber(vm.combat.hitChance * 100, 1)}%`,
    TTK: formatDuration(vm.combat.ttkSec),
    "KILLS/HR": formatNumber(vm.trip.killsPerHour),
    "XP/HR": formatNumber(vm.effectiveXpPerHour),
    "GP/HR": formatNumber(vm.trip.gpPerHour),
    "GP/HR NET": formatNumber(vm.trip.effectiveNetGpPerHour),
    "SUPPLY/KILL": formatNumber(vm.trip.supply.supplyCostPerKill),
    "GP/KILL": formatNumber(vm.trip.gpPerKill)
  };
}

export function fixtureStorageEnvelope<T>(version: number, data: T) {
  return {
    version,
    savedAt: "2026-07-10T00:00:00.000Z",
    data
  };
}

export function activeMonsterDefence(card: Locator) {
  return card.getByLabel("Monster defence").locator('[aria-current="true"]');
}

export async function denseNumericSnapshot(table: Locator, rowName: RegExp) {
  const comparePanel = table.locator('xpath=ancestor::section[@aria-label="Monster comparison"]');
  await expect(
    comparePanel.getByRole("status", { name: /Compare calculation status/i })
  ).toHaveText("Current", { timeout: 30_000 });
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible();
  const cells = (await row.locator("td").allTextContents()).map((text) => text.trim());
  expect(cells).toHaveLength(10);
  return {
    hit: cells[1],
    max: cells[2],
    dps: cells[3],
    ttk: cells[4],
    killsPerHour: cells[5],
    xpPerHour: cells[6],
    gpPerKill: cells[7],
    gpPerHour: cells[8],
    netGpPerHour: cells[9]
  };
}

export async function expectDenseRowMax(table: Locator, rowName: RegExp, value: string) {
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row.locator("td").nth(2)).toHaveText(value, { timeout: 30000 });
}

export async function expectActiveDenseRow(table: Locator, rowName: RegExp) {
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(row.locator("td").first()).toContainText(">");
  return row;
}

export async function expectPageWidthContained(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.clientWidth).toBeLessThanOrEqual(metrics.viewportWidth);
}

export async function expectInsideBox(container: Locator, target: Locator) {
  const [containerBox, targetBox] = await Promise.all([
    container.boundingBox(),
    target.boundingBox()
  ]);
  expect(containerBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  expect(targetBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(
    containerBox!.x + containerBox!.width + 1
  );
}

export function searchableCombobox(region: Page | Locator, label: string): Locator {
  return region.getByRole("combobox", { name: label, exact: true });
}

export async function selectCombatType(
  page: Page,
  combatStyle: "melee" | "ranged" | "magic"
): Promise<void> {
  const label = combatStyle.charAt(0).toUpperCase() + combatStyle.slice(1);
  const button = page
    .getByLabel("Combat type")
    .getByRole("button", { name: combatStyle, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: `${label} setup` })
  ).toHaveAttribute("aria-selected", "true");
}

function accessibleNameStartingWith(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s|\\()`, "i");
}

export async function chooseSearchableOption(
  region: Page | Locator,
  label: string,
  optionLabel: string,
  exact = false
): Promise<Locator> {
  const combobox = searchableCombobox(region, label);
  await combobox.click();
  const search = region.getByRole("searchbox", { name: `Search ${label} options`, exact: true });
  await search.fill(optionLabel);
  const listbox = region.getByRole("listbox", { name: `${label} options`, exact: true });
  const option = exact
    ? listbox.getByRole("option", { name: optionLabel, exact: true })
    : listbox.getByRole("option", { name: accessibleNameStartingWith(optionLabel) });
  await option.click();
  return combobox;
}

export async function expectAppStatus(page: Page, status: string): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: status })).toHaveText(status);
}

export async function expectSearchableSelection(
  region: Page | Locator,
  label: string,
  selectedId: string
): Promise<void> {
  await expect(searchableCombobox(region, label)).toHaveAttribute("data-selected-id", selectedId);
}

export async function searchableOptionLabels(
  region: Page | Locator,
  label: string
): Promise<string[]> {
  await searchableCombobox(region, label).click();
  const listbox = region.getByRole("listbox", { name: `${label} options`, exact: true });
  const labels = await listbox
    .getByRole("option")
    .evaluateAll((options) =>
      options.map((option) => option.getAttribute("aria-label") ?? option.textContent?.trim() ?? "")
    );
  await region.getByRole("searchbox", { name: `Search ${label} options` }).press("Escape");
  return labels;
}

export async function expectPopupSearch(region: Page | Locator, label: string): Promise<void> {
  const combobox = searchableCombobox(region, label);
  await combobox.click();
  const search = region.getByRole("searchbox", { name: `Search ${label} options`, exact: true });
  const listbox = region.getByRole("listbox", { name: `${label} options`, exact: true });
  const popover = search.locator(
    "xpath=ancestor::div[contains(@class, 'searchable-combobox-popover')]"
  );
  await expect(search).toBeFocused();
  await expect(listbox).toBeVisible();
  await expect(popover.getByText("Find", { exact: true })).toHaveCount(0);
  await expect(popover.getByRole("status")).toHaveText(/\d+ of \d+ options/);
  await search.press("Escape");
  await expect(combobox).toBeFocused();
  await expect(listbox).toHaveCount(0);
}

export async function denseTableOverflowMetrics(wrap: Locator) {
  return wrap.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      overflowX: style.overflowX,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth
    };
  });
}
export {
  DEFAULT_FORM_STATE,
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  LEGACY_GOLDEN_CASES,
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupEnvelopeSchema,
  createDuelSnapshot,
  createRewriteFixtureCase,
  createSimulationViewModel,
  expect,
  savedSetupFromForm,
  test
};
export type { Locator };
