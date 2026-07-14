import { parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import {
  CannonByMonsterSchema,
  CombatSetupFormSchema,
  CustomSetupsByMonsterSchema,
  DEFAULT_CANNON_SETTINGS,
  normalizeFormState,
  type CannonByMonsterState,
  type CustomSetupsByMonsterState
} from "../ui-state";
import { MAX_DUEL_SNAPSHOTS, createDuelSnapshot, type DuelSnapshotsState } from "../duel-snapshots";
import {
  DEFAULT_MAX_LEGACY_INPUT_BYTES,
  LEGACY_INPUT_STORAGE_KEY,
  type LegacySetupMigrationOptions,
  type LegacySetupMigrationReport
} from "./contracts";
import { cloneDefaultFormState, mapLegacyInput } from "./setup-mapper";
import {
  byteLength,
  copyNestedReportFindings,
  createReport,
  importField,
  isRecord,
  isSafeLegacyMapKey,
  skip,
  warn,
  type LegacyRecord
} from "./report";

const MAX_LEGACY_NESTED_REVIEW_KEYS = 500;

export function inspectLegacySetupInput(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const rawInput = options.storage.getItem(LEGACY_INPUT_STORAGE_KEY);
  if (rawInput == null) return;
  if (byteLength(rawInput) > (options.maxInputBytes ?? DEFAULT_MAX_LEGACY_INPUT_BYTES)) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "legacy input exceeds safe size limit");
    warn(report, "Legacy setup input was ignored because it exceeds the safe size limit.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = parseJsonWithDuplicateKeyCheck(rawInput, { source: "Legacy setup state" });
  } catch {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "invalid JSON");
    warn(report, "Legacy setup input could not be parsed as JSON.");
    return;
  }

  if (!isRecord(parsed)) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "expected an object");
    warn(report, "Legacy setup input was ignored because it is not an object.");
    return;
  }

  inspectLegacyNestedSetupAreas(parsed, options, report);
  const importedFieldCountBeforeActiveSetup = report.importedFields.length;

  const draft = cloneDefaultFormState();
  mapLegacyInput(parsed, draft, options.gameData, report);

  if (report.importedFields.length === importedFieldCountBeforeActiveSetup) {
    warn(report, "Legacy active setup input did not contain any safely importable fields.");
    return;
  }

  const validated = CombatSetupFormSchema.safeParse(draft);
  if (!validated.success) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "mapped setup failed rewrite form validation");
    warn(report, "Mapped legacy setup failed final rewrite form validation.");
    report.setup = null;
    return;
  }

  report.setup = normalizeFormState(validated.data);
}

function inspectLegacyNestedSetupAreas(
  legacy: LegacyRecord,
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  inspectLegacyCustomSetups(legacy.monsterSetups, options, report);
  inspectLegacyCannonByMonster(legacy.cannonByMonster, options, report);
  inspectLegacyDuelSetups(legacy, options, report);
}

function inspectLegacyDuelSetups(
  legacy: LegacyRecord,
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const field = "sim_input_v3.duelSetups";
  const value = legacy.duelSetups;
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    skip(report, field, "legacy Duel snapshots were skipped because the shape is not an array");
    warn(report, "Legacy Duel snapshots were detected but their shape is not importable.");
    return;
  }
  if (value.length === 0) return;
  if (value.length > MAX_LEGACY_NESTED_REVIEW_KEYS) {
    skip(report, field, "legacy Duel snapshot list exceeds safe entry limit");
    warn(report, "Legacy Duel snapshots were detected but exceed the safe entry limit.");
    return;
  }

  const current = options.currentDuelSnapshots?.snapshots ?? [];
  const existingIds = new Set(current.map((snapshot) => snapshot.id));
  const availableSlots = Math.max(0, MAX_DUEL_SNAPSHOTS - current.length);
  const snapshots: DuelSnapshotsState["snapshots"] = [];

  const baseDraft = cloneDefaultFormState();
  mapLegacyInput(legacy, baseDraft, options.gameData, createReport([]));

  for (const [index, entry] of value.entries()) {
    const entryField = `${field}.${index}`;
    if (snapshots.length >= availableSlots) {
      skip(report, entryField, "rewrite Duel snapshot limit has no remaining room");
      continue;
    }
    if (!isRecord(entry) || !isRecord(entry.setup)) {
      skip(report, entryField, "expected an object with a setup snapshot");
      continue;
    }
    if (typeof entry.name !== "string" || !entry.name.trim()) {
      skip(report, `${entryField}.name`, "expected a non-empty snapshot name");
      continue;
    }
    if ("result" in entry || "simulationResult" in entry) {
      skip(report, entryField, "computed result payloads are not imported");
      continue;
    }

    const id = `legacy-duel-${index + 1}`;
    if (existingIds.has(id)) {
      skip(report, entryField, "rewrite Duel snapshot already exists; kept rewrite-owned snapshot");
      continue;
    }

    const childReport = createReport([]);
    const draft = CombatSetupFormSchema.parse(baseDraft);
    mapLegacyInput(entry.setup, draft, options.gameData, childReport, { mapMonster: false });
    copyNestedReportFindings(childReport, entryField, report);
    if (childReport.importedFields.length === 0) {
      skip(report, entryField, "no safely importable Duel setup fields");
      continue;
    }

    try {
      snapshots.push(createDuelSnapshot(id, entry.name, normalizeFormState(draft)));
      existingIds.add(id);
      importField(report, `duelSnapshots.${id}`);
    } catch {
      skip(report, entryField, "mapped Duel snapshot failed rewrite validation");
    }
  }

  if (snapshots.length === 0) {
    warn(report, "Legacy Duel snapshots did not contain any safely importable entries.");
    return;
  }

  report.duelSnapshots = { snapshots };
  importField(report, "duelSnapshots");
}

function inspectLegacyCustomSetups(
  value: unknown,
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const field = "sim_input_v3.monsterSetups";
  if (value === undefined) return;
  if (!isRecord(value)) {
    skip(
      report,
      field,
      "legacy custom setup snapshots were skipped because the shape is not an object map"
    );
    warn(report, "Legacy custom setup snapshots were detected but their shape is not importable.");
    return;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return;
  if (entries.length > MAX_LEGACY_NESTED_REVIEW_KEYS) {
    skip(report, field, "legacy custom setup snapshot map exceeds safe key limit");
    warn(report, "Legacy custom setup snapshots were detected but exceed the safe key limit.");
    return;
  }

  const knownMonsterIds = new Set(Object.keys(options.gameData.monsters));
  const existing = options.currentCustomSetupsByMonster ?? {};
  const imported: CustomSetupsByMonsterState = {};

  for (const [monsterId, setupValue] of entries) {
    const entryField = `${field}.${monsterId}`;
    if (!isSafeLegacyMapKey(monsterId)) {
      skip(report, entryField, "unsafe legacy map key");
      continue;
    }
    if (!knownMonsterIds.has(monsterId)) {
      skip(report, entryField, "unknown monster id");
      continue;
    }
    if (existing[monsterId]) {
      skip(report, entryField, "rewrite custom setup already exists; kept rewrite-owned setup");
      continue;
    }
    if (!isRecord(setupValue)) {
      skip(report, entryField, "expected an object setup snapshot");
      continue;
    }

    const childReport = createReport([]);
    const draft = cloneDefaultFormState();
    draft.monsterId = monsterId;
    mapLegacyInput(setupValue, draft, options.gameData, childReport, { mapMonster: false });
    copyNestedReportFindings(childReport, entryField, report);

    if (childReport.importedFields.length === 0) {
      skip(report, entryField, "no safely importable custom setup fields");
      continue;
    }

    const validated = CombatSetupFormSchema.safeParse({ ...draft, monsterId });
    if (!validated.success) {
      skip(report, entryField, "mapped custom setup failed rewrite form validation");
      continue;
    }

    imported[monsterId] = normalizeFormState({ ...validated.data, monsterId });
    importField(report, `customSetupsByMonster.${monsterId}`);
  }

  if (Object.keys(imported).length === 0) {
    warn(report, "Legacy custom setup snapshots did not contain any safely importable entries.");
    return;
  }

  const validated = CustomSetupsByMonsterSchema.safeParse(imported);
  if (!validated.success) {
    skip(report, field, "legacy custom setup snapshots failed rewrite validation");
    warn(
      report,
      "Legacy custom setup snapshots were ignored because they failed rewrite validation."
    );
    return;
  }

  report.customSetupsByMonster = validated.data;
  importField(report, "customSetupsByMonster");
}

function inspectLegacyCannonByMonster(
  value: unknown,
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const field = "sim_input_v3.cannonByMonster";
  if (value === undefined) return;
  if (!isRecord(value)) {
    skip(report, field, "legacy cannon map was skipped because the shape is not an object map");
    warn(report, "Legacy cannon map was detected but its shape is not importable.");
    return;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return;
  if (entries.length > MAX_LEGACY_NESTED_REVIEW_KEYS) {
    skip(report, field, "legacy cannon map exceeds safe key limit");
    warn(report, "Legacy cannon map was detected but exceeds the safe key limit.");
    return;
  }

  const knownMonsterIds = new Set(Object.keys(options.gameData.monsters));
  const existing = options.currentCannonByMonster ?? {};
  const imported: CannonByMonsterState = {};

  for (const [monsterId, settingsValue] of entries) {
    const entryField = `${field}.${monsterId}`;
    if (!isSafeLegacyMapKey(monsterId)) {
      skip(report, entryField, "unsafe legacy map key");
      continue;
    }
    if (!knownMonsterIds.has(monsterId)) {
      skip(report, entryField, "unknown monster id");
      continue;
    }
    if (existing[monsterId]) {
      skip(
        report,
        entryField,
        "rewrite cannon settings already exist; kept rewrite-owned settings"
      );
      continue;
    }

    const settings = parseLegacyCannonSettings(settingsValue, entryField, report);
    if (!settings) continue;
    imported[monsterId] = settings;
    importField(report, `cannonByMonster.${monsterId}`);
  }

  if (Object.keys(imported).length === 0) {
    warn(report, "Legacy cannon map did not contain any safely importable entries.");
    return;
  }

  const validated = CannonByMonsterSchema.safeParse(imported);
  if (!validated.success) {
    skip(report, field, "legacy cannon map failed rewrite validation");
    warn(report, "Legacy cannon map was ignored because it failed rewrite validation.");
    return;
  }

  report.cannonByMonster = validated.data;
  importField(report, "cannonByMonster");
}

function parseLegacyCannonSettings(
  value: unknown,
  field: string,
  report: LegacySetupMigrationReport
): CannonByMonsterState[string] | null {
  if (!isRecord(value)) {
    skip(report, field, "expected an object cannon settings entry");
    return null;
  }

  const enabled = value.enabled;
  const targets = value.targets;
  const respawnSec = value.respawnSec;
  const next: CannonByMonsterState[string] = { ...DEFAULT_CANNON_SETTINGS };

  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      skip(report, `${field}.enabled`, "expected a boolean");
      return null;
    }
    next.enabled = enabled;
  }

  if (targets !== undefined) {
    if (
      typeof targets !== "number" ||
      !Number.isFinite(targets) ||
      !Number.isInteger(targets) ||
      targets < 1 ||
      targets > 8
    ) {
      skip(report, `${field}.targets`, "expected an integer from 1 to 8");
      return null;
    }
    next.targets = targets;
  }

  if (respawnSec !== undefined) {
    if (respawnSec === null) {
      next.respawnSec = null;
    } else if (
      typeof respawnSec === "number" &&
      Number.isFinite(respawnSec) &&
      Number.isInteger(respawnSec) &&
      respawnSec >= 1 &&
      respawnSec <= 3600
    ) {
      next.respawnSec = respawnSec;
    } else {
      skip(report, `${field}.respawnSec`, "expected null or an integer from 1 to 3600");
      return null;
    }
  }

  return next;
}
