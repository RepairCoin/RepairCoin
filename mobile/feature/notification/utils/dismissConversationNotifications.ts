import * as Notifications from "expo-notifications";

type PushData = {
  type?: string;
  conversationId?: string;
};

/**
 * Dismiss any delivered OS notifications for a conversation's new messages.
 *
 * Called when the user opens / reads a thread so the notification tray doesn't
 * keep stale "new message" entries for a sender they've already caught up on.
 * New-message pushes carry data { type: 'new_message', conversationId } (see
 * backend PushNotificationDispatcher.sendNewMessageNotification), so we match
 * on that and dismiss every delivered notification for this conversation.
 */
export async function dismissConversationNotifications(
  conversationId: string
): Promise<void> {
  if (!conversationId) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();

    const toDismiss = presented.filter((n) => {
      const data = n.request.content.data as PushData;
      return (
        data?.type === "new_message" && data?.conversationId === conversationId
      );
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
