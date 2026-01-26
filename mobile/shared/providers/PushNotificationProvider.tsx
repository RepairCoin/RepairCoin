import React, { createContext, useContext, ReactNode } from "react";
import {
  usePushNotifications,
} from "@/shared/hooks/notification/usePushNotifications";
import { PushNotificationState } from "@/shared/interfaces/notification.interface";

interface PushNotificationContextType extends PushNotificationState {
  registerForPushNotifications: () => Promise<string | null>;
  unregisterPushNotifications: () => Promise<void>;
  unregisterAllPushNotifications: () => Promise<void>;
}

const PushNotificationContext = createContext<
  PushNotificationContextType | undefined
>(undefined);

interface PushNotificationProviderProps {
  children: ReactNode;
}

export function PushNotificationProvider({
  children,
}: PushNotificationProviderProps) {
  const pushNotifications = usePushNotifications();

  return (
    <PushNotificationContext.Provider value={pushNotifications}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotificationContext(): PushNotificationContextType {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error(
      "usePushNotificationContext must be used within PushNotificationProvider"
    );
  }
  return context;
}
