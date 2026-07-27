/**
 * Turns an API/axios error into a message that is safe to show a user.
 *
 * Axios's own `error.message` is the raw "Request failed with status code 403",
 * which tells the user nothing about WHY they were blocked. The backend already
 * sends the real reason in the response body ({ success, error, code, message }),
 * so always prefer that and never fall through to the axios string.
 */

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

/** Axios strings that must never reach a toast. */
const RAW_AXIOS_MESSAGE = /^request failed with status code \d+$/i;

const STATUS_FALLBACKS: Record<number, string> = {
  400: "That request wasn't valid. Please check the details and try again.",
  401: "Your session expired. Please log in again.",
  403: "You don't have permission to do this.",
  404: "We couldn't find what you were looking for.",
  408: "Request timed out. Please try again.",
  409: "This conflicts with the current state. Please refresh and try again.",
  422: "Some of the information provided isn't valid.",
  429: "Too many attempts. Please wait a few minutes and try again.",
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/** Backend error code (e.g. "SUBSCRIPTION_PAUSED"), when the API sends one. */
export function getApiErrorCode(error: any): string | null {
  return firstString(error?.response?.data?.code);
}

export function getApiErrorStatus(error: any): number | null {
  const status = error?.response?.status ?? error?.status;
  return typeof status === "number" ? status : null;
}

export function isNetworkError(error: any): boolean {
  if (error?.response) return false;
  return (
    error?.code === "ERR_NETWORK" ||
    !!error?.message?.toLowerCase?.().includes("network")
  );
}

export function isTimeoutError(error: any): boolean {
  return (
    error?.code === "ECONNABORTED" ||
    !!error?.message?.toLowerCase?.().includes("timeout")
  );
}

/**
 * Extracts the most specific user-facing message available, in order:
 * response body -> status fallback -> non-axios Error message -> fallback.
 */
export function getApiErrorMessage(
  error: any,
  fallback: string = GENERIC_FALLBACK,
): string {
  if (!error) return fallback;

  const data = error?.response?.data;

  const fromBody = firstString(
    typeof data === "string" ? data : null,
    data?.error,
    data?.message,
    data?.details?.message,
    Array.isArray(data?.errors) ? data.errors[0]?.message ?? data.errors[0] : null,
  );
  if (fromBody) return fromBody;

  if (isTimeoutError(error)) return "Request timed out. Please try again.";
  if (isNetworkError(error)) {
    return "Unable to connect. Please check your internet and try again.";
  }

  const status = getApiErrorStatus(error);
  if (status) {
    if (STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
    if (status >= 500) return "Server error. Please try again later.";
  }

  // Locally thrown errors (validation, guards) carry real messages worth showing;
  // axios's generic status string does not.
  const message = firstString(error?.message);
  if (message && !RAW_AXIOS_MESSAGE.test(message)) return message;

  return fallback;
}
