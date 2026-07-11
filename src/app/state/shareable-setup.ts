import { z } from "zod";
import type { GameDataSnapshot } from "@/domain/shared";
import { lootPreferenceKeysForMonster, type CannonSettings } from "@/domain/trip";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import {
  CannonByMonsterSchema,
  CombatSetupFormSchema,
  DEFAULT_CANNON_SETTINGS,
  normalizeFormState,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "./ui-state";
import { LootActionSchema, LootPrefsStateSchema, type LootPrefsState } from "./loot-prefs";
import {
  DEFAULT_MONSTER_LOOT_SETTINGS,
  LootSettingsByMonsterSchema,
  type LootSettingsByMonsterState,
  type MonsterLootSettings
} from "./loot-settings";
import { combatSetupCompatibilityIssues } from "./setup-compatibility";

export const SHAREABLE_SETUP_KIND = "index-sim-setup";
export const SHAREABLE_SETUP_VERSION = 1;
export const SHAREABLE_SETUP_MAX_ENCODED_CHARS = 12_000;
export const SHAREABLE_SETUP_MAX_JSON_BYTES = 8_192;

export type ShareableSetupErrorCode =
  | "body_too_large"
  | "duplicate_keys"
  | "invalid_encoding"
  | "invalid_json"
  | "invalid_schema"
  | "unsupported_version"
  | "incompatible_entities";

export class ShareableSetupError extends Error {
  constructor(
    readonly code: ShareableSetupErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ShareableSetupError";
  }
}

const ShareableCannonSettingsSchema = z
  .object({
    enabled: z.boolean(),
    targets: z.number().int().min(1).max(8),
    respawnSec: z.number().int().min(1).max(3600).nullable()
  })
  .strict();

export type ShareableCannonSettings = z.infer<typeof ShareableCannonSettingsSchema>;

const ShareableMonsterLootSettingsSchema = z
  .object({
    highAlch: z.boolean().optional(),
    overheadSec: z.number().min(0).max(600).nullable(),
    talismanSpot: z.enum(["underground", "overground"])
  })
  .strict();

const ShareableLootPreferencesSchema = z
  .record(z.string().min(1).max(180), LootActionSchema)
  .superRefine((preferences, context) => {
    if (Object.keys(preferences).length > 200) {
      context.addIssue({
        code: "custom",
        message: "Too many loot preferences"
      });
    }
  });

const RawShareableSetupEnvelopeSchema = z
  .object({
    kind: z.literal(SHAREABLE_SETUP_KIND),
    version: z.literal(SHAREABLE_SETUP_VERSION),
    gameDataId: z.string().min(1).max(160),
    data: z
      .object({
        form: z.unknown(),
        cannon: ShareableCannonSettingsSchema,
        lootPreferences: ShareableLootPreferencesSchema,
        lootSettings: ShareableMonsterLootSettingsSchema
      })
      .strict()
  })
  .strict();

export interface ShareableSetupEnvelopeV1 {
  kind: typeof SHAREABLE_SETUP_KIND;
  version: typeof SHAREABLE_SETUP_VERSION;
  gameDataId: string;
  data: {
    form: CombatSetupFormState;
    cannon: ShareableCannonSettings;
    lootPreferences: Record<string, z.infer<typeof LootActionSchema>>;
    lootSettings: MonsterLootSettings;
  };
}

export interface ShareableSetupReview {
  envelope: ShareableSetupEnvelopeV1;
  gameDataMismatch: boolean;
  droppedLootRowCount: number;
}

export interface ShareableSetupOwnedState {
  form: CombatSetupFormState;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

export interface ShareableSetupApplyResult {
  state: ShareableSetupOwnedState;
  undo: ShareableSetupOwnedState;
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeJson(entry)])
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

function strictFormFromUnknown(value: unknown): CombatSetupFormState {
  let normalized: CombatSetupFormState;
  try {
    normalized = normalizeFormState(CombatSetupFormSchema.parse(value));
  } catch {
    throw new ShareableSetupError("invalid_schema", "Shared setup form is invalid");
  }
  if (canonicalJson(value) !== canonicalJson(normalized)) {
    throw new ShareableSetupError(
      "invalid_schema",
      "Shared setup form would require implicit normalization"
    );
  }
  return normalized;
}

function envelopeFromUnknown(value: unknown): ShareableSetupEnvelopeV1 {
  if (!value || typeof value !== "object") {
    throw new ShareableSetupError("invalid_schema", "Shared setup envelope is invalid");
  }
  const record = value as Record<string, unknown>;
  if (record.kind !== SHAREABLE_SETUP_KIND || record.version !== SHAREABLE_SETUP_VERSION) {
    throw new ShareableSetupError(
      "unsupported_version",
      "Shared setup kind or version is unsupported"
    );
  }

  let parsed: z.infer<typeof RawShareableSetupEnvelopeSchema>;
  try {
    parsed = RawShareableSetupEnvelopeSchema.parse(value);
  } catch {
    throw new ShareableSetupError("invalid_schema", "Shared setup envelope is invalid");
  }

  return {
    ...parsed,
    data: {
      ...parsed.data,
      form: strictFormFromUnknown(parsed.data.form)
    }
  };
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!value || value.length > SHAREABLE_SETUP_MAX_ENCODED_CHARS) {
    throw new ShareableSetupError("body_too_large", "Shared setup payload is too large");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ShareableSetupError("invalid_encoding", "Shared setup encoding is invalid");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new ShareableSetupError("invalid_encoding", "Shared setup encoding is invalid");
  }
  if (binary.length > SHAREABLE_SETUP_MAX_JSON_BYTES) {
    throw new ShareableSetupError("body_too_large", "Shared setup payload is too large");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function buildShareableSetupEnvelope(input: {
  gameDataId: string;
  form: CombatSetupFormState;
  cannon: CannonSettings;
  lootPreferences: Record<string, z.infer<typeof LootActionSchema>>;
  lootSettings: MonsterLootSettings;
}): ShareableSetupEnvelopeV1 {
  const candidate = {
    kind: SHAREABLE_SETUP_KIND,
    version: SHAREABLE_SETUP_VERSION,
    gameDataId: input.gameDataId,
    data: {
      form: normalizeFormState(input.form),
      cannon: { ...input.cannon },
      lootPreferences: { ...input.lootPreferences },
      lootSettings: { ...input.lootSettings }
    }
  };
  return envelopeFromUnknown(candidate);
}

export function encodeShareableSetupEnvelope(envelope: ShareableSetupEnvelopeV1): string {
  const validated = envelopeFromUnknown(envelope);
  const bytes = new TextEncoder().encode(canonicalJson(validated));
  if (bytes.byteLength > SHAREABLE_SETUP_MAX_JSON_BYTES) {
    throw new ShareableSetupError("body_too_large", "Shared setup payload is too large");
  }
  const encoded = encodeBase64Url(bytes);
  if (encoded.length > SHAREABLE_SETUP_MAX_ENCODED_CHARS) {
    throw new ShareableSetupError("body_too_large", "Shared setup payload is too large");
  }
  return encoded;
}

export function decodeShareableSetupEnvelope(payload: string): ShareableSetupEnvelopeV1 {
  const bytes = decodeBase64Url(payload);
  let jsonText: string;
  try {
    jsonText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ShareableSetupError("invalid_encoding", "Shared setup text encoding is invalid");
  }

  let value: unknown;
  try {
    value = parseJsonWithDuplicateKeyCheck(jsonText, {
      maxBytes: SHAREABLE_SETUP_MAX_JSON_BYTES,
      source: "Shared setup"
    });
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      throw new ShareableSetupError("duplicate_keys", "Shared setup contains duplicate keys");
    }
    throw new ShareableSetupError("invalid_json", "Shared setup JSON is invalid");
  }
  return envelopeFromUnknown(value);
}

export function reviewShareableSetup(
  envelope: ShareableSetupEnvelopeV1,
  gameData: GameDataSnapshot
): ShareableSetupReview {
  const form = envelope.data.form;
  const issues = combatSetupCompatibilityIssues(form, gameData, "form");
  if (issues.length > 0) {
    throw new ShareableSetupError(
      "incompatible_entities",
      `Shared setup contains unavailable entities: ${issues.slice(0, 5).join(", ")}`
    );
  }

  const monster = gameData.monsters[form.monsterId];
  const validLootRows = new Set(monster ? lootPreferenceKeysForMonster(monster) : []);
  const lootPreferences = Object.fromEntries(
    Object.entries(envelope.data.lootPreferences).filter(([rowId]) => validLootRows.has(rowId))
  );
  const droppedLootRowCount =
    Object.keys(envelope.data.lootPreferences).length - Object.keys(lootPreferences).length;

  return {
    envelope: {
      ...envelope,
      data: {
        ...envelope.data,
        lootPreferences
      }
    },
    gameDataMismatch: envelope.gameDataId !== gameData.id,
    droppedLootRowCount
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function cloneOwnedState(state: ShareableSetupOwnedState): ShareableSetupOwnedState {
  return {
    form: normalizeFormState(state.form),
    cannonByMonster: CannonByMonsterSchema.parse(state.cannonByMonster),
    lootPrefsByMonster: LootPrefsStateSchema.parse(state.lootPrefsByMonster),
    lootSettingsByMonster: LootSettingsByMonsterSchema.parse(state.lootSettingsByMonster)
  };
}

export function applyShareableSetup(
  current: ShareableSetupOwnedState,
  review: ShareableSetupReview
): ShareableSetupApplyResult {
  const undo = cloneOwnedState(current);
  const { form, cannon, lootPreferences, lootSettings } = review.envelope.data;
  const monsterId = form.monsterId;

  const cannonByMonster = { ...current.cannonByMonster };
  if (sameJson(cannon, DEFAULT_CANNON_SETTINGS)) delete cannonByMonster[monsterId];
  else cannonByMonster[monsterId] = cannon;

  const lootPrefsByMonster = { ...current.lootPrefsByMonster };
  if (Object.keys(lootPreferences).length === 0) delete lootPrefsByMonster[monsterId];
  else lootPrefsByMonster[monsterId] = { ...lootPreferences };

  const lootSettingsByMonster = { ...current.lootSettingsByMonster };
  if (sameJson(lootSettings, DEFAULT_MONSTER_LOOT_SETTINGS)) {
    delete lootSettingsByMonster[monsterId];
  } else {
    lootSettingsByMonster[monsterId] = { ...lootSettings };
  }

  return {
    undo,
    state: cloneOwnedState({
      form,
      cannonByMonster,
      lootPrefsByMonster,
      lootSettingsByMonster
    })
  };
}
