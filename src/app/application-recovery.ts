import { createMemoryStorage, type KeyValueStorage } from "@/adapters/storage";

export const SAFE_SESSION_STORAGE_KEY = "index-sim:saved-data-ignored";
export const SAFE_SESSION_QUERY_PARAMETER = "index_sim_safe_session";
export const SAFE_SESSION_NOTICE =
  "Saved browser data is ignored in this tab. Changes are session-only, and existing saved data has not been changed.";

interface RecoveryLocation {
  href: string;
  reload(): void;
  replace(url: string): void;
}

interface RecoverySessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ApplicationRecoveryWindow {
  localStorage: KeyValueStorage;
  sessionStorage: RecoverySessionStorage;
  location: RecoveryLocation;
}

export interface BrowserStorageAccess {
  storage: KeyValueStorage;
  storageUnavailable: boolean;
  savedDataIgnoredForSession: boolean;
}

export function savedDataIsIgnoredForSession(windowRef: ApplicationRecoveryWindow): boolean {
  try {
    if (windowRef.sessionStorage.getItem(SAFE_SESSION_STORAGE_KEY) === "1") return true;
  } catch {
    // The query parameter remains a no-sessionStorage fallback.
  }

  try {
    return new URL(windowRef.location.href).searchParams.get(SAFE_SESSION_QUERY_PARAMETER) === "1";
  } catch {
    return false;
  }
}

export function createBrowserStorageAccess(
  windowRef?: ApplicationRecoveryWindow
): BrowserStorageAccess {
  if (!windowRef) {
    return {
      storage: createMemoryStorage(),
      storageUnavailable: false,
      savedDataIgnoredForSession: false
    };
  }

  if (savedDataIsIgnoredForSession(windowRef)) {
    return {
      storage: createMemoryStorage(),
      storageUnavailable: false,
      savedDataIgnoredForSession: true
    };
  }

  try {
    return {
      storage: windowRef.localStorage,
      storageUnavailable: false,
      savedDataIgnoredForSession: false
    };
  } catch {
    return {
      storage: createMemoryStorage(),
      storageUnavailable: true,
      savedDataIgnoredForSession: false
    };
  }
}

export function reloadSimulator(windowRef: ApplicationRecoveryWindow): void {
  windowRef.location.reload();
}

export function openWithSavedDataIgnoredForSession(windowRef: ApplicationRecoveryWindow): void {
  try {
    windowRef.sessionStorage.setItem(SAFE_SESSION_STORAGE_KEY, "1");
    windowRef.location.reload();
    return;
  } catch {
    const target = new URL(windowRef.location.href);
    target.searchParams.set(SAFE_SESSION_QUERY_PARAMETER, "1");
    windowRef.location.replace(target.toString());
  }
}
