import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { authApi } from "@/shared/services/auth.services";
import { useAuthStore } from "@/shared/store/auth.store";

const GLOBAL_TOAST_OPTIONS = {
  placement: "top" as const,
  duration: 4000,
  animationType: "slide-in" as const,
  style: { marginTop: 28 },
};

// Show a global toast for infrastructure-level errors (network/timeout/429/5xx)
// that the user can't resolve via form input. Sets error.__toastShown so
// caller onError handlers can skip re-toasting the same error.
function handleGlobalErrorToast(error: any): void {
  if (error?.__toastShown) return;

  const status = error?.response?.status;
  const isNetworkError =
    !error?.response &&
    (error?.code === "ERR_NETWORK" ||
      error?.message?.toLowerCase?.().includes("network"));
  const isTimeout =
    error?.code === "ECONNABORTED" ||
    error?.message?.toLowerCase?.().includes("timeout");

  let message: string | null = null;
  let type: "danger" | "warning" = "danger";

  if (isNetworkError) {
    message = "Unable to connect. Please check your internet and try again.";
  } else if (isTimeout) {
    message = "Request timed out. Please try again.";
  } else if (status === 429) {
    message = "Too many attempts. Please wait a few minutes and try again.";
    type = "warning";
  } else if (status >= 500 && status < 600) {
    message = "Server error. Please try again later.";
  }

  if (message) {
    try {
      Toast.show(message, { ...GLOBAL_TOAST_OPTIONS, type });
      error.__toastShown = true;
    } catch (e) {
      // Toast not ready (e.g. provider not mounted yet) — swallow
    }
  }
}

interface DecodedToken {
  exp: number;
  iat: number;
  address: string;
  role: string;
  shopId?: string;
}

class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];
  private isClearingAuth = false;

  constructor() {
    this.baseURL =
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

    console.log(
      "[ApiClient] EXPO_PUBLIC_API_URL:",
      process.env.EXPO_PUBLIC_API_URL,
    );
    console.log("[ApiClient] Using baseURL:", this.baseURL);

    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  // Check if token is expired or about to expire (within 5 minutes)
  private isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Date.now() / 1000;
      const expiresIn = decoded.exp - currentTime;

      // Consider token expired if it expires in less than 5 minutes
      if (expiresIn < 300) {
        console.log("[ApiClient] Token expired or expiring soon:", {
          expiresIn,
          expired: expiresIn <= 0,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("[ApiClient] Failed to decode token:", error);
      return true; // Treat invalid tokens as expired
    }
  }

  // Subscribe to token refresh
  private subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers with new token
  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  // Refresh the access token
  private async refreshToken(): Promise<string | null> {
    try {
      console.log("[ApiClient] Attempting to refresh token...");

      // Get stored refresh token from Zustand store
      const { refreshToken, setAccessToken, setRefreshToken } =
        useAuthStore.getState();
      if (!refreshToken) {
        console.log("[ApiClient] No refresh token found in store");
        return null;
      }

      console.log(
        "[ApiClient] Refresh token exists, length:",
        refreshToken.length,
      );

      // Call refresh endpoint
      const response = await authApi.getRefreshToken(refreshToken);

      console.log("[ApiClient] Refresh response:", {
        success: response?.success,
        hasData: !!response?.data,
        hasAccessToken: !!response?.data?.accessToken,
      });

      if (response.success) {
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens in Zustand store
        setAccessToken(accessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        console.log(
          "[ApiClient] Token refreshed successfully, new token length:",
          accessToken?.length,
        );
        return accessToken;
      }

      console.log(
        "[ApiClient] Token refresh failed - success was false:",
        JSON.stringify(response).substring(0, 200),
      );
      return null;
    } catch (error: any) {
      console.error("[ApiClient] Token refresh error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      // If refresh fails with 401, the refresh token itself is invalid
      if (error.response?.status === 401) {
        console.log(
          "[ApiClient] Refresh token is invalid/expired, clearing auth",
        );
        await this.clearAuthToken();
      }

      return null;
    }
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token and check expiry
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          // Get token from Zustand store
          let token = useAuthStore.getState().accessToken;

          if (token) {
            // Check if token is expired
            if (this.isTokenExpired(token)) {
              console.log("[ApiClient] Token expired for:", config.url);

              // If not already refreshing, start refresh
              if (!this.isRefreshing) {
                this.isRefreshing = true;

                const newToken = await this.refreshToken();

                if (newToken) {
                  token = newToken;
                  this.onTokenRefreshed(newToken);
                } else {
                  // Refresh failed, clear token
                  await this.clearAuthToken();
                  this.onTokenRefreshed("");
                }

                this.isRefreshing = false;
              } else {
                // Wait for refresh to complete
                console.log("[ApiClient] Waiting for token refresh...");
                token = await new Promise<string>((resolve) => {
                  this.subscribeTokenRefresh((newToken: string) => {
                    resolve(newToken);
                  });
                });
              }
            }

            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
              console.log(
                "[Axios Interceptor] Added token to request:",
                config.url,
              );
            }
          } else {
            console.log(
              "[Axios Interceptor] No token found for request:",
              config.url,
            );
          }
        } catch (error) {
          console.warn(
            "[Axios Interceptor] Failed to process auth token:",
            error,
          );
        }

        return config;
      },
      (error) => {
        console.error("[API Request Error]:", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor - Handle responses and errors
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        if (__DEV__) {
          console.error("[API Response Error]:", {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
            message: error.message,
          });
        }

        // Handle 401 Unauthorized - Try to refresh token and retry
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Don't log out on TOKEN_EXPIRED — just refresh silently
          const errorCode = error.response?.data?.code;
          if (errorCode === "TOKEN_EXPIRED" || errorCode === "INVALID_TOKEN") {
            console.log("[ApiClient] Token expired, refreshing...");
          }

          if (!this.isRefreshing) {
            this.isRefreshing = true;

            const newToken = await this.refreshToken();

            if (newToken) {
              this.onTokenRefreshed(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              this.isRefreshing = false;
              return this.instance(originalRequest);
            } else {
              // Refresh failed — the refresh token itself is dead. Always
              // clear auth and send the user to onboarding, regardless of
              // the specific error code.
              await this.clearAuthToken();
              this.onTokenRefreshed("");
              this.isRefreshing = false;
            }
          } else {
            // Wait for ongoing refresh
            return new Promise((resolve, reject) => {
              this.subscribeTokenRefresh((token: string) => {
                if (token) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.instance(originalRequest));
                } else {
                  // For silent endpoints, just reject without clearing auth
                  reject(error);
                }
              });
            });
          }
        }

        // Show a global toast for infrastructure-level errors
        // (network / timeout / 429 / 5xx). Sets error.__toastShown so
        // downstream onError handlers can skip duplicate toasts.
        handleGlobalErrorToast(error);

        return Promise.reject(error);
      },
    );
  }

  // GET request
  public async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  // POST request
  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  // PUT request
  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  // PATCH request
  public async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  // DELETE request
  public async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  // Set auth tokens
  public setAuthToken(accessToken: string): void {
    try {
      this.instance.defaults.headers.Authorization = `Bearer ${accessToken}`;
      console.log("[ApiClient] Auth token set");
    } catch (error) {
      console.error("Failed to set auth token:", error);
    }
  }

  // Strip the Authorization header so no further requests use a dead token.
  // Does NOT trigger logout or navigation — safe to call from within logout().
  public clearAuthHeader(): void {
    delete this.instance.defaults.headers.Authorization;
  }

  // Clear auth tokens and bring the user back to onboarding.
  // Called when the refresh token is invalid or token refresh fails so the
  // app doesn't get stuck on a dashboard with a dead session.
  public async clearAuthToken(): Promise<void> {
    // Always strip the header so in-flight requests do not send a dead token.
    delete this.instance.defaults.headers.Authorization;

    // The store's logout() also calls clearAuthToken(); guard against
    // re-entry so we don't loop between the two.
    if (this.isClearingAuth) {
      return;
    }
    this.isClearingAuth = true;

    try {
      const { logout, isAuthenticated } = useAuthStore.getState();

      // Run the store's logout pipeline (clears Zustand + SecureStore,
      // disconnects wallet, deactivates push tokens). Skip navigation here —
      // we'll do it after logout resolves so it happens once.
      await logout(false);

      // Only navigate if the user was actually authenticated; otherwise a
      // dropped public call shouldn't punt them to onboarding.
      if (isAuthenticated) {
        router.replace("/onboarding1");
      }
      console.log("[ApiClient] Auth fully cleared");
    } catch (error) {
      console.error("Failed to clear auth:", error);
    } finally {
      this.isClearingAuth = false;
    }
  }

  // Get current base URL
  public getBaseURL(): string {
    return this.baseURL;
  }

  // Update base URL (useful for switching environments)
  public setBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.instance.defaults.baseURL = newBaseURL;
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
