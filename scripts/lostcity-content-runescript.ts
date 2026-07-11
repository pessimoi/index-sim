import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { LostCityContentSourceError } from "./lostcity-content-config";

export const LOSTCITY_SOURCE_MAX_FILES = 20_000;
export const LOSTCITY_SOURCE_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const LOSTCITY_SOURCE_MAX_TOTAL_BYTES = 256 * 1024 * 1024;
export const LOSTCITY_RUNESCRIPT_MAX_BLOCKS = 250_000;

export interface LostCityRuneScriptBlock {
  kind: string;
  id: string;
  sourceRef: string;
  headerSuffix: string;
  lines: string[];
}

export interface LostCityRuneScriptCatalog {
  sourceDirLabel: string;
  fileCount: number;
  totalBytes: number;
  blocks: Map<string, LostCityRuneScriptBlock>;
  blocksByKey: Map<string, LostCityRuneScriptBlock[]>;
  allBlocks: LostCityRuneScriptBlock[];
}

export interface ReadLostCityRuneScriptCatalogOptions {
  repoRoot?: string;
  sourceDir: string;
}

export interface BoundedLostCitySourceTree {
  repoRoot: string;
  sourceRoot: string;
  sourceDirLabel: string;
  scriptsDir: string;
  files: string[];
  totalBytes: number;
}

function pathInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function repoRelativeLabel(repoRoot: string, target: string): string {
  return relative(repoRoot, target).replaceAll(sep, "/") || ".";
}

function safeRealPath(path: string, missingMessage: string): string {
  if (!existsSync(path)) {
    throw new LostCityContentSourceError("source_missing", missingMessage);
  }
  if (lstatSync(path).isSymbolicLink()) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity content source paths must not be symbolic links."
    );
  }
  return realpathSync(path);
}

export function assertBoundedLostCitySourceTree(input: {
  repoRoot?: string;
  sourceDir: string;
  extensions: ReadonlySet<string>;
}): BoundedLostCitySourceTree {
  const repoRoot = realpathSync(resolve(input.repoRoot ?? process.cwd()));
  const requestedSourceRoot = resolve(repoRoot, input.sourceDir);
  if (!pathInside(repoRoot, requestedSourceRoot)) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity content source directory must stay inside the repository."
    );
  }
  const sourceRoot = safeRealPath(
    requestedSourceRoot,
    `LostCity content source directory \`${repoRelativeLabel(repoRoot, requestedSourceRoot)}\` does not exist.`
  );
  if (!pathInside(repoRoot, sourceRoot)) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity content source directory must resolve inside the repository."
    );
  }
  if (!statSync(sourceRoot).isDirectory()) {
    throw new LostCityContentSourceError(
      "source_not_directory",
      `LostCity content source path \`${repoRelativeLabel(repoRoot, sourceRoot)}\` is not a directory.`
    );
  }
  const scriptsDir = resolve(sourceRoot, "scripts");
  if (!existsSync(scriptsDir) || !statSync(scriptsDir).isDirectory()) {
    throw new LostCityContentSourceError(
      "scripts_missing",
      `LostCity content source \`${repoRelativeLabel(repoRoot, sourceRoot)}\` does not contain a scripts directory.`
    );
  }
  if (lstatSync(scriptsDir).isSymbolicLink()) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity scripts directory must not be a symbolic link."
    );
  }

  const files: string[] = [];
  let totalBytes = 0;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new LostCityContentSourceError(
          "source_outside_repo",
          `LostCity source path \`${repoRelativeLabel(sourceRoot, target)}\` must not be a symbolic link.`
        );
      }
      if (entry.isDirectory()) {
        visit(target);
        continue;
      }
      if (!entry.isFile() || !input.extensions.has(extname(entry.name))) continue;
      const size = statSync(target).size;
      if (size > LOSTCITY_SOURCE_MAX_FILE_BYTES) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity source file \`${repoRelativeLabel(sourceRoot, target)}\` exceeds the bounded file size.`
        );
      }
      totalBytes += size;
      if (totalBytes > LOSTCITY_SOURCE_MAX_TOTAL_BYTES) {
        throw new LostCityContentSourceError(
          "config_invalid",
          "LostCity source files exceed the bounded total size."
        );
      }
      files.push(target);
      if (files.length > LOSTCITY_SOURCE_MAX_FILES) {
        throw new LostCityContentSourceError(
          "config_invalid",
          "LostCity source contains too many audit input files."
        );
      }
    }
  };
  visit(scriptsDir);
  files.sort();
  return {
    repoRoot,
    sourceRoot,
    sourceDirLabel: repoRelativeLabel(repoRoot, sourceRoot),
    scriptsDir,
    files,
    totalBytes
  };
}

export function lostCityRuneScriptBlockKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function parseRuneScriptBlocks(file: string, sourceRoot: string): LostCityRuneScriptBlock[] {
  const fileLabel = repoRelativeLabel(sourceRoot, file);
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

export function readLostCityRuneScriptCatalog(
  options: ReadLostCityRuneScriptCatalogOptions
): LostCityRuneScriptCatalog {
  const tree = assertBoundedLostCitySourceTree({
    ...options,
    extensions: new Set([".rs2"])
  });
  const blocks = new Map<string, LostCityRuneScriptBlock>();
  const blocksByKey = new Map<string, LostCityRuneScriptBlock[]>();
  const allBlocks: LostCityRuneScriptBlock[] = [];
  for (const file of tree.files) {
    for (const block of parseRuneScriptBlocks(file, tree.sourceRoot)) {
      allBlocks.push(block);
      if (allBlocks.length > LOSTCITY_RUNESCRIPT_MAX_BLOCKS) {
        throw new LostCityContentSourceError(
          "config_invalid",
          "LostCity RuneScript source contains too many parsed blocks."
        );
      }
      const key = lostCityRuneScriptBlockKey(block.kind, block.id);
      const entries = [...(blocksByKey.get(key) ?? []), block];
      blocksByKey.set(key, entries);
      if (!blocks.has(key)) blocks.set(key, block);
    }
  }
  return {
    sourceDirLabel: tree.sourceDirLabel,
    fileCount: tree.files.length,
    totalBytes: tree.totalBytes,
    blocks,
    blocksByKey,
    allBlocks
  };
}
