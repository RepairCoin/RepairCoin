import { useToast } from "react-native-toast-notifications";
import { useHaptics } from "./useHaptics";

const toastConfig = {
  placement: "top" as const,
  duration: 3000,
  animationType: "slide-in" as const,
  style: { marginTop: 28 },
};

/**
 * Custom hook for consistent toast notifications across the app
 * Wraps react-native-toast-notifications with predefined styles
 * Includes haptic feedback for each toast type
 */
export function useAppToast() {
  const toast = useToast();
  const haptics = useHaptics();

  const showSuccess = (message: string) => {
    haptics.success();
    toast.show(message, { ...toastConfig, type: "success" });
  };

  const showError = (message: string) => {
    haptics.error();
    toast.show(message, { ...toastConfig, type: "danger", duration: 4000 });
  };

  const showWarning = (message: string) => {
    haptics.warning();
    toast.show(message, { ...toastConfig, type: "warning" });
  };

  const showInfo = (message: string) => {
    haptics.light();
    toast.show(message, { ...toastConfig, type: "normal" });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    toast, // Expose raw toast for custom usage
  };
}
