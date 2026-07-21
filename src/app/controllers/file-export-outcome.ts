import type { JsonDownloadRequestResult } from "@/adapters/browser";

export type FileExportArtifact = "setup" | "saved-setup" | "price-set" | "workspace" | "recovery";

export type FileExportOutcome =
  | {
      status: "requested";
      fileName: string;
      appStatus: string;
      notice: { tone: "neutral"; message: string };
    }
  | {
      status: "failed";
      appStatus: string;
      notice: { tone: "error"; message: string };
    };

const FILE_EXPORT_LABELS: Record<FileExportArtifact, string> = {
  setup: "Setup",
  "saved-setup": "Saved setup",
  "price-set": "PriceSet",
  workspace: "Workspace backup",
  recovery: "Recovery report"
};

export function failedFileExportOutcome(artifact: FileExportArtifact): FileExportOutcome {
  const message = `${FILE_EXPORT_LABELS[artifact]} download could not be started. Try again.`;
  return { status: "failed", appStatus: message, notice: { tone: "error", message } };
}

export function requestFileExport(
  artifact: FileExportArtifact,
  fileName: string,
  request: () => JsonDownloadRequestResult
): FileExportOutcome {
  let result: JsonDownloadRequestResult;
  try {
    result = request();
  } catch {
    return failedFileExportOutcome(artifact);
  }
  if (result?.status !== "requested") return failedFileExportOutcome(artifact);
  const message = `${FILE_EXPORT_LABELS[artifact]} download started: ${fileName}. Check your browser downloads.`;
  return {
    status: "requested",
    fileName,
    appStatus: message,
    notice: { tone: "neutral", message }
  };
}
