export interface HorizontalTabBounds {
  start: number;
  end: number;
}

function clampScrollLeft(value: number, clientWidth: number, scrollWidth: number): number {
  return Math.max(0, Math.min(value, Math.max(0, scrollWidth - clientWidth)));
}

export function scrollLeftForVisibleItem(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  item: HorizontalTabBounds
): number {
  const visibleEnd = scrollLeft + clientWidth;
  if (item.start < scrollLeft) {
    return clampScrollLeft(item.start, clientWidth, scrollWidth);
  }
  if (item.end > visibleEnd) {
    return clampScrollLeft(item.end - clientWidth, clientWidth, scrollWidth);
  }
  return clampScrollLeft(scrollLeft, clientWidth, scrollWidth);
}

export function scrollLeftForAdjacentTab(
  direction: "left" | "right",
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  tabs: readonly HorizontalTabBounds[]
): number {
  const tolerance = 1;
  if (direction === "right") {
    const visibleEnd = scrollLeft + clientWidth;
    const next = tabs.find((tab) => tab.end > visibleEnd + tolerance);
    return next
      ? clampScrollLeft(next.end - clientWidth, clientWidth, scrollWidth)
      : clampScrollLeft(scrollWidth, clientWidth, scrollWidth);
  }

  const previous = [...tabs].reverse().find((tab) => tab.start < scrollLeft - tolerance);
  return previous ? clampScrollLeft(previous.start, clientWidth, scrollWidth) : 0;
}
