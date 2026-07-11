import { expect, type Locator, type Page } from "@playwright/test";

import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  createDuelSnapshot
} from "../../../app/state/duel-snapshots";
import {
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  normalizePlannerUiState
} from "../../../app/state/planner";
import {
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  type BrowserPriceHistoryState
} from "../../../app/state/price-history";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  normalizeFormState,
  savedSetupFromForm,
  switchCombatStyleLoadout
} from "../../../app/state/ui-state";

export const VISUAL_NOW = "2026-07-10T12:00:00.000Z";

export const VISUAL_VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  compactLandscape: { width: 640, height: 360 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }
} as const;

interface VisualStateOptions {
  settingsReview?: boolean;
}

function persisted<T>(version: number, data: T) {
  return { version, savedAt: VISUAL_NOW, data };
}

function visualForms() {
  const melee = normalizeFormState(DEFAULT_FORM_STATE);
  return {
    melee,
    ranged: switchCombatStyleLoadout(melee, "ranged"),
    magic: switchCombatStyleLoadout(melee, "magic")
  };
}

function visualPriceHistory(): BrowserPriceHistoryState {
  return {
    snapshots: [
      {
        capturedAt: VISUAL_NOW,
        sourcePriceSetId: "visual-day-3",
        label: "Visual fixture day 3",
        itemPrices: { big_bones: 430, lobster: 172, rune_scimitar: 14_950, cannonball: 196 }
      },
      {
        capturedAt: "2026-07-09T12:00:00.000Z",
        sourcePriceSetId: "visual-day-2",
        label: "Visual fixture day 2",
        itemPrices: { big_bones: 405, lobster: 179, rune_scimitar: 15_100, cannonball: 188 }
      },
      {
        capturedAt: "2026-07-08T12:00:00.000Z",
        sourcePriceSetId: "visual-day-1",
        label: "Visual fixture day 1",
        itemPrices: { big_bones: 380, lobster: 185, rune_scimitar: 14_800, cannonball: 182 }
      }
    ]
  };
}

function visualStorage(options: VisualStateOptions): Record<string, string> {
  const forms = visualForms();
  const storage: Record<string, string> = {
    [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify(
      persisted(REWRITE_SETUP_VERSION, savedSetupFromForm(forms.melee))
    ),
    [DUEL_SNAPSHOTS_STORAGE_KEY]: JSON.stringify(
      persisted(DUEL_SNAPSHOTS_VERSION, {
        snapshots: [
          createDuelSnapshot("visual-melee", "Melee baseline", forms.melee),
          createDuelSnapshot("visual-ranged", "Ranged baseline", forms.ranged),
          createDuelSnapshot("visual-magic", "Magic baseline", forms.magic)
        ]
      })
    ),
    [PRICE_HISTORY_STORAGE_KEY]: JSON.stringify(
      persisted(PRICE_HISTORY_VERSION, visualPriceHistory())
    ),
    [PLANNER_UI_STORAGE_KEY]: JSON.stringify(
      persisted(
        PLANNER_UI_VERSION,
        normalizePlannerUiState({
          metric: "dps",
          targetLevels: { attack: 64, strength: 65, defence: 52, ranged: 55, magic: 55 },
          currentXp: {
            attack: 273_742,
            strength: 273_742,
            defence: 101_333,
            ranged: 101_333,
            magic: 101_333
          },
          skillLocks: {
            attack: false,
            strength: false,
            defence: true,
            ranged: false,
            magic: false
          },
          averageOverSession: true,
          onlyCurrentGear: false,
          gearPool: {}
        })
      )
    )
  };

  if (options.settingsReview) {
    storage.sim_input_v3 = JSON.stringify({
      combatType: "ranged",
      ranged: 72,
      defence: 63,
      hp: 64,
      prayer: 43,
      _monsterId: "greater_demon",
      weapon: "magic_shortbow",
      ammo: "rune_arrow",
      style: "rapid"
    });
    // This bounded invalid fixture is intentional: it exercises the sanitized recovery surface.
    storage[PLANNER_UI_STORAGE_KEY] = JSON.stringify({
      version: PLANNER_UI_VERSION + 1,
      savedAt: VISUAL_NOW,
      data: { fixture: "unsupported-version" }
    });
  }

  return storage;
}

export async function bootVisualApp(
  page: Page,
  viewport: keyof typeof VISUAL_VIEWPORTS,
  options: VisualStateOptions = {}
) {
  await page.setViewportSize(VISUAL_VIEWPORTS[viewport]);
  await page.clock.setFixedTime(new Date(VISUAL_NOW));
  await page.addInitScript((entries) => {
    window.localStorage.clear();
    for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
  }, visualStorage(options));

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
  await page.route("**/api/market/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: false,
        source: { id: "disabled", label: "Market provider disabled" },
        cache: { enabled: false },
        limits: { maxItemsPerRequest: 200, requestsPerSecond: 20 }
      })
    });
  });
  await page.route("**/api/hiscores?*", (route) => route.abort());
  await page.route("**/api/market/sync", (route) => route.abort());

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2004scape Combat Simulator" })).toBeVisible();
  await expect(page.getByLabel("Simulation results")).toBeVisible();
  await expect(page.getByLabel("Monster card")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "All monsters" }).locator("tbody tr").first()
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }"
  });
}

export async function openWorkbenchTab(page: Page, name: string) {
  await page.getByLabel("Workbench tabs").getByRole("tab", { name, exact: true }).click();
}

export async function openCombatSetup(page: Page, combatStyle: "melee" | "ranged" | "magic") {
  const label = combatStyle.charAt(0).toUpperCase() + combatStyle.slice(1);
  const combatType = page
    .getByLabel("Combat type")
    .getByRole("button", { name: combatStyle, exact: true });

  await combatType.click();
  await expect(combatType).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: `${label} setup`, exact: true })
  ).toHaveAttribute("aria-selected", "true");
}

export async function capturePane(locator: Locator, name: string) {
  await expect(locator).toBeVisible();
  await locator.page().evaluate(() => document.fonts.ready);
  await expect(locator).toHaveScreenshot(name);
}

export async function captureActivePane(page: Page, name: string) {
  const activePane = page.locator("#workbench-active-panel");
  await expect(activePane).toHaveAttribute("role", "tabpanel");
  await capturePane(activePane, name);
}

export async function captureFullPage(page: Page, name: string) {
  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}
