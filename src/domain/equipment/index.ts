import {
  BONUS_KEYS,
  EQUIPMENT_SLOTS,
  type AttackType,
  type CombatStyle,
  type EquipmentBonuses,
  type EntityId,
  type GameDataSnapshot,
  type GearSelection,
  type Loadout
} from "../shared";

export interface CombatLoadoutBonuses {
  accBonus: number;
  dmgBonus: number;
  accByType: Record<AttackType, number> | null;
  attackSpeed?: number;
  ammoRangeBonus: number;
  totals: EquipmentBonuses;
}

export function emptyEquipmentBonuses(): EquipmentBonuses {
  return Object.fromEntries(BONUS_KEYS.map((key) => [key, 0])) as EquipmentBonuses;
}

export function normalizeGear(
  gear: GearSelection
): Record<(typeof EQUIPMENT_SLOTS)[number], EntityId> {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, gear[slot] ?? "none"])) as Record<
    (typeof EQUIPMENT_SLOTS)[number],
    EntityId
  >;
}

export function sumEquipmentBonuses(
  loadout: Loadout,
  gameData: GameDataSnapshot
): EquipmentBonuses {
  const totals = emptyEquipmentBonuses();
  const gear = normalizeGear(loadout.gear);
  const weapon = gameData.weapons[loadout.weaponId];
  const add = (item: Partial<EquipmentBonuses> | undefined) => {
    if (!item) return;
    for (const key of BONUS_KEYS) {
      totals[key] += item[key] ?? 0;
    }
  };

  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === "shield" && weapon?.twoHand) continue;
    const itemId = gear[slot];
    if (itemId !== "none") {
      add(gameData.equipment[slot]?.[itemId]);
    }
  }

  let thrownAmmoId: EntityId | null = null;
  if (weapon) {
    if (weapon.type === "melee") {
      totals.stabAtt += weapon.acc?.stab ?? 0;
      totals.slashAtt += weapon.acc?.slash ?? weapon.accBonus;
      totals.crushAtt += weapon.acc?.crush ?? 0;
      totals.str += weapon.dmgBonus;
    } else if (weapon.type === "ranged") {
      totals.rngAtt += weapon.accBonus;
      totals.rngStr += weapon.dmgBonus;
    } else if (weapon.type === "magic") {
      totals.magAtt += weapon.accBonus;
    }

    if (weapon.sub === "thrown" && weapon.ammoKey) {
      thrownAmmoId = weapon.ammoKey;
    }
  }

  const ammoId = thrownAmmoId ?? loadout.ammoId;
  if (ammoId && ammoId !== "none") {
    const ammo = gameData.ammo[ammoId];
    if (ammo) {
      totals.rngAtt += ammo.rangeBonus;
      totals.rngStr += ammo.rangeBonus;
    }
  }

  return totals;
}

export function loadoutToCombatBonuses(
  loadout: Loadout,
  combatStyle: CombatStyle,
  gameData: GameDataSnapshot
): CombatLoadoutBonuses {
  const weapon = gameData.weapons[loadout.weaponId];
  const totals = sumEquipmentBonuses({ ...loadout, ammoId: "none" }, gameData);
  const ammoRangeBonus =
    combatStyle === "ranged" && weapon?.sub === "bow" && loadout.ammoId
      ? (gameData.ammo[loadout.ammoId]?.rangeBonus ?? 0)
      : 0;

  if (combatStyle === "melee") {
    return {
      accBonus: totals.slashAtt,
      dmgBonus: totals.str,
      accByType: {
        stab: totals.stabAtt,
        slash: totals.slashAtt,
        crush: totals.crushAtt
      },
      attackSpeed: weapon?.speed,
      ammoRangeBonus,
      totals
    };
  }

  if (combatStyle === "ranged") {
    return {
      accBonus: totals.rngAtt,
      dmgBonus: totals.rngStr,
      accByType: null,
      attackSpeed: weapon?.speed,
      ammoRangeBonus,
      totals
    };
  }

  return {
    accBonus: totals.magAtt,
    dmgBonus: 0,
    accByType: null,
    attackSpeed: weapon?.speed,
    ammoRangeBonus,
    totals
  };
}
