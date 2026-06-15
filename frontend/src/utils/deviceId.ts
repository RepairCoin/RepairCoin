/**
 * Stable per-browser-context device id.
 *
 * Persisted in localStorage and sent as the `X-Device-Id` header so the backend
 * can keep "one active session per device" without confusing two contexts that
 * share a user_agent. Incognito has isolated storage, so it generates its own id
 * and is correctly treated as a separate device — logging into incognito won't
 * revoke the normal-window session, and vice versa.
 */
const DEVICE_ID_KEY = "repaircoin_device_id";

const generateId = (): string => {
  // crypto.randomUUID is available in all supported browsers; fall back just in
  // case it's unavailable (e.g. insecure context).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

export const getDeviceId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = generateId();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage can throw (private mode quotas, disabled storage). Without a
    // stable id the backend simply falls back to user_agent matching.
    return null;
  }
};
