import gameDataSource from "../../../gamedata.js?raw";
import engineSource from "../../../engine.js?raw";
import equipmentSource from "../../../equipment.js?raw";
import {
  createLegacyRuntimeContextFromSources,
  type LegacyRuntimeSourceBootstrapResult
} from "./source-bootstrap";

export type LegacyRuntimeBootstrapResult = LegacyRuntimeSourceBootstrapResult;

export async function loadBundledLegacyContext(): Promise<LegacyRuntimeBootstrapResult> {
  return createLegacyRuntimeContextFromSources({
    gameDataSource,
    engineSource,
    equipmentSource
  });
}
