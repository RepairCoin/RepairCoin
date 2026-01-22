// Re-export types from interfaces
export type { Notification } from "@/interfaces/notification.interface";

export type TabType = "unread" | "all";

export type NotificationStyle = {
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
};
