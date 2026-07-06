import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { format, resolveConfig } from "prettier";
import { LEGACY_GOLDEN_CASES } from "../src/tests/fixtures/legacy-case-definitions";
import {
  LEGACY_SCRIPT_FILES,
  runLegacyCase,
  summarizeLegacyResult
} from "../src/tests/helpers/legacy-sim";

const outputPath = join(process.cwd(), "src/tests/fixtures/legacy-golden.json");

const fixtureSet = {
  schemaVersion: 1,
  capturedAt: "2026-07-05",
  source: {
    scripts: LEGACY_SCRIPT_FILES,
    entrypoint: "SimEngine.simulate() via Node vm context",
    excludedScripts: ["market.js", "planner-core.js", "views.jsx", "planner.jsx"],
    priceSource:
      "gamedata.js embedded ITEM_PRICES and ALCH_VALUES; no market sync or localStorage state"
  },
  tolerances: {
    defaultNumericAbs: 0.000001,
    note: "Summaries are rounded to 6 decimals before comparison; tolerance exists for floating point drift."
  },
  cases: LEGACY_GOLDEN_CASES.map((definition) => ({
    id: definition.id,
    description: definition.description,
    notes: definition.notes ?? [],
    input: {
      combatType: definition.combatType,
      monsterId: definition.monsterId,
      weapon: definition.weapon ?? null,
      ammo: definition.ammo ?? null,
      spell: definition.spell ?? null,
      style: definition.style ?? null,
      levels: definition.levels ?? {},
      prayers: definition.prayers ?? ["none"],
      boosts: definition.boosts ?? ["none"],
      sustained: definition.sustained ?? false,
      repotThreshold: definition.repotThreshold ?? null,
      trip: definition.trip ?? {},
      ringOfWealth: definition.ringOfWealth ?? false,
      specWeapon: definition.specWeapon ?? "none",
      cannon: definition.cannon ?? null,
      lootPrefs: definition.lootPrefs ?? null
    },
    expected: summarizeLegacyResult(runLegacyCase(definition))
  }))
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  await format(JSON.stringify(fixtureSet), {
    ...((await resolveConfig(outputPath)) ?? {}),
    filepath: outputPath
  })
);
console.log(`Captured ${fixtureSet.cases.length} legacy golden fixtures at ${outputPath}`);
