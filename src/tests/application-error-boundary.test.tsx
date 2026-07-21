// @vitest-environment jsdom

import { Component, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  SAFE_SESSION_NOTICE,
  SAFE_SESSION_QUERY_PARAMETER,
  SAFE_SESSION_STORAGE_KEY,
  createBrowserStorageAccess,
  openWithSavedDataIgnoredForSession,
  reloadSimulator,
  type ApplicationRecoveryWindow
} from "../app/application-recovery";
import {
  APPLICATION_RENDER_ERROR_MESSAGE,
  ApplicationErrorBoundary,
  ApplicationFailureScreen,
  SafeSessionNotice
} from "../app/components/shell/application-error-boundary";
import { APP_STARTUP_ERROR_MESSAGE, ApplicationEntryLoadError } from "../app/startup-guard-core";
import { RUNTIME_BOOTSTRAP_ERROR_MESSAGE } from "../app/controllers/runtime-bootstrap";
import type { SessionOnlyExitProtectionSnapshot } from "../app/controllers/session-only-exit-protection";

interface RecoveryWindowFixture {
  windowRef: ApplicationRecoveryWindow;
  localStorage: KeyValueStorage;
  sessionValues: Map<string, string>;
  reload: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
}

function recoveryWindow(options: { sessionStorageFails?: boolean } = {}): RecoveryWindowFixture {
  const localStorage = createMemoryStorage();
  const sessionValues = new Map<string, string>();
  const reload = vi.fn();
  const replace = vi.fn();
  return {
    localStorage,
    sessionValues,
    reload,
    replace,
    windowRef: {
      localStorage,
      sessionStorage: {
        getItem(key) {
          if (options.sessionStorageFails) throw new Error("session storage unavailable");
          return sessionValues.get(key) ?? null;
        },
        setItem(key, value) {
          if (options.sessionStorageFails) throw new Error("session storage unavailable");
          sessionValues.set(key, value);
        }
      },
      location: {
        href: "https://simulator.example/workbench?existing=1#current",
        reload,
        replace
      }
    }
  };
}

function ReadyPane({ fail }: { fail: boolean }) {
  if (fail) {
    const error = new Error("raw pane failure at /private/source.ts:42");
    error.stack = "private stack marker at /private/stack.ts:9";
    throw error;
  }
  return <main data-app-startup-state="ready">Ready pane</main>;
}

function FailedEntryPane(): null {
  throw new ApplicationEntryLoadError();
}

class LifecyclePane extends Component<{ fail: boolean }> {
  componentDidUpdate() {
    if (!this.props.fail) return;
    const error = new Error("raw lifecycle failure at /private/lifecycle.ts:17");
    error.stack = "private lifecycle stack at /private/lifecycle-stack.ts:3";
    throw error;
  }

  render() {
    return <main data-app-startup-state="ready">Ready lifecycle pane</main>;
  }
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});

describe("application error boundary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("renders a fixed bootstrap failure with both recovery actions", () => {
    const markup = renderToStaticMarkup(
      <ApplicationFailureScreen
        message={RUNTIME_BOOTSTRAP_ERROR_MESSAGE}
        onReload={() => {}}
        onOpenWithSavedDataIgnored={() => {}}
      />
    );

    expect(markup).toContain(RUNTIME_BOOTSTRAP_ERROR_MESSAGE);
    expect(markup).toContain("Reload simulator");
    expect(markup).toContain("Open with saved data ignored for this session");
    expect(markup).toContain("will not be cleared automatically");
    expect(markup).not.toContain("private/source.ts");
  });

  it("replaces a ready pane render failure with sanitized recovery UI", async () => {
    const reload = vi.fn();
    const openSafely = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <ApplicationErrorBoundary onReload={reload} onOpenWithSavedDataIgnored={openSafely}>
            <ReadyPane fail={false} />
          </ApplicationErrorBoundary>
        );
      });
      expect(container.querySelector('[data-app-startup-state="ready"]')).not.toBeNull();

      await act(async () => {
        root.render(
          <ApplicationErrorBoundary onReload={reload} onOpenWithSavedDataIgnored={openSafely}>
            <ReadyPane fail />
          </ApplicationErrorBoundary>
        );
      });

      const alert = container.querySelector<HTMLElement>('[role="alert"]');
      expect(alert?.textContent).toContain(APPLICATION_RENDER_ERROR_MESSAGE);
      expect(alert?.textContent).not.toContain("raw pane failure");
      expect(alert?.textContent).not.toContain("private/source.ts");
      expect(alert?.textContent).not.toContain("private stack marker");
      expect(container.querySelector('[data-app-startup-state="ready"]')).toBeNull();
      expect(container.querySelector('[data-app-startup-state="error"]')).not.toBeNull();

      const buttons = [...container.querySelectorAll("button")];
      await act(async () => buttons[0]?.click());
      await act(async () => buttons[1]?.click());
      expect(reload).toHaveBeenCalledOnce();
      expect(openSafely).toHaveBeenCalledOnce();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports a lazy entry load failure as the fixed sanitized startup error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <ApplicationErrorBoundary>
            <FailedEntryPane />
          </ApplicationErrorBoundary>
        );
      });

      const alert = container.querySelector<HTMLElement>('[role="alert"]');
      expect(alert?.textContent).toContain(APP_STARTUP_ERROR_MESSAGE);
      expect(alert?.textContent).not.toContain(APPLICATION_RENDER_ERROR_MESSAGE);
      expect(container.querySelector('[data-app-startup-state="error"]')).not.toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("replaces a post-ready lifecycle failure with the same sanitized recovery UI", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <ApplicationErrorBoundary>
            <LifecyclePane fail={false} />
          </ApplicationErrorBoundary>
        );
      });
      expect(container.querySelector('[data-app-startup-state="ready"]')).not.toBeNull();

      await act(async () => {
        root.render(
          <ApplicationErrorBoundary>
            <LifecyclePane fail />
          </ApplicationErrorBoundary>
        );
      });

      const alert = container.querySelector<HTMLElement>('[role="alert"]');
      expect(alert?.textContent).toContain(APPLICATION_RENDER_ERROR_MESSAGE);
      expect(alert?.textContent).not.toContain("raw lifecycle failure");
      expect(alert?.textContent).not.toContain("private lifecycle stack");
      expect(container.querySelector('[data-app-startup-state="ready"]')).toBeNull();
      expect(container.querySelector('[data-app-startup-state="error"]')).not.toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("session-only saved-data recovery", () => {
  it("switches to isolated memory without reading, overwriting or clearing saved data", () => {
    const fixture = recoveryWindow();
    fixture.localStorage.setItem("index-sim:rewrite-setup", "private saved setup");
    fixture.sessionValues.set(SAFE_SESSION_STORAGE_KEY, "1");
    const localGet = vi.fn(fixture.localStorage.getItem);
    const localSet = vi.fn(fixture.localStorage.setItem);
    const localRemove = vi.fn(fixture.localStorage.removeItem);
    const localStoragePropertyRead = vi.fn(() => ({
      getItem: localGet,
      setItem: localSet,
      removeItem: localRemove
    }));
    Object.defineProperty(fixture.windowRef, "localStorage", {
      configurable: true,
      get: localStoragePropertyRead
    });

    const access = createBrowserStorageAccess(fixture.windowRef);

    expect(access.savedDataIgnoredForSession).toBe(true);
    expect(access.storageUnavailable).toBe(false);
    expect(localStoragePropertyRead).not.toHaveBeenCalled();
    expect(localGet).not.toHaveBeenCalled();
    expect(access.storage.getItem("index-sim:rewrite-setup")).toBeNull();
    access.storage.setItem("index-sim:rewrite-setup", "session setup");
    access.storage.removeItem("index-sim:rewrite-setup");
    expect(localSet).not.toHaveBeenCalled();
    expect(localRemove).not.toHaveBeenCalled();
    expect(fixture.localStorage.getItem("index-sim:rewrite-setup")).toBe("private saved setup");
  });

  it("reloads normally without modifying local storage", () => {
    const fixture = recoveryWindow();
    fixture.localStorage.setItem("keep", "saved");

    reloadSimulator(fixture.windowRef);

    expect(fixture.reload).toHaveBeenCalledOnce();
    expect(fixture.replace).not.toHaveBeenCalled();
    expect(fixture.localStorage.getItem("keep")).toBe("saved");
  });

  it("sets a tab-scoped flag before reload and never touches local storage", () => {
    const fixture = recoveryWindow();
    fixture.localStorage.setItem("keep", "saved");

    openWithSavedDataIgnoredForSession(fixture.windowRef);

    expect(fixture.sessionValues.get(SAFE_SESSION_STORAGE_KEY)).toBe("1");
    expect(fixture.reload).toHaveBeenCalledOnce();
    expect(fixture.replace).not.toHaveBeenCalled();
    expect(fixture.localStorage.getItem("keep")).toBe("saved");
  });

  it("uses a URL-scoped fallback when session storage is unavailable", () => {
    const fixture = recoveryWindow({ sessionStorageFails: true });

    openWithSavedDataIgnoredForSession(fixture.windowRef);

    expect(fixture.reload).not.toHaveBeenCalled();
    expect(fixture.replace).toHaveBeenCalledOnce();
    const target = new URL(String(fixture.replace.mock.calls[0]?.[0]));
    expect(target.pathname).toBe("/workbench");
    expect(target.searchParams.get(SAFE_SESSION_QUERY_PARAMETER)).toBe("1");
    expect(target.searchParams.get("existing")).toBe("1");
    expect(target.hash).toBe("#current");

    fixture.windowRef.location.href = target.toString();
    const localStoragePropertyRead = vi.fn(() => fixture.localStorage);
    Object.defineProperty(fixture.windowRef, "localStorage", {
      configurable: true,
      get: localStoragePropertyRead
    });
    const access = createBrowserStorageAccess(fixture.windowRef);
    expect(access.savedDataIgnoredForSession).toBe(true);
    expect(access.storageUnavailable).toBe(false);
    expect(localStoragePropertyRead).not.toHaveBeenCalled();
  });

  it("presents the active safe mode without exposing storage details", () => {
    const markup = renderToStaticMarkup(<SafeSessionNotice />);

    expect(markup).toContain("Session-only safe mode");
    expect(markup).toContain(SAFE_SESSION_NOTICE);
    expect(markup).not.toContain(SAFE_SESSION_STORAGE_KEY);
  });

  it("composes dirty-session risk, direct backup, area count and privacy guidance", () => {
    const download = vi.fn();
    const guard: SessionOnlyExitProtectionSnapshot = {
      revision: 1,
      initialized: true,
      armed: true,
      sessionOnlyChangeCount: 2,
      affectedAreas: [
        { id: "rewrite-setup", label: "Rewrite setup", reason: "saved-data-ignored" },
        {
          id: "hiscores-last-player",
          label: "Hiscores last player",
          reason: "saved-data-ignored"
        }
      ],
      reasons: ["saved-data-ignored"],
      backupOutcome: {
        status: "requested",
        message:
          "Workspace backup download started for the current changes. Check your browser downloads; saving the file cannot be verified."
      },
      sensitiveAreaOmitted: true
    };
    const markup = renderToStaticMarkup(
      <SafeSessionNotice guard={guard} onDownloadWorkspace={download} />
    );

    expect(markup).toContain('aria-label="Unsaved session-only changes"');
    expect(markup).toContain("Affected Workspace areas: 2");
    expect(markup).toContain("Download full Workspace backup");
    expect(markup).toContain("saving the file cannot be verified");
    expect(markup).toContain("The last Hiscores player was not included");
    expect(markup).not.toContain("Private Hero");
  });
});
