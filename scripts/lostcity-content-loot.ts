import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  LostCityContentSourceError,
  lastConfigValue,
  type LostCityConfigEntry
} from "./lostcity-content-config";

export interface LostCityLootHandler {
  npcId: string;
  sourceRef: string;
  target?: string;
  block: LostCityRuneScriptBlock;
}

export interface LostCityRuneScriptBlock {
  kind: string;
  id: string;
  sourceRef: string;
  headerSuffix: string;
  lines: string[];
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

function pathInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function repoRelativeLabel(repoRoot: string, target: string): string {
  return relative(repoRoot, target).replaceAll(sep, "/") || ".";
}

function runeScriptFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && target.endsWith(".rs2")) files.push(target);
    }
  };
  visit(root);
  return files.sort();
}

function blockKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function parseRuneScriptBlocks(file: string, sourceDir: string): LostCityRuneScriptBlock[] {
  const fileLabel = relative(sourceDir, file).replaceAll(sep, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const blocks: LostCityRuneScriptBlock[] = [];
  let current: LostCityRuneScriptBlock | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.trim().match(/^\[([^,\]]+),([^\]]+)\](.*)$/);
    if (match) {
      current = {
        kind: match[1],
        id: match[2],
        sourceRef: `${fileLabel}:${index + 1}#${match[2]}`,
        headerSuffix: match[3].trim(),
        lines: []
      };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return blocks;
}

export function readLostCityLootHandlerCatalog(
  options: ReadLostCityLootHandlerCatalogOptions
): LostCityLootHandlerCatalog {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const sourceDir = resolve(repoRoot, options.sourceDir);
  if (!pathInside(repoRoot, sourceDir)) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity content source directory must stay inside the repository."
    );
  }
  const sourceDirLabel = repoRelativeLabel(repoRoot, sourceDir);
  if (!existsSync(sourceDir)) {
    throw new LostCityContentSourceError(
      "source_missing",
      `LostCity content source directory \`${sourceDirLabel}\` does not exist.`
    );
  }
  if (!statSync(sourceDir).isDirectory()) {
    throw new LostCityContentSourceError(
      "source_not_directory",
      `LostCity content source path \`${sourceDirLabel}\` is not a directory.`
    );
  }
  const scriptsDir = resolve(sourceDir, "scripts");
  if (!existsSync(scriptsDir) || !statSync(scriptsDir).isDirectory()) {
    throw new LostCityContentSourceError(
      "scripts_missing",
      `LostCity content source \`${sourceDirLabel}\` does not contain a scripts directory.`
    );
  }

  const files = runeScriptFiles(scriptsDir);
  const handlers = new Map<string, LostCityLootHandler>();
  const blocks = new Map<string, LostCityRuneScriptBlock>();
  for (const file of files) {
    for (const block of parseRuneScriptBlocks(file, sourceDir)) {
      const key = blockKey(block.kind, block.id);
      if (!blocks.has(key)) blocks.set(key, block);
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
  }

  return { sourceDirLabel, fileCount: files.length, handlers, blocks };
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
    catalog.blocks.get(blockKey("label", target)) ?? catalog.blocks.get(blockKey("proc", target));
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
  return catalog.blocks.get(blockKey(kind, id));
}
