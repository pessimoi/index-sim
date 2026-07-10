import { z } from "zod";
import type {
  HiscoresResponse,
  HiscoresSkill,
  HiscoresSkillValue,
  HiscoresStatusResponse,
  IntegrationWarning
} from "../domain/shared";
import { HiscoresProviderError, type HiscoresProvider } from "./hiscores-core";

export const LOSTCITY_HISCORES_ORIGIN = "https://2004.lostcity.rs";
export const LOSTCITY_HISCORES_RESPONSE_MAX_BYTES = 128_000;

const LOSTCITY_HISCORES_SOURCE = {
  id: "lostcity_hiscores",
  label: "2004Scape hiscores"
} as const;

const LostCityHiscoresRowSchema = z
  .object({
    type: z.number().int().nonnegative(),
    level: z.number().int(),
    value: z.number().int().nonnegative(),
    date: z.string().min(1),
    rank: z.number().int().nonnegative()
  })
  .strict();

const LostCityHiscoresResponseSchema = z.array(LostCityHiscoresRowSchema).max(64);

const SKILL_BY_TYPE = {
  1: "attack",
  2: "defence",
  3: "strength",
  4: "hitpoints",
  5: "ranged",
  6: "prayer",
  7: "magic"
} as const satisfies Readonly<Record<number, HiscoresSkill>>;

const SKILL_LABELS: Readonly<Record<HiscoresSkill, string>> = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  hitpoints: "Hitpoints",
  prayer: "Prayer",
  ranged: "Ranged",
  magic: "Magic"
};

const REQUIRED_SKILLS = Object.values(SKILL_BY_TYPE);

export interface LostCityHiscoresProviderOptions {
  fetcher?: typeof fetch;
  maxBytes?: number;
  now?: () => Date;
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined;
}

function assertJsonResponse(response: Response): void {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new HiscoresProviderError("upstream-invalid");
  }
}

function declaredContentLength(response: Response): number | null {
  const raw = response.headers.get("Content-Length");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const bytes = Number(raw);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const declaredBytes = declaredContentLength(response);
  if (declaredBytes !== null && declaredBytes > maxBytes) {
    throw new HiscoresProviderError("upstream-invalid");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;

  try {
    while (true) {
      if (signal.aborted) throw new HiscoresProviderError("upstream-unavailable");
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel();
        throw new HiscoresProviderError("upstream-invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function mapLostCityHiscoresResponse(
  input: unknown,
  player: string,
  fetchedAt: string
): HiscoresResponse {
  const parsed = LostCityHiscoresResponseSchema.safeParse(input);
  if (!parsed.success) throw new HiscoresProviderError("upstream-invalid");

  const skills: Partial<Record<HiscoresSkill, HiscoresSkillValue>> = {};
  for (const row of parsed.data) {
    const skill = SKILL_BY_TYPE[row.type as keyof typeof SKILL_BY_TYPE];
    if (!skill) continue;
    if (skills[skill]) throw new HiscoresProviderError("upstream-invalid");
    if (row.level < 1 || row.level > 99) throw new HiscoresProviderError("upstream-invalid");
    skills[skill] = {
      level: row.level,
      xp: Math.trunc(row.value / 10),
      rank: row.rank
    };
  }

  if (Object.keys(skills).length === 0) {
    throw new HiscoresProviderError("not-found");
  }

  const warnings: IntegrationWarning[] = REQUIRED_SKILLS.flatMap((skill) =>
    skills[skill]
      ? []
      : [
          {
            code: "missing-hiscores-skill",
            severity: "warning" as const,
            message: `${SKILL_LABELS[skill]} was not returned by hiscores.`,
            skill
          }
        ]
  );

  return {
    player,
    normalizedPlayer: player,
    source: LOSTCITY_HISCORES_SOURCE,
    fetchedAt,
    skills,
    warnings
  };
}

export function createLostCityHiscoresProvider(
  options: LostCityHiscoresProviderOptions = {}
): HiscoresProvider {
  const fetcher = options.fetcher ?? fetch;
  const maxBytes = options.maxBytes ?? LOSTCITY_HISCORES_RESPONSE_MAX_BYTES;
  const now = options.now ?? (() => new Date());
  const status: HiscoresStatusResponse = {
    available: true,
    source: LOSTCITY_HISCORES_SOURCE
  };

  return {
    status: () => status,
    async lookup(request, context) {
      const target = new URL(
        `/api/hiscores/player/${encodeURIComponent(request.player)}`,
        LOSTCITY_HISCORES_ORIGIN
      );

      let response: Response;
      try {
        response = await fetcher(target, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: context.signal
        });
      } catch (error) {
        if (error instanceof HiscoresProviderError) throw error;
        throw new HiscoresProviderError("upstream-unavailable");
      }

      if (response.status === 404) throw new HiscoresProviderError("not-found");
      if (response.status === 429) {
        throw new HiscoresProviderError("rate-limited", undefined, {
          retryAfterSeconds: retryAfterSeconds(response)
        });
      }
      if (!response.ok) throw new HiscoresProviderError("upstream-unavailable");

      assertJsonResponse(response);
      let responseText: string;
      try {
        responseText = await readBoundedResponseText(response, maxBytes, context.signal);
      } catch (error) {
        if (error instanceof HiscoresProviderError) throw error;
        throw new HiscoresProviderError("upstream-unavailable");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText) as unknown;
      } catch {
        throw new HiscoresProviderError("upstream-invalid");
      }
      return mapLostCityHiscoresResponse(parsed, request.player, now().toISOString());
    }
  };
}
