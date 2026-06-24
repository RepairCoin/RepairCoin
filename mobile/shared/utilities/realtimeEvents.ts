import { DeviceEventEmitter } from "react-native";
import { Notification } from "@/feature/notification/services/notification.interface";

// In-app event bus for realtime WebSocket traffic. The single socket lives in
// RealtimeProvider; it re-broadcasts every server message through here so any
// number of components can subscribe without each opening its own connection.
//
// This is the React Native equivalent of the web client's window CustomEvents
// (frontend dispatches 'new-message-received', 'notification', etc. from one
// socket in DashboardLayout — see frontend/src/hooks/useNotifications.ts).

const NOTIFICATION_EVENT = "realtime:notification";
const TYPE_PREFIX = "realtime:";

export const realtimeEvents = {
  /** Emitted for every `notification` broadcast. */
  emitNotification(notification: Notification): void {
    DeviceEventEmitter.emit(NOTIFICATION_EVENT, notification);
  },

  /** Subscribe to incoming notifications. Returns an unsubscribe function. */
  onNotification(callback: (notification: Notification) => void): () => void {
    const sub = DeviceEventEmitter.addListener(NOTIFICATION_EVENT, callback);
    return () => sub.remove();
  },

  /** Emitted for every non-notification message type (e.g. `message:new`). */
  emitType(type: string, payload: any): void {
    DeviceEventEmitter.emit(TYPE_PREFIX + type, payload);
  },

  /**
   * Subscribe to a specific server message type (e.g. "message:new",
   * "shop_status_changed"). Returns an unsubscribe function.
   */
  on(type: string, callback: (payload: any) => void): () => void {
    const sub = DeviceEventEmitter.addListener(TYPE_PREFIX + type, callback);
    return () => sub.remove();
  },
};
