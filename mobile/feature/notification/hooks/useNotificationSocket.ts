import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { getWebSocketUrl } from "@/shared/utilities/wsUrl";
import { Notification } from "@/feature/notification/services/notification.interface";

// React Native port of the frontend's WebSocket notification client
// (frontend/src/hooks/useNotifications.ts). Same backend contract
// (backend/src/services/WebSocketManager.ts), with two platform adaptations:
//
//   1. Auth. The web client rides on httpOnly cookies that the browser attaches
//      to the WS upgrade request. React Native has no cookie jar and sends a
//      Bearer JWT instead, so we use the backend's message-based auth path:
//      after the socket opens we send { type: 'authenticate', payload: { token } }.
//      The backend replies with { type: 'authenticated' } on success.
//
//   2. Foreground detection. There is no document.visibilitychange in RN, so we
//      reconnect off AppState transitions to 'active' instead.
//
// We deliberately do NOT raise a local OS notification on an incoming message
// the way the web client does (new Notification(...)) — native push already
// delivers the OS banner (see usePushNotifications.ts). This socket only keeps
// the in-app list/badge live while the app is open.

type SocketMessageHandler = (type: string, payload: any) => void;

interface UseNotificationSocketOptions {
  enabled?: boolean;
  /** Fired for every `notification` broadcast — prepend to the in-app list. */
  onNotification?: (notification: Notification) => void;
  /** Catch-all for other server message types (subscription/shop/booking/etc). */
  onMessage?: SocketMessageHandler;
}

// Send a ping every 25s — beats most idle timeouts (typically 60-300s).
const HEARTBEAT_INTERVAL_MS = 25_000;
// Pong must arrive within 10s of a ping or we treat the socket as dead.
const PONG_TIMEOUT_MS = 10_000;
// Exponential backoff capped at 30s; 20 attempts ≈ 10 min of retry, which
// survives a backend deploy (60-90s) or a network blip.
const MAX_RECONNECT_ATTEMPTS = 20;

export function useNotificationSocket(options: UseNotificationSocketOptions = {}) {
  const { enabled = true, onNotification, onMessage } = options;

  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True when we closed the socket ourselves due to an auth failure — prevents
  // the onclose handler from reconnecting into the same rejection forever.
  const manuallyClosedRef = useRef(false);

  // Keep the latest callbacks in refs so the connect routine (and its long-lived
  // socket listeners) always call the current handlers without forcing a
  // reconnect every render.
  const onNotificationRef = useRef(onNotification);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const { isAuthenticated, isDemo } = useAuthStore();

  const clearTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    clearTimers();
    if (wsRef.current) {
      // Detach handlers before closing so the onclose reconnect path doesn't
      // fire for an intentional teardown (logout / unmount).
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearTimers]);

  const connect = useCallback(() => {
    if (!enabled || isDemo) return;

    // Read auth fresh from the store (not closure) so a reconnect after a token
    // refresh picks up the new JWT rather than re-sending an expired one.
    const { accessToken, isAuthenticated: authed } = useAuthStore.getState();
    if (!authed || !accessToken) return;

    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        manuallyClosedRef.current = false;

        // Cookie auth isn't available in RN — authenticate explicitly with the
        // Bearer JWT. Backend replies with { type: 'authenticated' }.
        try {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              payload: { token: useAuthStore.getState().accessToken },
            })
          );
        } catch {
          // Send failed → socket is already broken; onclose will reconnect.
        }

        // Heartbeat: each tick send a ping and arm a pong watchdog. A missing
        // pong force-closes the zombie socket, which routes through onclose →
        // reconnect.
        clearTimers();
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          try {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          } catch {
            return;
          }
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = setTimeout(() => {
            wsRef.current?.close();
          }, PONG_TIMEOUT_MS);
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case "connected":
              break;

            case "authenticated":
              setIsConnected(true);
              break;

            case "notification":
              onNotificationRef.current?.(message.payload as Notification);
              break;

            case "pong":
              if (pongTimeoutRef.current) {
                clearTimeout(pongTimeoutRef.current);
                pongTimeoutRef.current = null;
              }
              break;

            case "error": {
              const payload = message.payload || {};
              const errorMsg: string = payload.error || payload.message || "";
              // Treat empty/auth-shaped errors as fatal: stop reconnecting so we
              // don't hammer the server with the same expired/invalid token.
              const isAuthError =
                !errorMsg ||
                /expired|invalid|token|authentication/i.test(errorMsg);
              if (isAuthError) {
                manuallyClosedRef.current = true;
                reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
                wsRef.current?.close();
                wsRef.current = null;
              }
              break;
            }

            default:
              // Pass through everything else (subscription_status_changed,
              // shop_status_changed, message:new, manual_booking_payment_completed,
              // reschedule_*, …) for callers that care.
              onMessageRef.current?.(message.type, message.payload);
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      ws.onerror = () => {
        // Connection-refused etc. is non-fatal (e.g. WS server briefly down);
        // onclose drives the reconnect.
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearTimers();

        if (manuallyClosedRef.current) {
          manuallyClosedRef.current = false;
          return;
        }

        // Reconnect on any non-manual close (deploy restart, idle timeout,
        // network blip, OS backgrounding the socket).
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        }
      };
    } catch {
      setIsConnected(false);
    }
  }, [enabled, isDemo, clearTimers]);

  // Connect when authenticated; tear down on logout / disable.
  useEffect(() => {
    if (!enabled || isDemo) {
      disconnect();
      return;
    }
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [enabled, isDemo, isAuthenticated, connect, disconnect]);

  // RN equivalent of the web client's visibilitychange reconnect: when the app
  // returns to the foreground, the OS may have killed the socket while it was
  // backgrounded even though readyState still reads OPEN. Kick a reconnect if
  // we're not currently connected, and reset the attempt counter so a prior
  // "gave up" state doesn't permanently block recovery.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") return;
      if (!useAuthStore.getState().isAuthenticated) return;
      const rs = wsRef.current?.readyState;
      if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;
      reconnectAttemptsRef.current = 0;
      connect();
    });
    return () => sub.remove();
  }, [enabled, connect]);

  return { isConnected };
}
