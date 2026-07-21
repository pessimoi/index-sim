import { lazy, type LazyExoticComponent, type ReactNode } from "react";

type PaneComponent<Props> = (props: Props) => ReactNode;

export interface TrackedLazyPane<Props> {
  Component: LazyExoticComponent<PaneComponent<Props>>;
  isLoaded(): boolean;
}

export function createTrackedLazyPane<Props>(
  loader: () => Promise<{ default: PaneComponent<Props> }>
): TrackedLazyPane<Props> {
  let loaded = false;
  return {
    Component: lazy(async () => {
      const module = await loader();
      loaded = true;
      return module;
    }),
    isLoaded: () => loaded
  };
}
