export { loadBundledLegacyContext } from "../legacy-runtime";
export type { LegacyRuntimeBootstrapResult as BrowserBootstrapResult } from "../legacy-runtime";

export function downloadJsonFile(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readBrowserFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${maxBytes} bytes`);
  }
  return file.text();
}
