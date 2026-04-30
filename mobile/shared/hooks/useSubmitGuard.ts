import { useRef, useCallback } from "react";

export function useSubmitGuard() {
  const submittingRef = useRef(false);

  const guard = useCallback(<T>(fn: () => T): T | undefined => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    return fn();
  }, []);

  const reset = useCallback(() => {
    submittingRef.current = false;
  }, []);

  return { guard, reset, isGuarded: () => submittingRef.current };
}
