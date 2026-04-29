/**
 * Pick the API base URL based on the frontend's current hostname.
 *
 * This is symmetric with backend/src/utils/cookies.ts#getCookieDomain — the
 * frontend self-routes to whichever API host shares the parent domain so the
 * auth cookie is first-party (Set-Cookie can succeed and the browser will
 * send it back without third-party-cookie blocking).
 *
 * Mapping (order matters — staging hosts must match before prod suffixes):
 *
 *   staging.repaircoin.ai  -> https://api-staging.repaircoin.ai/api
 *   staging.fixflow.ai     -> https://api-staging.fixflow.ai/api
 *   fixflow.ai / *.fixflow.ai     -> https://api.fixflow.ai/api
 *   repaircoin.ai / *.repaircoin.ai -> https://api.repaircoin.ai/api
 *   anything else (incl. SSR, localhost, Vercel previews) -> NEXT_PUBLIC_API_URL or localhost
 *
 * SSR note: window is undefined during server rendering, so SSR falls back
 * to the build-time env var. Most data fetching in this app is client-side
 * via this helper, so SSR exposure is minimal.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  }
  const host = window.location.hostname.toLowerCase();

  // Staging hosts must come before prod patterns since they share parent suffix
  if (host === "staging.repaircoin.ai") {
    return "https://api-staging.repaircoin.ai/api";
  }
  if (host === "staging.fixflow.ai") {
    return "https://api-staging.fixflow.ai/api";
  }

  // Production hosts (and migrate-test canary which intentionally hits prod)
  if (host === "fixflow.ai" || host.endsWith(".fixflow.ai")) {
    return "https://api.fixflow.ai/api";
  }
  if (host === "repaircoin.ai" || host.endsWith(".repaircoin.ai")) {
    return "https://api.repaircoin.ai/api";
  }

  // Local dev, Vercel previews, anything else
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
};

/**
 * WebSocket equivalent of getApiBaseUrl. Returns the wss:// (or ws:// in dev)
 * URL pointing at the same backend that the API base URL targets, so socket
 * connections respect the same domain isolation rules as XHR auth.
 *
 * Resolution order:
 *   1. Explicit NEXT_PUBLIC_WS_URL env var (for setups where WS host differs)
 *   2. Otherwise derive from getApiBaseUrl() with the protocol swapped (http→ws)
 *
 * The result has any trailing /api path stripped — WebSocket clients typically
 * connect to the host root, not the API path.
 */
export const getWebSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  const apiUrl =
    typeof window === "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api")
      : getApiBaseUrl();
  // Swap protocol and strip trailing /api
  return apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
};
