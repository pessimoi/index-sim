import {
  LostCityContentSourceError,
  lastConfigValue,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import {
  lostCityRuneScriptBlockKey,
  readLostCityRuneScriptCatalog,
  type LostCityRuneScriptBlock
} from "./lostcity-content-runescript";

export type { LostCityRuneScriptBlock } from "./lostcity-content-runescript";

export interface LostCityLootHandler {
  npcId: string;
  sourceRef: string;
  target?: string;
  block: LostCityRuneScriptBlock;
}

export interface LostCityLootHandlerCatalog {
  sourceDirLabel: string;
  fileCount: number;
  handlers: Map<string, LostCityLootHandler>;
  blocks: Map<string, LostCityRuneScriptBlock>;
}

export interface ReadLostCityLootHandlerCatalogOptions {
  repoRoot?: string;
  sourceDir: string;
}

export interface LostCityLootHandlerResolution {
  handler: LostCityLootHandler;
  kind: "direct" | "category";
}

export function readLostCityLootHandlerCatalog(
  options: ReadLostCityLootHandlerCatalogOptions
): LostCityLootHandlerCatalog {
  const scripts = readLostCityRuneScriptCatalog(options);
  const handlers = new Map<string, LostCityLootHandler>();
  for (const block of scripts.allBlocks) {
    if (block.kind !== "ai_queue3") continue;
    const npcId = block.id;
    const sourceRef = block.sourceRef;
    const previous = handlers.get(npcId);
    if (previous) {
      throw new LostCityContentSourceError(
        "duplicate_script_trigger",
        `LostCity ai_queue3 trigger \`${npcId}\` is duplicated in \`${previous.sourceRef}\` and \`${sourceRef}\`.`
      );
    }
    const target = block.headerSuffix.match(/^(@[A-Za-z0-9_]+);/)?.[1];
    handlers.set(npcId, {
      npcId,
      sourceRef,
      block,
      ...(target ? { target } : {})
    });
  }
  return {
    sourceDirLabel: scripts.sourceDirLabel,
    fileCount: scripts.fileCount,
    handlers,
    blocks: scripts.blocks
  };
}

export function resolveLostCityLootHandler(
  sourceId: string,
  npc: LostCityConfigEntry | undefined,
  catalog: LostCityLootHandlerCatalog
): LostCityLootHandlerResolution | undefined {
  const direct = catalog.handlers.get(sourceId);
  if (direct) return { handler: direct, kind: "direct" };
  const category = lastConfigValue(npc, "category");
  const categoryHandler = category ? catalog.handlers.get(`_${category}`) : undefined;
  return categoryHandler ? { handler: categoryHandler, kind: "category" } : undefined;
}

export function lostCityLootHandlerBlock(
  resolution: LostCityLootHandlerResolution,
  catalog: LostCityLootHandlerCatalog
): LostCityRuneScriptBlock {
  const target = resolution.handler.target?.replace(/^@/, "");
  if (!target) return resolution.handler.block;
  const block =
    catalog.blocks.get(lostCityRuneScriptBlockKey("label", target)) ??
    catalog.blocks.get(lostCityRuneScriptBlockKey("proc", target));
  if (!block) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity loot handler \`${resolution.handler.sourceRef}\` has an unresolved target.`
    );
  }
  return block;
}

export function lostCityRuneScriptBlock(
  catalog: LostCityLootHandlerCatalog,
  kind: "label" | "proc",
  id: string
): LostCityRuneScriptBlock | undefined {
  return catalog.blocks.get(lostCityRuneScriptBlockKey(kind, id));
}
