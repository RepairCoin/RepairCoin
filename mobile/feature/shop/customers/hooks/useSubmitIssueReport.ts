import { useMutation } from "@tanstack/react-query";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { shopApi } from "@/feature/shop/services/shop.services";
import { SubmitIssueReportRequest } from "@/feature/shop/services/shop.interface";

export function useSubmitIssueReport(onSuccess?: () => void) {
  const { showSuccess, showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: SubmitIssueReportRequest) => {
      return shopApi.submitIssueReport(request);
    },
    onSuccess: () => {
      showSuccess("Report submitted. Status: pending review.");
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Failed to submit issue report:", error);
      let message = "Failed to submit report. Please try again.";
      if (error.response?.status === 401) {
        message = "Authentication required. Please log in again.";
      } else if (error.response?.status === 400) {
        message =
          error.response?.data?.error ||
          "Invalid request. Please check your inputs.";
      } else if (error.message) {
        message = error.message;
      }
      showError(message);
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: SubmitIssueReportRequest,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => {
      guard(() => mutation.mutate(request, options));
    },
  };
}
