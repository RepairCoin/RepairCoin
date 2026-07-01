import { Notification } from "../types";

/**
 * V2 tab category for a notification type.
 * - "ai": conversational / support / AI-assistant messages
 * - "updates": everything else (transactional + system updates)
 */
export function getNotificationCategory(type: string): "ai" | "updates" {
  const aiTypes = new Set([
    "new_message",
    "support_message_received",
    "support_ticket_created",
    "support_ticket_updated",
    "ai_assistant",
  ]);
  return aiTypes.has(type) ? "ai" : "updates";
}

export interface NotificationSection {
  title: string;
  data: Notification[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Group notifications into Today / Yesterday / dated sections (newest first),
 * matching the V2 Notifications screen. Assumes the input is already sorted
 * newest-first; ordering within a bucket is preserved.
 */
export function groupNotificationsByDate(
  items: Notification[]
): NotificationSection[] {
  const today = startOfDay(new Date());
  const oneDay = 24 * 60 * 60 * 1000;
  const yesterday = today - oneDay;

  const sections: NotificationSection[] = [];
  const indexByTitle = new Map<string, number>();

  for (const item of items) {
    const created = startOfDay(new Date(item.createdAt));
    let title: string;
    if (created === today) {
      title = "Today";
    } else if (created === yesterday) {
      title = "Yesterday";
    } else {
      title = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    const existing = indexByTitle.get(title);
    if (existing != null) {
      sections[existing].data.push(item);
    } else {
      indexByTitle.set(title, sections.length);
      sections.push({ title, data: [item] });
    }
  }

  return sections;
}
