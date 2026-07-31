import { spawnSync } from "node:child_process";
import { getReleasePlan, releaseCommands } from "./cloudflare-release-plan.mjs";

const command = process.argv[2];
if (!releaseCommands.includes(command)) {
  console.error(
    "Usage: node scripts/run-cloudflare-release.mjs quality|handoff|dry-run|preview|deploy"
  );
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

function runAudit() {
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
}

for (const stage of getReleasePlan(command)) {
  console.log(`[release:${command}] ${stage.id}`);
  if (stage.kind === "node") {
    runNode(stage.modulePath, ...stage.args);
  } else if (stage.kind === "process") {
    run(stage.executable, [...stage.args]);
  } else {
    runAudit();
  }
}
