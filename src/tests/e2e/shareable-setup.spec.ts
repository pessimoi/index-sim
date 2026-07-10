import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildShareableSetupEnvelope,
  encodeShareableSetupEnvelope
} from "../../app/state/shareable-setup";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  normalizeFormState,
  savedSetupFromForm
} from "../../app/state/ui-state";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { lootPreferenceKeysForMonster } from "../../domain/trip";

const GAME_DATA = parseGameDataSnapshot(
  JSON.parse(readFileSync(new URL("../../data/generated/game-data.json", import.meta.url), "utf8"))
);

function playerAttackField(page: Page) {
  return page.getByRole("region", { name: "Player setup" }).getByLabel("ATT", { exact: true });
}

function sharedPayload(options: { gameDataId?: string; attack?: number } = {}): string {
  const form = normalizeFormState({
    ...DEFAULT_FORM_STATE,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: options.attack ?? 71 }
  });
  const firstLootRow = lootPreferenceKeysForMonster(GAME_DATA.monsters[form.monsterId])[0] ?? "";
  return encodeShareableSetupEnvelope(
    buildShareableSetupEnvelope({
      gameDataId: options.gameDataId ?? GAME_DATA.id,
      form,
      cannon: { enabled: true, targets: 4, respawnSec: 18 },
      lootPreferences: { [firstLootRow]: "bury" },
      lootSettings: { highAlch: true, overheadSec: 3, talismanSpot: "overground" }
    })
  );
}

test("creates a selectable setup link and keeps clipboard failure recoverable", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { __copiedSetupLink?: string }).__copiedSetupLink = value;
        }
      }
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Share setup" }).click();
  const dialog = page.getByRole("dialog", { name: "Share setup" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Hill Giant");
  await expect(dialog).toContainText("Player levels included");
  const linkField = dialog.getByLabel("Setup link");
  await expect(linkField).toHaveValue(/#setup=[A-Za-z0-9_-]+$/);

  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.getByText("Link copied")).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { __copiedSetupLink?: string }).__copiedSetupLink)
  ).toBe(await linkField.inputValue());

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) }
    });
  });
  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.getByText(/Clipboard unavailable/)).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Share setup" })).toBeFocused();
});

test("reviews a shared setup before writing then loads and undoes all owned state", async ({
  page
}) => {
  const initialForm = normalizeFormState(DEFAULT_FORM_STATE);
  const initialSetup = {
    version: REWRITE_SETUP_VERSION,
    savedAt: "2026-07-10T12:00:00.000Z",
    data: savedSetupFromForm(initialForm)
  };
  await page.addInitScript(
    ({ storageKey, setup }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(setup));
      window.localStorage.setItem("unrelated-key", "keep-me");
    },
    { storageKey: REWRITE_SETUP_STORAGE_KEY, setup: initialSetup }
  );

  await page.goto(`/#setup=${sharedPayload()}`);
  const review = page.getByLabel("Shared setup review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Hill Giant");
  await expect(review).toContainText("Uses your current prices");
  await expect(page).toHaveURL(/\/$/);
  await expect(playerAttackField(page)).toHaveValue("60");
  expect(
    await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw).data.form.levels.attack : null;
    }, REWRITE_SETUP_STORAGE_KEY)
  ).toBe(60);

  await review.getByRole("button", { name: "Load setup" }).click();
  await expect(review).toBeHidden();
  await expect(playerAttackField(page)).toHaveValue("71");
  await expect(page.getByText("Loaded shared setup for Hill Giant", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((storageKey) => {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw).data.form.levels.attack : null;
      }, REWRITE_SETUP_STORAGE_KEY)
    )
    .toBe(71);
  expect(
    await page.evaluate(() => ({
      unrelated: window.localStorage.getItem("unrelated-key"),
      priceHistory: window.localStorage.getItem("index-sim:price-history"),
      cannon: JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup") ?? "{}").data
        .cannonByMonster.giant,
      lootPrefs: JSON.parse(window.localStorage.getItem("index-sim:loot-prefs") ?? "{}").data.giant,
      lootSettings: JSON.parse(window.localStorage.getItem("index-sim:loot-settings") ?? "{}").data
        .giant
    }))
  ).toMatchObject({
    unrelated: "keep-me",
    priceHistory: null,
    cannon: { enabled: true, targets: 4, respawnSec: 18 },
    lootSettings: { highAlch: true, overheadSec: 3, talismanSpot: "overground" }
  });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(playerAttackField(page)).toHaveValue("60");
  await expect(page.locator(".topbar").getByText(/Restored pre-share setup/)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((storageKey) => {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw).data.cannonByMonster.giant ?? null) : "missing";
      }, REWRITE_SETUP_STORAGE_KEY)
    )
    .toBeNull();
});

test("dismisses or rejects shared setup links without changing the active setup", async ({
  page
}) => {
  await page.goto(`/#setup=${sharedPayload({ gameDataId: "older-revision" })}`);
  const review = page.getByLabel("Shared setup review");
  await expect(review).toContainText("Different game-data version");
  await review.getByRole("button", { name: "Dismiss" }).click();
  await expect(review).toBeHidden();
  await expect(playerAttackField(page)).toHaveValue("60");

  await page.goto("about:blank");
  await page.goto("/#setup=not_valid_%25_payload");
  const invalidReview = page.getByLabel("Shared setup review");
  await expect(invalidReview).toContainText("Shared setup link is invalid");
  await expect(invalidReview.getByRole("button", { name: "Load setup" })).toHaveCount(0);
  await expect(playerAttackField(page)).toHaveValue("60");
  await expect(page).toHaveURL(/\/$/);
});
