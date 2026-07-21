import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export function protectSessionOnlyChangesBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = "";
}

export function useSessionOnlyBeforeUnload(armed: boolean): void {
  const armedRef = useRef(armed);
  useLayoutEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!armedRef.current) return;
    protectSessionOnlyChangesBeforeUnload(event);
  }, []);

  useEffect(() => {
    if (!armed || typeof window === "undefined") return;
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [armed, handleBeforeUnload]);
}
