import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NotificationUiState {
  // The conversation currently open on screen (null when no chat is focused).
  // Read by the push notification handler to suppress the redundant OS banner
  // for a message you are already looking at.
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

export const useNotificationUiStore = create<NotificationUiState>()(
  devtools(
    (set) => ({
      activeConversationId: null,
      setActiveConversationId: (id: string | null) =>
        set(() => ({ activeConversationId: id }), false, "setActiveConversationId"),
    }),
    { name: "notification-ui-store" }
  )
);
