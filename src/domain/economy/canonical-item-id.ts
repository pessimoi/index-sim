import type { DataProvenance, EntityId } from "../shared";

export interface CanonicalItemIdAlias {
  alias: EntityId;
  canonicalItemId: EntityId;
  provenance?: DataProvenance;
}

export type CanonicalItemIdResolutionSource = "identity" | "alias";

export interface CanonicalItemIdResolution {
  requestedItemId: EntityId;
  canonicalItemId: EntityId;
  source: CanonicalItemIdResolutionSource;
  alias?: EntityId;
  provenance?: DataProvenance;
}

export interface CanonicalItemIdResolver {
  resolve: (itemId: EntityId) => CanonicalItemIdResolution;
  aliasesFor: (canonicalItemId: EntityId) => EntityId[];
}

export class CanonicalItemIdMappingError extends Error {
  code = "canonical_item_alias_mapping_invalid" as const;
  issues: string[];

  constructor(issues: string[]) {
    super(`Canonical item alias mapping is invalid: ${issues.join("; ")}`);
    this.name = "CanonicalItemIdMappingError";
    this.issues = issues;
  }
}

const LEGACY_GEM_PRICE_ALIAS_PROVENANCE: DataProvenance = {
  source: "manual",
  sourceRef: "market.js SLUG_MAP gem aliases",
  verifiedAt: "2026-07-09",
  notes:
    "Explicit legacy-derived price-key alias foundation. This is not an authoritative upstream item mapping."
};

export const CANONICAL_ITEM_PRICE_ALIASES: readonly CanonicalItemIdAlias[] = [
  {
    alias: "sapphire",
    canonicalItemId: "uncut_sapphire",
    provenance: LEGACY_GEM_PRICE_ALIAS_PROVENANCE
  },
  {
    alias: "emerald",
    canonicalItemId: "uncut_emerald",
    provenance: LEGACY_GEM_PRICE_ALIAS_PROVENANCE
  },
  {
    alias: "ruby",
    canonicalItemId: "uncut_ruby",
    provenance: LEGACY_GEM_PRICE_ALIAS_PROVENANCE
  },
  {
    alias: "diamond",
    canonicalItemId: "uncut_diamond",
    provenance: LEGACY_GEM_PRICE_ALIAS_PROVENANCE
  }
];

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function createCanonicalItemIdResolver(
  aliases: readonly CanonicalItemIdAlias[]
): CanonicalItemIdResolver {
  const aliasToCanonical = new Map<EntityId, CanonicalItemIdAlias>();
  const canonicalToAliases = new Map<EntityId, EntityId[]>();
  const issues: string[] = [];

  for (const entry of aliases) {
    if (entry.alias === entry.canonicalItemId) {
      issues.push(`alias '${entry.alias}' must not map to itself`);
      continue;
    }

    const existing = aliasToCanonical.get(entry.alias);
    if (existing) {
      issues.push(
        `alias '${entry.alias}' maps to both '${existing.canonicalItemId}' and '${entry.canonicalItemId}'`
      );
      continue;
    }

    aliasToCanonical.set(entry.alias, entry);
    canonicalToAliases.set(entry.canonicalItemId, [
      ...(canonicalToAliases.get(entry.canonicalItemId) ?? []),
      entry.alias
    ]);
  }

  for (const entry of aliases) {
    const aliasEntryForCanonical = aliasToCanonical.get(entry.canonicalItemId);
    if (aliasEntryForCanonical) {
      issues.push(
        `canonical item '${entry.canonicalItemId}' is also an alias for '${aliasEntryForCanonical.canonicalItemId}'`
      );
    }
  }

  if (issues.length > 0) {
    throw new CanonicalItemIdMappingError(uniqueSortedStrings(issues));
  }

  return {
    resolve(itemId: EntityId): CanonicalItemIdResolution {
      const alias = aliasToCanonical.get(itemId);
      if (!alias) {
        return {
          requestedItemId: itemId,
          canonicalItemId: itemId,
          source: "identity"
        };
      }
      return {
        requestedItemId: itemId,
        canonicalItemId: alias.canonicalItemId,
        source: "alias",
        alias: itemId,
        provenance: alias.provenance
      };
    },
    aliasesFor(canonicalItemId: EntityId): EntityId[] {
      return uniqueSortedStrings(canonicalToAliases.get(canonicalItemId) ?? []);
    }
  };
}

export const CANONICAL_ITEM_ID_RESOLVER = createCanonicalItemIdResolver(
  CANONICAL_ITEM_PRICE_ALIASES
);

export function resolveCanonicalItemId(itemId: EntityId): CanonicalItemIdResolution {
  return CANONICAL_ITEM_ID_RESOLVER.resolve(itemId);
}

export function aliasesForCanonicalItemId(canonicalItemId: EntityId): EntityId[] {
  return CANONICAL_ITEM_ID_RESOLVER.aliasesFor(canonicalItemId);
}
