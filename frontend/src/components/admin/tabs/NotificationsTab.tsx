"use client";

import { GeneralNotificationSettings } from "@/components/notifications/GeneralNotificationSettings";

export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <GeneralNotificationSettings userType="admin" />
    </div>
  );
}

export default NotificationsTab;
