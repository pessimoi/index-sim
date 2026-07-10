export interface ShareableLocation {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}

export interface ShareableHistory {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export interface ClipboardWriter {
  writeText(value: string): Promise<void>;
}

let capturedBrowserShareableSetupFragment: string | null | undefined;

export function createShareableSetupUrl(payload: string, location: ShareableLocation): string {
  return `${location.origin}${location.pathname}#setup=${payload}`;
}

export function captureShareableSetupFragment(
  location: ShareableLocation,
  history: ShareableHistory
): string | null {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const payload = params.get("setup");
  if (payload === null) return null;

  params.delete("setup");
  const remainingHash = params.toString();
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${remainingHash ? `#${remainingHash}` : ""}`
  );
  return payload;
}

export function captureBrowserShareableSetupFragment(): string | null {
  if (capturedBrowserShareableSetupFragment !== undefined) {
    return capturedBrowserShareableSetupFragment;
  }
  capturedBrowserShareableSetupFragment =
    typeof window === "undefined"
      ? null
      : captureShareableSetupFragment(window.location, window.history);
  return capturedBrowserShareableSetupFragment;
}

export function createBrowserShareableSetupUrl(payload: string): string {
  if (typeof window === "undefined") {
    throw new Error("Browser location is unavailable");
  }
  return createShareableSetupUrl(payload, window.location);
}

export async function writeShareableSetupToClipboard(
  value: string,
  clipboard: ClipboardWriter | null = typeof navigator === "undefined"
    ? null
    : (navigator.clipboard ?? null)
): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
