import { expect, test } from "./scaffold-fixture";

test("numeric input drafts stay literal and only accepted values reach application state", async ({
  page
}) => {
  await page.goto("/");

  const player = page.getByRole("region", { name: "Player setup", exact: true });
  const attack = player.getByLabel("ATT", { exact: true });
  await expect(attack).toHaveValue("60");

  await attack.fill("");
  await expect(attack).toHaveValue("");
  await expect(attack).not.toHaveAttribute("aria-invalid");
  await page.keyboard.press("Tab");
  await expect(attack).toHaveAttribute("aria-invalid", "true");
  await expect(player).toContainText("Not applied — enter a value from 1 to 99.");

  await attack.focus();
  await attack.fill("12.5");
  await expect(attack).toHaveValue("12.5");
  await expect(attack).toHaveAttribute("aria-invalid", "true");
  await expect(player).toContainText("Not applied — enter a whole number.");
  await attack.press("Escape");
  await expect(attack).toHaveValue("60");
  await expect(attack).not.toHaveAttribute("aria-invalid");

  await attack.fill("0070");
  await expect(attack).toHaveValue("0070");
  await attack.press("Enter");
  await expect(attack).toHaveValue("70");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    return raw !== null && JSON.parse(raw).data.form.levels.attack === 70;
  });

  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Trip" }).click();
  const trip = page.getByLabel("Trip assumptions");
  await trip.getByLabel("Food per kill override").selectOption("on");
  const foodPerKill = trip.getByLabel("Food/kill");
  await foodPerKill.fill("1.");
  await expect(foodPerKill).toHaveValue("1.");
  await expect(foodPerKill).not.toHaveAttribute("aria-invalid");
  await foodPerKill.fill("0.50");
  await expect(foodPerKill).toHaveValue("0.50");
  await foodPerKill.press("Enter");
  await expect(foodPerKill).toHaveValue("0.5");
  await foodPerKill.fill("0.53");
  await expect(foodPerKill).toHaveAttribute("aria-invalid", "true");
  await expect(trip).toContainText("Not applied — use increments of 0.05.");
  await foodPerKill.press("Escape");
  await expect(foodPerKill).toHaveValue("0.5");

  await tabs.getByRole("tab", { name: "Melee setup" }).click();
  const overrides = page.getByLabel("Manual combat overrides");
  const accuracy = overrides.getByLabel("Accuracy bonus");
  const resetAll = overrides.getByRole("button", { name: "Reset all overrides" });

  await accuracy.fill("10");
  await accuracy.fill("");
  await expect(resetAll).toBeEnabled();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    return raw !== null && JSON.parse(raw).data.form.manualOverrides.accuracyBonus === 10;
  });
  await page.keyboard.press("Tab");
  await expect(accuracy).toHaveValue("");
  await expect(resetAll).toBeDisabled();

  await accuracy.fill("15");
  await accuracy.locator("xpath=following-sibling::button").click();
  await expect(accuracy).toHaveValue("");
  await expect(resetAll).toBeDisabled();

  await accuracy.fill("20");
  await accuracy.fill("broken");
  await expect(accuracy).toBeFocused();
  await resetAll.evaluate((button: HTMLButtonElement) => button.click());
  await expect(accuracy).toHaveValue("");
  await expect(overrides.getByRole("status")).toHaveText("Value updated by another action.");
  await accuracy.press("Tab");
  await expect(accuracy).toHaveValue("");

  await page.setViewportSize({ width: 390, height: 844 });
  await attack.scrollIntoViewIfNeeded();
  await attack.fill("100");
  await expect(attack).toHaveAttribute("aria-invalid", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
});
