import {
  DEFAULT_WORKBENCH_TAB,
  createWorkbenchPaneUrl,
  formatWorkbenchDocumentTitle,
  parseWorkbenchPaneUrl,
  removeInvalidWorkbenchPane,
  workbenchHistoryMutationForSource
} from "../app/state/workbench-browser-context";
import { WORKBENCH_TABS } from "../app/view-models/app-shell";

describe("workbench browser context", () => {
  it("parses every exact allowlisted pane and preserves the missing Compare default", () => {
    for (const tab of WORKBENCH_TABS) {
      expect(parseWorkbenchPaneUrl(`https://example.test/sim/?pane=${tab.id}`)).toEqual({
        pane: tab.id,
        status: "valid"
      });
    }
    expect(parseWorkbenchPaneUrl("https://example.test/sim/?safe=1#setup=opaque%2Fvalue")).toEqual({
      pane: DEFAULT_WORKBENCH_TAB,
      status: "missing"
    });
  });

  it.each([
    "pane=",
    "pane=Planner",
    "pane=unknown",
    "pane=planner&pane=economy",
    "pane=planner%2Feconomy",
    "pane=planner%5Ceconomy",
    "pane=planner%00",
    `pane=${"p".repeat(256)}`
  ])("rejects invalid pane query %s", (query) => {
    expect(parseWorkbenchPaneUrl(`https://example.test/root?${query}`)).toEqual({
      pane: DEFAULT_WORKBENCH_TAB,
      status: "invalid"
    });
  });

  it("writes one pane under root and sub-path URLs without interpreting other state", () => {
    expect(
      createWorkbenchPaneUrl("https://example.test/?x=1#setup=a%2Fb&note=two", "planner")
    ).toBe("https://example.test/?x=1&pane=planner#setup=a%2Fb&note=two");
    expect(
      createWorkbenchPaneUrl(
        "https://example.test/tools/sim/?pane=trip&index_sim_safe_session=1&x=2#custom=%2Fraw",
        "economy"
      )
    ).toBe(
      "https://example.test/tools/sim/?index_sim_safe_session=1&x=2&pane=economy#custom=%2Fraw"
    );
  });

  it("removes only invalid pane entries and preserves safe query plus opaque fragments", () => {
    expect(
      removeInvalidWorkbenchPane(
        "https://example.test/sub/?pane=bad&x=1&pane=trip&index_sim_safe_session=1#setup=opaque%2Fpayload&next=%00"
      )
    ).toBe(
      "https://example.test/sub/?x=1&index_sim_safe_session=1#setup=opaque%2Fpayload&next=%00"
    );
  });

  it("maps every activation source to one exhaustive history mutation", () => {
    expect(workbenchHistoryMutationForSource("initial-url")).toBe("none");
    expect(workbenchHistoryMutationForSource("user")).toBe("push");
    expect(workbenchHistoryMutationForSource("routed-action")).toBe("push");
    expect(workbenchHistoryMutationForSource("history")).toBe("none");
    expect(workbenchHistoryMutationForSource("internal-restore")).toBe("replace");
  });

  it("formats fixed, dynamic Loadout and fallback titles from trusted context only", () => {
    expect(
      formatWorkbenchDocumentTitle({
        pane: "planner",
        combatStyle: "melee",
        targetLabel: "Hill Giant"
      })
    ).toBe("Planner · Hill Giant · 2004scape Combat Simulator");
    expect(
      formatWorkbenchDocumentTitle({
        pane: "loadout",
        combatStyle: "ranged",
        targetLabel: "Dagannoth"
      })
    ).toBe("Ranged setup · Dagannoth · 2004scape Combat Simulator");
    expect(
      formatWorkbenchDocumentTitle({
        pane: "economy",
        combatStyle: "magic",
        targetLabel: "bad\u0000target"
      })
    ).toBe("Economy · Unknown target · 2004scape Combat Simulator");
  });
});
