export type EntityDisplayLabelSource = "game-data" | "row-source" | "fallback";

export interface EntityDisplayLabel {
  name: string;
  technicalId: string | null;
  source: EntityDisplayLabelSource;
}

export function humanizeTechnicalId(technicalId: string): string {
  const words = technicalId.replaceAll("_", " ").trim().replace(/\s+/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown item";
}

export function createEntityDisplayLabel(input: {
  technicalId: string | null;
  gameDataName?: string | null;
  rowSourceName?: string | null;
}): EntityDisplayLabel {
  const gameDataName = input.gameDataName?.trim();
  if (gameDataName) {
    return { name: gameDataName, technicalId: input.technicalId, source: "game-data" };
  }
  const rowSourceName = input.rowSourceName?.trim();
  if (rowSourceName) {
    return { name: rowSourceName, technicalId: input.technicalId, source: "row-source" };
  }
  return {
    name: input.technicalId ? humanizeTechnicalId(input.technicalId) : "Unknown item",
    technicalId: input.technicalId,
    source: "fallback"
  };
}

export const COMPACT_ACCESSIBLE_LABELS: Readonly<Record<string, string>> = {
  HP: "Hitpoints",
  ACC: "Accuracy",
  "ACC+": "Accuracy bonus",
  "M+%": "Magic accuracy percentage bonus",
  DMG: "Damage",
  "DMG+": "Damage bonus",
  "DMG%": "Magic damage percentage bonus",
  SPD: "Attack speed in seconds",
  "HIT %": "Hit chance percentage",
  MAX: "Maximum hit",
  "MAX HIT": "Maximum hit",
  DPS: "Damage per second",
  TTK: "Time to kill",
  "K/HR": "Kills per hour",
  "K/hr": "Kills per hour",
  "KILLS/HR": "Kills per hour",
  "XP/HR": "Experience points per hour",
  "XP/hr": "Experience points per hour",
  "XP/KL": "Experience points per kill",
  "XP/kill": "Experience points per kill",
  "GP/KL": "Gold pieces per kill",
  "GP/KILL": "Gold pieces per kill",
  "GP/kill": "Gold pieces per kill",
  "GP/HR": "Gold pieces per hour",
  "GP/hr": "Gold pieces per hour",
  "NET GP/HR": "Net gold pieces per hour",
  "GP/HR NET": "Net gold pieces per hour",
  "Net GP/hr": "Net gold pieces per hour",
  "GP/XP": "Gold pieces per experience point",
  "SUPPLY/KILL": "Supply cost per kill",
  "F/KL": "Food per kill",
  EV: "Expected value",
  "EV/kill": "Expected value per kill",
  "Delta/hr": "Net gold pieces change per hour",
  Qty: "Quantity",
  s: "Seconds",
  sec: "Seconds",
  min: "Minutes",
  hr: "Hours",
  tick: "Game tick",
  ticks: "Game ticks",
  GP: "Gold pieces",
  XP: "Experience points"
};

export function expandedCompactLabel(label: string): string | null {
  return COMPACT_ACCESSIBLE_LABELS[label] ?? null;
}

export type SemanticUnit = "second" | "minute" | "tick" | "hour" | "day" | "gp" | "xp";

export interface SemanticUnitValue {
  visible: string;
  accessible: string;
}

export function formatSemanticUnitValue(
  formattedValue: string,
  numericValue: number,
  unit: SemanticUnit
): SemanticUnitValue {
  const singular = numericValue === 1;
  if (unit === "second") {
    return {
      visible: `${formattedValue} s`,
      accessible: `${formattedValue} ${singular ? "second" : "seconds"}`
    };
  }
  if (unit === "minute") {
    return {
      visible: `${formattedValue} min`,
      accessible: `${formattedValue} ${singular ? "minute" : "minutes"}`
    };
  }
  if (unit === "tick") {
    return {
      visible: `${formattedValue} ${singular ? "tick" : "ticks"}`,
      accessible: `${formattedValue} ${singular ? "game tick" : "game ticks"}`
    };
  }
  if (unit === "hour") {
    return {
      visible: `${formattedValue} hr`,
      accessible: `${formattedValue} ${singular ? "hour" : "hours"}`
    };
  }
  if (unit === "day") {
    return {
      visible: `${formattedValue} ${singular ? "day" : "days"}`,
      accessible: `${formattedValue} ${singular ? "day" : "days"}`
    };
  }
  if (unit === "gp") {
    return { visible: `${formattedValue} GP`, accessible: `${formattedValue} gold pieces` };
  }
  return {
    visible: `${formattedValue} XP`,
    accessible: `${formattedValue} experience points`
  };
}
