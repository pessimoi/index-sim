import gameDataSource from "../../../gamedata.js?raw";
import engineSource from "../../../engine.js?raw";
import equipmentSource from "../../../equipment.js?raw";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "@/data";
import type { SimulationContext } from "@/domain/shared";
import type { KeyValueStorage } from "../storage";

interface LegacySandbox extends Record<string, unknown> {
  window: LegacySandbox;
  GameData?: LegacySnapshotInput["gameData"];
  SimEngine?: LegacySnapshotInput["simEngine"];
  Equipment?: LegacySnapshotInput["equipment"];
  localStorage: KeyValueStorage;
}

export interface BrowserBootstrapResult {
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

export async function loadBundledLegacyContext(): Promise<BrowserBootstrapResult> {
  const sandbox = createSandbox();
  executeLegacySource(sandbox, gameDataSource, "legacy-gamedata.js");
  executeLegacySource(sandbox, engineSource, "legacy-engine.js");
  executeLegacySource(sandbox, equipmentSource, "legacy-equipment.js");

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

export function downloadJsonFile(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readBrowserFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${maxBytes} bytes`);
  }
  return file.text();
}
