import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys, useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { marketingApi } from "../services/marketing.services";
import { CreateContactData, UpdateContactData } from "../services/marketing.interface";

function show4xxError(showError: (message: string) => void, error: any, fallback: string) {
  // 4xx only — the axios interceptor already toasts network errors, timeouts, and 5xx globally,
  // so surfacing those here too would double-toast. This is also where the server's 400 for
  // "email or phone required" (the DB CHECK mirrored in useContactForm) surfaces.
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) {
    showError(error.response?.data?.error || error.message || fallback);
  }
}

function invalidateContactLists(queryClient: ReturnType<typeof useQueryClient>, shopId?: string) {
  if (!shopId) return;
  // Prefix invalidation — queryKeys.shopContacts(shopId, status, search) keys include filters,
  // so this must match every status/search variant in one call.
  queryClient.invalidateQueries({ queryKey: [...queryKeys.shops(), "contacts", shopId] });
  // Stats sits at ['contacts','stats',shopId], so the list prefix above never reaches it.
  queryClient.invalidateQueries({ queryKey: queryKeys.shopContactStats(shopId) });
}

export function useCreateContactMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateContactData) => marketingApi.createContact(shopId as string, data),
    onSuccess: () => invalidateContactLists(queryClient, shopId),
    onError: (error: any) => show4xxError(showError, error, "Failed to add contact."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (data: CreateContactData, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(data, options));
    },
  };
}

export function useUpdateContactMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: UpdateContactData }) =>
      marketingApi.updateContact(contactId, data),
    onSuccess: () => invalidateContactLists(queryClient, shopId),
    onError: (error: any) => show4xxError(showError, error, "Failed to update contact."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      variables: { contactId: string; data: UpdateContactData },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}

export function useDeleteContactMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (contactId: string) => marketingApi.deleteContact(contactId),
    onSuccess: () => invalidateContactLists(queryClient, shopId),
    onError: (error: any) => show4xxError(showError, error, "Failed to delete contact."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (contactId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
      guard(() => mutation.mutate(contactId, options));
    },
  };
}

/**
 * Hard-capped by the caller at CONTACT_BLAST_MAX (contacts have no scheduler equivalent to
 * campaigns — this is a direct, synchronous email loop server-side, same ECONNABORTED caveat as
 * useSendCampaignMutation).
 */
export function useSendContactBlastMutation() {
  const { showError, showWarning } = useAppToast();
  const { guard, reset } = useSubmitGuard();
  const queryClient = useQueryClient();
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  const mutation = useMutation({
    mutationFn: ({
      subject,
      htmlContent,
      contactIds,
    }: {
      subject: string;
      htmlContent: string;
      contactIds?: string[];
    }) => marketingApi.sendContactEmailCampaign(shopId as string, subject, htmlContent, contactIds),
    onSuccess: () => invalidateContactLists(queryClient, shopId),
    onError: (error: any) => {
      if (error?.code === "ECONNABORTED") {
        showWarning("Still sending — this can take a minute.");
        return;
      }
      show4xxError(showError, error, "Failed to send email blast.");
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      variables: { subject: string; htmlContent: string; contactIds?: string[] },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}

export function useSendTestEmailMutation() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const { showError, showSuccess } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: ({
      subject,
      htmlContent,
      testEmail,
    }: {
      subject: string;
      htmlContent: string;
      testEmail: string;
    }) => marketingApi.sendTestEmail(shopId as string, subject, htmlContent, testEmail),
    onSuccess: (res) => showSuccess(res.message || "Test email sent."),
    onError: (error: any) => show4xxError(showError, error, "Failed to send test email."),
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      variables: { subject: string; htmlContent: string; testEmail: string },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(variables, options));
    },
  };
}
