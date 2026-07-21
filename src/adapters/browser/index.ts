export {
  captureBrowserShareableSetupFragment,
  captureShareableSetupFragment,
  createBrowserShareableSetupUrl,
  createShareableSetupUrl,
  writeShareableSetupToClipboard
} from "./shareable-url";

export type JsonDownloadRequestResult =
  | Readonly<{
      status: "requested";
      fileName: string;
      byteLength: number;
    }>
  | Readonly<{
      status: "failed";
      reason: "serialization" | "browser-api" | "dispatch";
    }>;

function failedJsonDownload(
  reason: Extract<JsonDownloadRequestResult, { status: "failed" }>["reason"]
): JsonDownloadRequestResult {
  return Object.freeze({ status: "failed", reason });
}

export function requestJsonDownload(fileName: string, value: unknown): JsonDownloadRequestResult {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value, null, 2);
  } catch {
    return failedJsonDownload("serialization");
  }
  if (typeof serialized !== "string") return failedJsonDownload("serialization");

  if (
    typeof Blob !== "function" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof URL.revokeObjectURL !== "function" ||
    typeof document === "undefined" ||
    !document.body
  ) {
    return failedJsonDownload("browser-api");
  }

  let blob: Blob;
  let objectUrl: string;
  try {
    blob = new Blob([serialized], { type: "application/json" });
    objectUrl = URL.createObjectURL(blob);
  } catch {
    return failedJsonDownload("browser-api");
  }

  let revoked = false;
  const revokeOnce = () => {
    if (revoked) return;
    revoked = true;
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Cleanup errors must not replace the primary request outcome.
    }
  };
  try {
    window.setTimeout(revokeOnce, 0);
  } catch {
    revokeOnce();
    return failedJsonDownload("browser-api");
  }

  let anchor: HTMLAnchorElement;
  const focusTarget = document.activeElement;
  try {
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.tabIndex = -1;
    anchor.hidden = true;
  } catch {
    return failedJsonDownload("browser-api");
  }

  try {
    document.body.appendChild(anchor);
    anchor.click();
  } catch {
    return failedJsonDownload("dispatch");
  } finally {
    try {
      anchor.remove();
    } catch {
      // The bounded URL cleanup above still runs even if DOM cleanup fails.
    }
    try {
      if (focusTarget instanceof HTMLElement) focusTarget.focus();
    } catch {
      // Focus restoration is best-effort and must not replace the download outcome.
    }
  }

  return Object.freeze({ status: "requested", fileName, byteLength: blob.size });
}

export const downloadJsonFile = requestJsonDownload;

export async function readBrowserFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${maxBytes} bytes`);
  }
  return file.text();
}
