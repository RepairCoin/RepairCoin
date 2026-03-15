import { useToast } from "react-native-toast-notifications";

const toastConfig = {
  placement: "top" as const,
  duration: 3000,
  animationType: "slide-in" as const,
  style: { marginTop: 28 },
};

/**
 * Custom hook for consistent toast notifications across the app
 * Wraps react-native-toast-notifications with predefined styles
 */
export function useAppToast() {
  const toast = useToast();

  const showSuccess = (message: string) => {
    toast.show(message, { ...toastConfig, type: "success" });
  };

  const showError = (message: string) => {
    toast.show(message, { ...toastConfig, type: "danger", duration: 4000 });
  };

  const showWarning = (message: string) => {
    toast.show(message, { ...toastConfig, type: "warning" });
  };

  const showInfo = (message: string) => {
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
