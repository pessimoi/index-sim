import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import ts from "typescript";

const projectRoot = resolve(process.cwd());
const sourceRoot = resolve(projectRoot, "src");

const forbiddenLayerDependencies: Readonly<Record<string, ReadonlySet<string>>> = {
  app: new Set(["server"]),
  adapters: new Set(["app", "server"]),
  data: new Set(["app", "adapters", "server"]),
  domain: new Set(["app", "adapters", "data", "server"]),
  server: new Set(["app", "adapters"])
};

const documentedBoundaryExceptions = new Set<string>();

const forbiddenClientPrefixes = ["src/adapters/legacy-runtime/", "src/adapters/static-runtime/"];

// These modules are invoked outside the src-to-src import graph by HTML, Vite,
// Wrangler, Worker URL construction or repository scripts/tests. Every other
// non-test source module must have at least one source importer.
const documentedExternalEntrypoints = new Set([
  "src/adapters/legacy-runtime/index.ts",
  "src/adapters/static-runtime/index.ts",
  "src/app/calculation-worker.ts",
  "src/app/main.tsx",
  "src/app/startup-guard.ts",
  "src/server/cloudflare-worker.ts",
  "src/server/vite-hiscores-middleware.ts",
  "src/server/vite-market-middleware.ts"
]);

function sourceLabel(fileName: string): string {
  return relative(projectRoot, fileName).split(sep).join("/");
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fileName = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests") files.push(...collectSourceFiles(fileName));
      continue;
    }
    if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(fileName);
  }
  return files.sort();
}

function sourceLayer(fileName: string): string | null {
  const [root, layer] = sourceLabel(fileName).split("/");
  return root === "src" ? (layer ?? null) : null;
}

const sourceFiles = collectSourceFiles(sourceRoot);
const sourceFileSet = new Set(sourceFiles);
const compilerOptions: ts.CompilerOptions = {
  baseUrl: projectRoot,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { "@/*": ["src/*"] },
  resolveJsonModule: true
};

const graph = new Map<string, string[]>(sourceFiles.map((fileName) => [fileName, []]));
const sourceImporters = new Map<string, Set<string>>(
  sourceFiles.map((fileName) => [fileName, new Set<string>()])
);

for (const fileName of sourceFiles) {
  const sourceText = readFileSync(fileName, "utf8");
  const imports = ts.preProcessFile(sourceText, true, true).importedFiles;
  const resolvedImports = new Set<string>();
  for (const imported of imports) {
    const resolvedModule = ts.resolveModuleName(
      imported.fileName,
      fileName,
      compilerOptions,
      ts.sys
    ).resolvedModule;
    if (!resolvedModule) continue;
    const importedFileName = resolve(resolvedModule.resolvedFileName);
    if (sourceFileSet.has(importedFileName)) {
      resolvedImports.add(importedFileName);
      sourceImporters.get(importedFileName)?.add(fileName);
    }
  }
  graph.set(fileName, [...resolvedImports].sort());
}

const violations: string[] = [];
const acceptedExceptions = new Set<string>();

for (const [source, imports] of graph) {
  const sourceLayerName = sourceLayer(source);
  const forbiddenTargets = sourceLayerName
    ? forbiddenLayerDependencies[sourceLayerName]
    : undefined;
  if (!forbiddenTargets) continue;
  for (const imported of imports) {
    const importedLayerName = sourceLayer(imported);
    if (!importedLayerName || !forbiddenTargets.has(importedLayerName)) continue;
    const edge = `${sourceLabel(source)} -> ${sourceLabel(imported)}`;
    if (documentedBoundaryExceptions.has(edge)) {
      acceptedExceptions.add(edge);
    } else {
      violations.push(`forbidden layer dependency: ${edge}`);
    }
  }
}

type VisitState = "visiting" | "visited";
const visitState = new Map<string, VisitState>();
const visitStack: string[] = [];
const cycleKeys = new Set<string>();

function visit(fileName: string): void {
  visitState.set(fileName, "visiting");
  visitStack.push(fileName);
  for (const imported of graph.get(fileName) ?? []) {
    const state = visitState.get(imported);
    if (state === undefined) {
      visit(imported);
      continue;
    }
    if (state === "visiting") {
      const cycleStart = visitStack.indexOf(imported);
      const cycle = [...visitStack.slice(cycleStart), imported].map(sourceLabel);
      cycleKeys.add(cycle.join(" -> "));
    }
  }
  visitStack.pop();
  visitState.set(fileName, "visited");
}

for (const fileName of sourceFiles) {
  if (visitState.get(fileName) === undefined) visit(fileName);
}
for (const cycle of [...cycleKeys].sort()) violations.push(`source import cycle: ${cycle}`);

const observedExternalEntrypoints = new Set<string>();
for (const fileName of sourceFiles) {
  if ((sourceImporters.get(fileName)?.size ?? 0) > 0) continue;
  const label = sourceLabel(fileName);
  if (documentedExternalEntrypoints.has(label)) {
    observedExternalEntrypoints.add(label);
  } else {
    violations.push(
      `source module has no source importer or documented external entrypoint: ${label}`
    );
  }
}

for (const entrypoint of documentedExternalEntrypoints) {
  if (!observedExternalEntrypoints.has(entrypoint)) {
    violations.push(`stale or missing documented external entrypoint: ${entrypoint}`);
  }
}

const clientEntry = resolve(sourceRoot, "app/main.tsx");
const clientReachable = new Set<string>();

function collectReachable(fileName: string): void {
  if (clientReachable.has(fileName)) return;
  clientReachable.add(fileName);
  for (const imported of graph.get(fileName) ?? []) collectReachable(imported);
}

collectReachable(clientEntry);
for (const fileName of [...clientReachable].sort()) {
  const label = sourceLabel(fileName);
  if (forbiddenClientPrefixes.some((prefix) => label.startsWith(prefix))) {
    violations.push(`archived runtime is reachable from the client entrypoint: ${label}`);
  }
}

const staleExceptions = [...documentedBoundaryExceptions].filter(
  (exception) => !acceptedExceptions.has(exception)
);
for (const exception of staleExceptions) {
  violations.push(`stale architecture exception must be removed: ${exception}`);
}

if (violations.length > 0) {
  console.error("Architecture check failed:");
  for (const violation of violations.sort()) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    `Architecture check passed: ${sourceFiles.length} source modules, no cycles, ` +
      `${clientReachable.size} client-reachable modules, ${observedExternalEntrypoints.size} documented external entrypoints ` +
      `and ${acceptedExceptions.size} documented legacy-migration exceptions.`
  );
}
