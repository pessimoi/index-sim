const nodeStage = (id, modulePath, args = []) =>
  Object.freeze({
    id,
    kind: "node",
    modulePath,
    args: Object.freeze(args)
  });

const processStage = (id, executable, args) =>
  Object.freeze({
    id,
    kind: "process",
    executable,
    args: Object.freeze(args)
  });

const auditStage = Object.freeze({
  id: "dependency-audit",
  kind: "npm-audit"
});

const typecheckStage = nodeStage("typecheck", "node_modules/typescript/bin/tsc", ["-b"]);
const architectureStage = nodeStage("architecture", "node_modules/vite-node/vite-node.mjs", [
  "--config",
  "vitest.config.ts",
  "scripts/check-architecture.ts"
]);
const documentationStage = nodeStage("documentation", "node_modules/vite-node/vite-node.mjs", [
  "--config",
  "vitest.config.ts",
  "scripts/check-documentation.ts"
]);
const testStage = nodeStage("test", "node_modules/vitest/vitest.mjs", [
  "run",
  "--config",
  "vitest.config.ts",
  "--maxWorkers=4"
]);
const lintStage = nodeStage("lint", "node_modules/eslint/bin/eslint.js", ["."]);
const formatStage = nodeStage("format", "node_modules/prettier/bin/prettier.cjs", ["--check", "."]);
const diffStage = processStage("diff", "git", ["diff", "--check"]);
const buildStage = nodeStage("build", "node_modules/vite/bin/vite.js", [
  "build",
  "--config",
  "vite.config.ts"
]);
const artifactStage = nodeStage("artifact", "node_modules/vite-node/vite-node.mjs", [
  "--config",
  "vitest.config.ts",
  "scripts/verify-public-deployment.ts",
  "artifact"
]);

const qualityStages = Object.freeze([
  typecheckStage,
  architectureStage,
  documentationStage,
  testStage,
  lintStage,
  formatStage,
  diffStage
]);

const handoffStages = Object.freeze([...qualityStages, buildStage, artifactStage, auditStage]);
const deployabilityStages = Object.freeze([typecheckStage, buildStage, artifactStage]);

const wranglerStage = (id, args) => nodeStage(id, "node_modules/wrangler/bin/wrangler.js", args);

const plans = Object.freeze({
  quality: qualityStages,
  handoff: handoffStages,
  "dry-run": Object.freeze([
    ...deployabilityStages,
    wranglerStage("wrangler-dry-run", ["deploy", "--dry-run", "--outdir", ".wrangler/dry-run"])
  ]),
  preview: Object.freeze([
    ...deployabilityStages,
    wranglerStage("wrangler-preview", ["versions", "upload"])
  ]),
  deploy: Object.freeze([...deployabilityStages, wranglerStage("wrangler-deploy", ["deploy"])])
});

export const releaseCommands = Object.freeze(Object.keys(plans));

export function getReleasePlan(command) {
  const plan = plans[command];
  if (!plan) {
    throw new Error(`Unknown Cloudflare release command: ${String(command)}`);
  }
  return plan;
}

export function traceReleasePlan(command) {
  return getReleasePlan(command).map((stage) => stage.id);
}
