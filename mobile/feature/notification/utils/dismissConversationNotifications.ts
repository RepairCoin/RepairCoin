import * as Notifications from "expo-notifications";

type PushData = {
  type?: string;
  conversationId?: string;
  // Backend stamps `new_message:<conversationId>` (PushNotificationDispatcher).
  tag?: string;
  // Android system extras present on FOREIGN notifications (ones FCM displayed
  // itself while the app was backgrounded/killed). For those, our custom data
  // payload is NOT exposed — only these Android keys are. The title equals the
  // sender's display name, which is our only per-conversation signal there.
  "android.title"?: string;
};

type DismissOptions = {
  // Sender display name = the conversation's other party. Used to match foreign
  // FCM notifications by their `android.title`, since they carry no conversationId.
  titleMatch?: string;
};

/**
 * Dismiss delivered OS notifications for a conversation's new messages.
 *
 * Two delivery shapes have to be handled:
 *  1. Expo-managed (received while the app was foregrounded): carries our data
 *     { type: 'new_message', conversationId, tag } — matched precisely.
 *  2. Foreign FCM (displayed by the system while backgrounded/killed): exposes
 *     NO custom data, only Android extras. We fall back to matching the title
 *     against the sender's name (titleMatch). Caveat: if two conversations have
 *     the same sender display name, both clear — acceptable for "I just read
 *     this sender's thread".
 */
export async function dismissConversationNotifications(
  conversationId: string,
  options?: DismissOptions
): Promise<void> {
  if (!conversationId) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();

    const toDismiss = presented.filter((n) => {
      const data = n.request.content.data as PushData;

      // 1. Expo-managed notification carrying our payload.
      if (data?.type === "new_message") {
        const matchesId =
          String(data?.conversationId ?? "") === String(conversationId);
        const matchesTag = data?.tag === `new_message:${conversationId}`;
        if (matchesId || matchesTag) return true;
      }

      // 2. Foreign FCM notification — match the sender name via android.title.
      const title = data?.["android.title"];
      if (options?.titleMatch && title && String(title) === options.titleMatch) {
        return true;
      }

      return false;
    });

    await Promise.all(
      toDismiss.map((n) =>
        Notifications.dismissNotificationAsync(n.request.identifier)
      )
    );
  } catch (error) {
    // Non-fatal — the tray just keeps the stale entry until the OS clears it.
    console.error("Failed to dismiss conversation notifications:", error);
  }
}
