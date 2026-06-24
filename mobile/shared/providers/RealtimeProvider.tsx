import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { useNotificationSocket } from "@/feature/notification/hooks/useNotificationSocket";
import { realtimeEvents } from "@/shared/utilities/realtimeEvents";
import { Notification } from "@/feature/notification/services/notification.interface";

// Owns the app's single notification WebSocket. Mounted once at the root so the
// connection stays alive across screens; every incoming message is re-broadcast
// through realtimeEvents for components to subscribe to (notification list,
// message badge, …). Mirrors the web client's "one socket in DashboardLayout +
// global events" model — adapted for React Native.

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const handleNotification = useCallback((notification: Notification) => {
    realtimeEvents.emitNotification(notification);
  }, []);

  const handleMessage = useCallback((type: string, payload: any) => {
    realtimeEvents.emitType(type, payload);
  }, []);

  const { isConnected } = useNotificationSocket({
    onNotification: handleNotification,
    onMessage: handleMessage,
  });

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextType {
  return useContext(RealtimeContext);
}
