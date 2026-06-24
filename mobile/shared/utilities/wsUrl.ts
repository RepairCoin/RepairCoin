/**
 * WebSocket equivalent of the API base URL. Returns the ws:// (or wss:// in
 * prod) URL pointing at the same backend that EXPO_PUBLIC_API_URL targets, so
 * realtime notification sockets hit the same host as XHR.
 *
 * Mirrors frontend/src/utils/apiUrl.ts#getWebSocketUrl, adapted for Expo env
 * vars (the mobile app has no window.location to self-route from).
 *
 * Resolution order:
 *   1. Explicit EXPO_PUBLIC_WS_URL (for setups where the WS host differs).
 *   2. Otherwise derive from EXPO_PUBLIC_API_URL with the protocol swapped
 *      (http -> ws) and any trailing /api stripped — the WS server listens at
 *      the host root, not under the API path.
 */
export const getWebSocketUrl = (): string => {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
  return apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
};
