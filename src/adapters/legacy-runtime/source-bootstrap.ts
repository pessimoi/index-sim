import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../../data/legacy-adapter";
import type { SimulationContext } from "../../domain/shared";
import type { KeyValueStorage } from "../storage";

interface LegacySandbox extends Record<string, unknown> {
  window: LegacySandbox;
  GameData?: LegacySnapshotInput["gameData"];
  SimEngine?: LegacySnapshotInput["simEngine"];
  Equipment?: LegacySnapshotInput["equipment"];
  localStorage: KeyValueStorage;
}

export interface LegacyRuntimeSourceTexts {
  gameDataSource: string;
  engineSource: string;
  equipmentSource: string;
}

export interface LegacyRuntimeSourceBootstrapResult {
  context: SimulationContext;
  source: "legacy-bundled-sandbox";
}

function executeLegacySource(sandbox: LegacySandbox, source: string, label: string): void {
  const runner = new Function(
    "window",
    "localStorage",
    "console",
    `${source}\n//# sourceURL=${label}`
  );
  runner(sandbox, sandbox.localStorage, console);
}

function createSandbox(): LegacySandbox {
  const storage = new Map<string, string>();
  const sandbox = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      }
    }
  } as LegacySandbox;
  sandbox.window = sandbox;
  return sandbox;
}

export function createLegacyRuntimeContextFromSources(
  sources: LegacyRuntimeSourceTexts
): LegacyRuntimeSourceBootstrapResult {
  const sandbox = createSandbox();
  executeLegacySource(sandbox, sources.gameDataSource, "legacy-gamedata.js");
  executeLegacySource(sandbox, sources.engineSource, "legacy-engine.js");
  executeLegacySource(sandbox, sources.equipmentSource, "legacy-equipment.js");

  if (!sandbox.GameData || !sandbox.SimEngine || !sandbox.Equipment) {
    throw new Error("Legacy bundled data did not expose GameData, SimEngine and Equipment");
  }

  const gameData = createGameDataSnapshotFromLegacy({
    gameData: sandbox.GameData,
    simEngine: sandbox.SimEngine,
    equipment: sandbox.Equipment,
    id: "browser-legacy-runtime",
    label: "Browser bundled legacy runtime"
  });
  const priceSet = createPriceSetFromLegacyGameData({
    gameData: sandbox.GameData,
    id: "browser-legacy-prices",
    label: "Browser bundled legacy prices"
  });

  return {
    context: { gameData, priceSet },
    source: "legacy-bundled-sandbox"
  };
}
