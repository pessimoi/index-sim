// @vitest-environment jsdom

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  PANE_LOAD_FAILURE_MESSAGE,
  PANE_RENDER_FAILURE_MESSAGE,
  PaneBoundary
} from "../app/components/shell/pane-boundary";
import { createTrackedLazyPane } from "../app/components/shell/tracked-lazy-pane";
import {
  LAZY_PANE_FAMILIES,
  PANE_FAMILY_BY_TAB,
  createInitialPaneLoadStates,
  createInitialRequestedPaneFamilies,
  paneFamilyForTab,
  requestPaneFamily,
  type PaneLoadState
} from "../app/state/pane-delivery";
import { WORKBENCH_TABS } from "../app/view-models/app-shell";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});

describe("pane delivery registry", () => {
  it("maps every workbench tab to one closed pane family", () => {
    expect(Object.keys(PANE_FAMILY_BY_TAB)).toEqual(WORKBENCH_TABS.map((tab) => tab.id));
    expect(WORKBENCH_TABS.map((tab) => paneFamilyForTab(tab.id))).toEqual([
      "stats",
      "loadout",
      "compare",
      "duel",
      "loot",
      "trip",
      "risk",
      "cannon",
      "planner",
      "economy-settings",
      "economy-settings"
    ]);
    expect(new Set(LAZY_PANE_FAMILIES).size).toBe(LAZY_PANE_FAMILIES.length);
  });

  it("requests only Compare initially and adds shared families idempotently", () => {
    const initial = createInitialRequestedPaneFamilies();
    expect([...initial]).toEqual(["compare"]);

    expect([...createInitialRequestedPaneFamilies("planner")]).toEqual(["planner"]);
    expect([...createInitialRequestedPaneFamilies("settings")]).toEqual(["economy-settings"]);
    expect(createInitialPaneLoadStates("planner")).toMatchObject({
      stats: "ready",
      compare: "not-requested",
      planner: "loading"
    });
    expect(createInitialPaneLoadStates("stats")).toMatchObject({
      stats: "ready",
      compare: "not-requested"
    });

    const withRisk = requestPaneFamily(initial, "risk");
    expect([...withRisk]).toEqual(["compare", "risk"]);
    expect(requestPaneFamily(withRisk, "risk")).toBe(withRisk);

    const withEconomy = requestPaneFamily(withRisk, "economy");
    expect([...withEconomy]).toEqual(["compare", "risk", "economy-settings"]);
    expect(requestPaneFamily(withEconomy, "settings")).toBe(withEconomy);
    expect([...initial]).toEqual(["compare"]);
  });
});

describe("pane loading and failure boundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    consoleError.mockRestore();
  });

  it("shows one named active loading status and keeps hidden loading silent", async () => {
    const never = new Promise<{ default: () => ReactElement }>(() => undefined);
    const tracked = createTrackedLazyPane<Record<string, never>>(() => never);
    const states: PaneLoadState[] = [];

    await act(async () => {
      root.render(
        <PaneBoundary
          active
          family="risk"
          label="Risk"
          moduleLoaded={tracked.isLoaded}
          onLoadStateChange={(_family, state) => states.push(state)}
        >
          <tracked.Component />
        </PaneBoundary>
      );
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe("Loading Risk…");
    expect(states).toContain("loading");

    await act(async () => root.unmount());
    root = createRoot(container);
    const hiddenTracked = createTrackedLazyPane<Record<string, never>>(
      () => new Promise<{ default: () => ReactElement }>(() => undefined)
    );
    await act(async () => {
      root.render(
        <PaneBoundary
          active={false}
          family="risk"
          label="Risk"
          moduleLoaded={hiddenTracked.isLoaded}
          onLoadStateChange={() => undefined}
        >
          <hiddenTracked.Component />
        </PaneBoundary>
      );
    });
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).toContain("Loading Risk…");
  });

  it("sanitizes a lazy rejection, leaves shell siblings mounted and offers Reload only", async () => {
    const reload = vi.fn();
    const tracked = createTrackedLazyPane<Record<string, never>>(async () => {
      throw new Error("private chunk URL /assets/risk-secret.js");
    });

    await act(async () => {
      root.render(
        <>
          <nav data-testid="shell-sentinel">Tabs remain usable</nav>
          <PaneBoundary
            active
            family="risk"
            label="Risk"
            moduleLoaded={tracked.isLoaded}
            onLoadStateChange={() => undefined}
            onReload={reload}
          >
            <tracked.Component />
          </PaneBoundary>
        </>
      );
    });

    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain(PANE_LOAD_FAILURE_MESSAGE);
    expect(alert?.textContent).not.toContain("risk-secret");
    expect(alert?.textContent).not.toContain("Try pane again");
    expect(container.querySelector('[data-testid="shell-sentinel"]')).not.toBeNull();
    const reloadButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Reload simulator"
    );
    await act(async () => reloadButton?.click());
    expect(reload).toHaveBeenCalledOnce();
  });

  it("retries only an already loaded failed subtree and returns focus after success", async () => {
    let shouldFail = true;
    let mountCount = 0;
    const onState = vi.fn();
    function RecoveringPane() {
      mountCount += 1;
      if (shouldFail) {
        throw new Error("private render stack marker");
      }
      return <p data-testid="recovered-pane">Recovered pane</p>;
    }
    const tracked = createTrackedLazyPane<Record<string, never>>(async () => ({
      default: RecoveringPane
    }));

    await act(async () => {
      root.render(
        <>
          <button id="workbench-active-panel" type="button">
            Active panel
          </button>
          <PaneBoundary
            active
            family="planner"
            label="Planner"
            moduleLoaded={tracked.isLoaded}
            onLoadStateChange={onState}
          >
            <tracked.Component />
          </PaneBoundary>
        </>
      );
    });

    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain(PANE_RENDER_FAILURE_MESSAGE);
    expect(alert?.textContent).not.toContain("private render stack marker");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try pane again"
    );
    shouldFail = false;
    await act(async () => retry?.click());

    expect(container.querySelector('[data-testid="recovered-pane"]')).not.toBeNull();
    expect(mountCount).toBeGreaterThanOrEqual(2);
    expect(document.activeElement?.id).toBe("workbench-active-panel");
    expect(onState).toHaveBeenCalledWith("planner", "failed");
    expect(onState).toHaveBeenCalledWith("planner", "ready");
  });

  it("keeps a hidden failure silent until its pane becomes active", async () => {
    const tracked = createTrackedLazyPane<Record<string, never>>(async () => {
      throw new Error("hidden raw failure");
    });
    const render = (active: boolean) => (
      <PaneBoundary
        active={active}
        family="loot"
        label="Loot"
        moduleLoaded={tracked.isLoaded}
        onLoadStateChange={() => undefined}
      >
        <tracked.Component />
      </PaneBoundary>
    );

    await act(async () => root.render(render(false)));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Loot unavailable");

    await act(async () => root.render(render(true)));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      PANE_LOAD_FAILURE_MESSAGE
    );
  });
});
