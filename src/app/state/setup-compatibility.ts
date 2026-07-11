import { supportedSpecialAttacksForCombatStyle, weaponStances } from "@/domain/combat";
import { EQUIPMENT_SLOTS, type CombatStyle, type GameDataSnapshot } from "@/domain/shared";
import { FOOD } from "@/domain/trip";
import {
  BOOST_SELECTION_OPTIONS,
  PRAYER_SELECTION_OPTIONS,
  type CombatSetupFormState,
  type SavedSetupState
} from "./ui-state";

const COMBAT_STYLES = ["melee", "ranged", "magic"] as const;
const MAX_COMPATIBILITY_ISSUES = 50;

function addIssue(issues: string[], path: string): void {
  if (issues.length < MAX_COMPATIBILITY_ISSUES && !issues.includes(path)) issues.push(path);
}

function validStyleIds(
  combatStyle: CombatStyle,
  weaponId: string,
  gameData: GameDataSnapshot
): Set<string> {
  if (combatStyle === "melee") {
    return new Set(weaponStances(weaponId, gameData).map((stance) => stance.id));
  }
  if (combatStyle === "ranged") return new Set(["accurate", "rapid", "longrange"]);
  return new Set(["accurate", "defensive", "longrange"]);
}

export function combatSetupCompatibilityIssues(
  form: CombatSetupFormState,
  gameData: GameDataSnapshot,
  prefix = "form"
): string[] {
  const issues: string[] = [];
  if (!gameData.monsters[form.monsterId]) addIssue(issues, `${prefix}.monsterId`);
  if (!Object.prototype.hasOwnProperty.call(FOOD, form.trip.foodKey)) {
    addIssue(issues, `${prefix}.trip.foodKey`);
  }

  const prayerIds = new Set(PRAYER_SELECTION_OPTIONS.map((option) => option.id));
  const boostIds = new Set(BOOST_SELECTION_OPTIONS.map((option) => option.id));
  for (const combatStyle of COMBAT_STYLES) {
    const loadout = form.perStyleLoadouts[combatStyle];
    const loadoutPath = `${prefix}.perStyleLoadouts.${combatStyle}`;
    const weapon = gameData.weapons[loadout.weaponId];
    if (!weapon || weapon.type !== combatStyle) addIssue(issues, `${loadoutPath}.weaponId`);
    if (loadout.ammoId !== "none" && !gameData.ammo[loadout.ammoId]) {
      addIssue(issues, `${loadoutPath}.ammoId`);
    }
    if (loadout.spellId !== "none" && !gameData.spells[loadout.spellId]) {
      addIssue(issues, `${loadoutPath}.spellId`);
    }
    if (!validStyleIds(combatStyle, loadout.weaponId, gameData).has(loadout.styleId)) {
      addIssue(issues, `${loadoutPath}.styleId`);
    }

    for (const slot of EQUIPMENT_SLOTS) {
      const itemId = loadout.gear[slot];
      if (itemId && itemId !== "none" && !gameData.equipment[slot]?.[itemId]) {
        addIssue(issues, `${loadoutPath}.gear.${slot}`);
      }
    }
    if (weapon?.twoHand && loadout.gear.shield && loadout.gear.shield !== "none") {
      addIssue(issues, `${loadoutPath}.gear.shield`);
    }
    if (combatStyle === "ranged" && weapon?.sub === "bow") {
      if (loadout.ammoId === "none" || gameData.ammo[loadout.ammoId]?.kind !== "arrow") {
        addIssue(issues, `${loadoutPath}.ammoId`);
      }
    } else if (combatStyle === "ranged" && weapon?.sub === "thrown") {
      if (!weapon.ammoKey || loadout.ammoId !== weapon.ammoKey) {
        addIssue(issues, `${loadoutPath}.ammoId`);
      }
    } else if (loadout.ammoId !== "none") {
      addIssue(issues, `${loadoutPath}.ammoId`);
    }
    if (loadout.prayers.some((id) => !prayerIds.has(id))) {
      addIssue(issues, `${loadoutPath}.prayers`);
    }
    if (loadout.boosts.some((id) => !boostIds.has(id))) {
      addIssue(issues, `${loadoutPath}.boosts`);
    }

    if (loadout.specialAttack.weaponId !== "none") {
      const supported = supportedSpecialAttacksForCombatStyle(combatStyle, gameData).some(
        (special) => special.weaponId === loadout.specialAttack.weaponId
      );
      if (!supported || !gameData.weapons[loadout.specialAttack.weaponId]) {
        addIssue(issues, `${loadoutPath}.specialAttack.weaponId`);
      }
    }
    if (loadout.specialAttack.ammoId !== "none" && !gameData.ammo[loadout.specialAttack.ammoId]) {
      addIssue(issues, `${loadoutPath}.specialAttack.ammoId`);
    }
  }
  return issues;
}

export function savedSetupCompatibilityIssues(
  setup: SavedSetupState,
  gameData: GameDataSnapshot
): string[] {
  const issues = [
    ...combatSetupCompatibilityIssues(setup.form, gameData, "form"),
    ...combatSetupCompatibilityIssues(setup.defaultForm, gameData, "defaultForm")
  ];
  Object.entries(setup.customSetupsByMonster).forEach(([monsterId, form], index) => {
    const prefix = `customSetupsByMonster[${index}]`;
    if (!gameData.monsters[monsterId]) addIssue(issues, `${prefix}.monsterId`);
    for (const issue of combatSetupCompatibilityIssues(form, gameData, prefix)) {
      addIssue(issues, issue);
    }
  });
  Object.keys(setup.cannonByMonster).forEach((monsterId, index) => {
    if (!gameData.monsters[monsterId]) addIssue(issues, `cannonByMonster[${index}].monsterId`);
  });
  return issues;
}

export function duelSnapshotsCompatibilityIssues(
  state: { snapshots: readonly { form: CombatSetupFormState }[] },
  gameData: GameDataSnapshot
): string[] {
  const issues: string[] = [];
  state.snapshots.forEach((snapshot, index) => {
    for (const issue of combatSetupCompatibilityIssues(
      snapshot.form,
      gameData,
      `snapshots[${index}].form`
    )) {
      addIssue(issues, issue);
    }
  });
  return issues;
}
