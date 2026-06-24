import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useBootStore } from "@/shared/store/boot.store";

/**
 * Dismisses the cold-start AppBootSplash once THIS screen is both focused and
 * has its data ready. The `isFocused` guard matters for deep links: on a push
 * launch the home screen mounts first but is immediately covered by the target
 * screen — only the focused, top-most screen should lift the splash, so the
 * logo stays up until the screen the user actually lands on is fully loaded.
 *
 * @param ready true once the screen's first meaningful data has loaded
 */
export function useEndBootWhenReady(ready: boolean): void {
  const isFocused = useIsFocused();
  const endBoot = useBootStore((state) => state.endBoot);

  useEffect(() => {
    if (isFocused && ready) {
      endBoot();
    }
  }, [isFocused, ready, endBoot]);
}
