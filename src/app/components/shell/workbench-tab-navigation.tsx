import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CombatStyle } from "@/domain/shared";
import {
  nextWorkbenchTabId,
  WORKBENCH_TABS,
  workbenchTabLabel,
  type WorkbenchTabId
} from "../../view-models/app-shell";
import {
  scrollLeftForAdjacentTab,
  scrollLeftForVisibleItem,
  type HorizontalTabBounds
} from "./workbench-tab-scroll";

interface OverflowState {
  overflowing: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const INITIAL_OVERFLOW_STATE: OverflowState = {
  overflowing: false,
  canScrollLeft: false,
  canScrollRight: false
};

function relativeTabBounds(tablist: HTMLElement, tab: HTMLElement): HorizontalTabBounds {
  const listRect = tablist.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const start = tabRect.left - listRect.left + tablist.scrollLeft;
  return { start, end: start + tabRect.width };
}

function tabBounds(tablist: HTMLElement): HorizontalTabBounds[] {
  return Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) =>
    relativeTabBounds(tablist, tab)
  );
}

export function WorkbenchTabNavigation({
  activeTab,
  combatStyle,
  onActivateTab
}: {
  activeTab: WorkbenchTabId;
  combatStyle: CombatStyle;
  onActivateTab(tabId: WorkbenchTabId): void;
}) {
  const tablistRef = useRef<HTMLElement | null>(null);
  const moreDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const moreSummaryRef = useRef<HTMLElement | null>(null);
  const [overflowState, setOverflowState] = useState<OverflowState>(INITIAL_OVERFLOW_STATE);

  const updateOverflowState = useCallback(() => {
    const tablist = tablistRef.current;
    if (!tablist) return;
    const tolerance = 1;
    const next: OverflowState = {
      overflowing: tablist.scrollWidth > tablist.clientWidth + tolerance,
      canScrollLeft: tablist.scrollLeft > tolerance,
      canScrollRight: tablist.scrollLeft + tablist.clientWidth < tablist.scrollWidth - tolerance
    };
    setOverflowState((current) =>
      current.overflowing === next.overflowing &&
      current.canScrollLeft === next.canScrollLeft &&
      current.canScrollRight === next.canScrollRight
        ? current
        : next
    );
  }, []);

  useEffect(() => {
    const tablist = tablistRef.current;
    if (!tablist) return;
    let mounted = true;
    const update = () => {
      if (mounted) updateOverflowState();
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(tablist);
    for (const tab of tablist.querySelectorAll<HTMLElement>('[role="tab"]')) {
      observer?.observe(tab);
    }
    tablist.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      mounted = false;
      observer?.disconnect();
      tablist.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [combatStyle, updateOverflowState]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const tablist = tablistRef.current;
      const active = tablist?.querySelector<HTMLElement>(`#workbench-tab-${activeTab}`);
      if (!tablist || !active) return;
      tablist.scrollLeft = scrollLeftForVisibleItem(
        tablist.scrollLeft,
        tablist.clientWidth,
        tablist.scrollWidth,
        relativeTabBounds(tablist, active)
      );
      updateOverflowState();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, combatStyle, updateOverflowState]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextTabId = nextWorkbenchTabId(activeTab, event.key);
    if (!nextTabId) return;
    event.preventDefault();
    onActivateTab(nextTabId);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelector<HTMLButtonElement>(`#workbench-tab-${nextTabId}`)
      ?.focus();
  };

  const scrollTabs = (direction: "left" | "right") => {
    const tablist = tablistRef.current;
    if (!tablist) return;
    tablist.scrollLeft = scrollLeftForAdjacentTab(
      direction,
      tablist.scrollLeft,
      tablist.clientWidth,
      tablist.scrollWidth,
      tabBounds(tablist)
    );
    updateOverflowState();
  };

  const activateFromMore = (tabId: WorkbenchTabId) => {
    onActivateTab(tabId);
    if (moreDetailsRef.current) moreDetailsRef.current.open = false;
    moreSummaryRef.current?.focus();
  };

  return (
    <div className="workbench-tab-navigation">
      <button
        type="button"
        className="workbench-tab-scroll"
        aria-label="Scroll workbench tabs left"
        title="Scroll workbench tabs left"
        hidden={!overflowState.overflowing}
        disabled={!overflowState.canScrollLeft}
        onClick={() => scrollTabs("left")}
      >
        ‹
      </button>
      <nav ref={tablistRef} className="tab-bar" aria-label="Workbench tabs" role="tablist">
        {WORKBENCH_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`workbench-tab-${tab.id}`}
            type="button"
            role="tab"
            className={activeTab === tab.id ? "active" : undefined}
            aria-selected={activeTab === tab.id}
            aria-controls="workbench-active-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onActivateTab(tab.id)}
            onKeyDown={handleTabKeyDown}
          >
            {workbenchTabLabel(tab.id, combatStyle)}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="workbench-tab-scroll"
        aria-label="Scroll workbench tabs right"
        title="Scroll workbench tabs right"
        hidden={!overflowState.overflowing}
        disabled={!overflowState.canScrollRight}
        onClick={() => scrollTabs("right")}
      >
        ›
      </button>
      <details
        ref={moreDetailsRef}
        className="workbench-more-tabs"
        hidden={!overflowState.overflowing}
      >
        <summary ref={moreSummaryRef}>More tabs</summary>
        <div className="workbench-more-tabs-list" aria-label="All workbench tabs">
          {WORKBENCH_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : undefined}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => activateFromMore(tab.id)}
            >
              {workbenchTabLabel(tab.id, combatStyle)}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
