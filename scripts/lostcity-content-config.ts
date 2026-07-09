import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export type LostCityConfigExtension = ".npc" | ".obj" | ".dbrow" | ".param";

export interface LostCityConfigEntry {
  id: string;
  sourceRef: string;
  properties: Record<string, string[]>;
}

export interface LostCityConfigCatalog {
  extension: LostCityConfigExtension;
  sourceDirLabel: string;
  fileCount: number;
  entries: Map<string, LostCityConfigEntry>;
}

export type LostCityContentSourceErrorCode =
  | "source_missing"
  | "source_not_directory"
  | "source_outside_repo"
  | "scripts_missing"
  | "config_invalid"
  | "duplicate_config"
  | "duplicate_script_trigger";

export class LostCityContentSourceError extends Error {
  readonly code: LostCityContentSourceErrorCode;

  constructor(code: LostCityContentSourceErrorCode, message: string) {
    super(message);
    this.name = "LostCityContentSourceError";
    this.code = code;
  }
}

export interface ReadLostCityConfigCatalogOptions {
  repoRoot?: string;
  sourceDir: string;
  extension: LostCityConfigExtension;
}

function pathInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function repoRelativeLabel(repoRoot: string, target: string): string {
  return relative(repoRoot, target).replaceAll(sep, "/") || ".";
}

function configFiles(root: string, extension: LostCityConfigExtension): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(target);
      } else if (entry.isFile() && target.endsWith(extension)) {
        files.push(target);
      }
    }
  };
  visit(root);
  return files.sort();
}

function configError(sourceRef: string, lineNumber: number, message: string): never {
  throw new LostCityContentSourceError(
    "config_invalid",
    `LostCity config ${sourceRef}:${lineNumber} is invalid: ${message}`
  );
}

function parseConfigFile(
  file: string,
  sourceDir: string,
  entries: Map<string, LostCityConfigEntry>
): void {
  const fileLabel = relative(sourceDir, file).replaceAll(sep, "/");
  let current: LostCityConfigEntry | null = null;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (line.length === 0 || line.startsWith("//")) continue;

    if (line.startsWith("[")) {
      if (!line.endsWith("]")) configError(fileLabel, lineNumber, "missing closing bracket");
      const id = line.slice(1, -1);
      if (!id) configError(fileLabel, lineNumber, "empty config id");
      const sourceRef = `${fileLabel}#${id}`;
      const previous = entries.get(id);
      if (previous) {
        throw new LostCityContentSourceError(
          "duplicate_config",
          `LostCity config id \`${id}\` is duplicated in \`${previous.sourceRef}\` and \`${sourceRef}\`.`
        );
      }
      current = { id, sourceRef, properties: {} };
      entries.set(id, current);
      continue;
    }

    if (!current) configError(fileLabel, lineNumber, "property appears before a config header");
    const separator = line.indexOf("=");
    if (separator <= 0) configError(fileLabel, lineNumber, "missing property separator");
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    current.properties[key] = [...(current.properties[key] ?? []), value];
  }
}

export function readLostCityConfigCatalog(
  options: ReadLostCityConfigCatalogOptions
): LostCityConfigCatalog {
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

  const files = configFiles(scriptsDir, options.extension);
  const entries = new Map<string, LostCityConfigEntry>();
  for (const file of files) parseConfigFile(file, sourceDir, entries);

  return {
    extension: options.extension,
    sourceDirLabel,
    fileCount: files.length,
    entries
  };
}

export function lastConfigValue(
  entry: LostCityConfigEntry | undefined,
  key: string
): string | undefined {
  const values = entry?.properties[key];
  return values?.[values.length - 1];
}

export function configParamValue(
  entry: LostCityConfigEntry | undefined,
  paramName: string
): string | undefined {
  const prefix = `${paramName},`;
  const rows = entry?.properties.param ?? [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].startsWith(prefix)) return rows[index].slice(prefix.length);
  }
  return undefined;
}

export function resolvedConfigParamValue(
  entry: LostCityConfigEntry | undefined,
  params: LostCityConfigCatalog,
  paramName: string
): string | undefined {
  const explicit = configParamValue(entry, paramName);
  if (explicit !== undefined) return explicit === "null" ? undefined : explicit;
  const fallback = lastConfigValue(params.entries.get(paramName), "default");
  return fallback === "null" ? undefined : fallback;
}
