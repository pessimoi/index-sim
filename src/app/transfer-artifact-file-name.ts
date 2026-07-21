export const TRANSFER_ARTIFACT_CONTEXT_MAX_LENGTH = 48;
export const TRANSFER_ARTIFACT_FILE_NAME_MAX_LENGTH = 160;

type TransferArtifactTime = Date | string;
type Revision = number | string;

export type TransferArtifactFileNameInput =
  | {
      artifact: "combat-setup";
      context: string;
      revision: Revision;
      now: TransferArtifactTime;
    }
  | {
      artifact: "saved-setup-collection";
      revision: Revision;
      now: TransferArtifactTime;
    }
  | {
      artifact: "price-set";
      context: string;
      revision: Revision;
      now: TransferArtifactTime;
    }
  | {
      artifact: "workspace-backup";
      revision: Revision;
      now: TransferArtifactTime;
    }
  | {
      artifact: "local-state-recovery-report";
      now: TransferArtifactTime;
    };

function sanitizeVariableSegment(value: string | number, fallback: string): string {
  const segment = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TRANSFER_ARTIFACT_CONTEXT_MAX_LENGTH)
    .replace(/-+$/g, "");
  return segment || fallback;
}

function compactUtcTimestamp(now: TransferArtifactTime): string {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid transfer artifact timestamp");
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function createTransferArtifactFileName(input: TransferArtifactFileNameInput): string {
  const parts = ["2004scape", input.artifact];
  if (input.artifact === "combat-setup") {
    parts.push(sanitizeVariableSegment(input.context, "target"));
  } else if (input.artifact === "price-set") {
    parts.push(sanitizeVariableSegment(input.context, "active"));
  }

  if (input.artifact !== "local-state-recovery-report") {
    parts.push("rev", sanitizeVariableSegment(input.revision, "unknown"));
  }
  parts.push(compactUtcTimestamp(input.now));

  const fileName = `${parts.join("-")}.json`;
  if (fileName.length > TRANSFER_ARTIFACT_FILE_NAME_MAX_LENGTH) {
    throw new Error("Transfer artifact filename exceeds its maximum length");
  }
  return fileName;
}
