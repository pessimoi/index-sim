import { spawnSync } from "node:child_process";

const command = process.argv[2];
if (!new Set(["gate", "dry-run", "preview", "deploy"]).has(command)) {
  console.error("Usage: node scripts/run-cloudflare-release.mjs gate|dry-run|preview|deploy");
  process.exit(2);
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE: process.execPath,
      npm_config_cache: ".npm-cache",
      XDG_CACHE_HOME: ".wrangler/cache",
      XDG_CONFIG_HOME: ".wrangler/config",
      WRANGLER_LOG_PATH: ".wrangler/logs",
      WRANGLER_SEND_METRICS: "false"
    }
  });
  if (result.error) {
    console.error("Repository verification command could not start");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNode(modulePath, ...args) {
  run(process.execPath, [modulePath, ...args]);
}

function buildAndVerify() {
  runNode("node_modules/typescript/bin/tsc", "-b");
  runNode("node_modules/vite/bin/vite.js", "build", "--config", "vite.config.ts");
  runNode(
    "node_modules/vite-node/vite-node.mjs",
    "--config",
    "vitest.config.ts",
    "scripts/verify-public-deployment.ts",
    "artifact"
  );
}

if (command === "gate") {
  runNode("node_modules/typescript/bin/tsc", "-b");
  runNode(
    "node_modules/vite-node/vite-node.mjs",
    "--config",
    "vitest.config.ts",
    "scripts/check-architecture.ts"
  );
  runNode("node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.ts");
  runNode(
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.config.ts",
    "src/tests/legacy-golden.test.ts"
  );
  buildAndVerify();
  runNode("node_modules/eslint/bin/eslint.js", ".");
  runNode("node_modules/prettier/bin/prettier.cjs", "--check", ".");

  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    console.error("Repository verification requires npm_execpath");
    process.exit(1);
  }
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1") {
    console.log("Skipping npm audit in the network-disabled local sandbox");
  } else {
    runNode(npmCli, "audit");
  }
  run("git", ["diff", "--check"]);
  process.exit(0);
}

buildAndVerify();
const wranglerArgs =
  command === "preview"
    ? ["versions", "upload"]
    : command === "dry-run"
      ? ["deploy", "--dry-run", "--outdir", ".wrangler/dry-run"]
      : ["deploy"];
runNode("node_modules/wrangler/bin/wrangler.js", ...wranglerArgs);
