import { useEffect, useRef, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * has passed without `value` changing. Useful for deferring expensive work
 * (network validation, search) until the user stops typing.
 *
 * @param value   The rapidly-changing value to debounce.
 * @param delayMs Debounce delay in milliseconds (default 500).
 */
export function useDebounce<T>(value: T, delayMs: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
