import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { authApi } from "@/feature/auth/services/auth.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";

interface DecodedToken {
  exp: number;
  iat: number;
  address: string;
  role: string;
  shopId?: string;
}

const GLOBAL_TOAST_OPTIONS = {
  placement: "top" as const,
  duration: 4000,
  animationType: "slide-in" as const,
  style: { marginTop: 28 },
};

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
      console.error("Toast show failed:", e);
    }
  }
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

    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Date.now() / 1000;
      const expiresIn = decoded.exp - currentTime;
      return expiresIn < 300;
    } catch (error) {
      console.error("[ApiClient] Failed to decode token:", error);
      return true;
    }
  }

  private subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const { refreshToken, setAccessToken, setRefreshToken } =
        useAuthStore.getState();
      if (!refreshToken) return null;

      const response = await authApi.getRefreshToken(refreshToken);

      if (response?.data?.success) {
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        setAccessToken(accessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        return accessToken;
      }

      return null;
    } catch (error: any) {
      console.error("[ApiClient] Token refresh error:", error.message);

      if (error.response?.status === 401) {
        await this.clearAuthToken();
      }

      return null;
    }
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          let token = useAuthStore.getState().accessToken;

          if (token) {
            if (this.isTokenExpired(token)) {
              if (!this.isRefreshing) {
                this.isRefreshing = true;

                const newToken = await this.refreshToken();

                if (newToken) {
                  token = newToken;
                  this.onTokenRefreshed(newToken);
                } else {
                  await this.clearAuthToken();
                  this.onTokenRefreshed("");
                }

                this.isRefreshing = false;
              } else {
                token = await new Promise<string>((resolve) => {
                  this.subscribeTokenRefresh((newToken: string) => {
                    resolve(newToken);
                  });
                });
              }
            }

            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          }
        } catch (error) {
          console.warn("[ApiClient] Failed to process auth token:", error);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config;

        if (__DEV__) {
          console.error("[API Error]:", {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
          });
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!this.isRefreshing) {
            this.isRefreshing = true;

            const newToken = await this.refreshToken();

            if (newToken) {
              this.onTokenRefreshed(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              this.isRefreshing = false;
              return this.instance(originalRequest);
            } else {
              await this.clearAuthToken();
              this.onTokenRefreshed("");
              this.isRefreshing = false;
            }
          } else {
            return new Promise((resolve, reject) => {
              this.subscribeTokenRefresh((token: string) => {
                if (token) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.instance(originalRequest));
                } else {
                  reject(error);
                }
              });
            });
          }
        }

        handleGlobalErrorToast(error);

        return Promise.reject(error);
      },
    );
  }

  public async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  public async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  public async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  public setAuthToken(accessToken: string): void {
    try {
      this.instance.defaults.headers.Authorization = `Bearer ${accessToken}`;
    } catch (error) {
      console.error("Failed to set auth token:", error);
    }
  }

  public clearAuthHeader(): void {
    delete this.instance.defaults.headers.Authorization;
  }

  public async clearAuthToken(): Promise<void> {
    delete this.instance.defaults.headers.Authorization;

    if (this.isClearingAuth) {
      return;
    }
    this.isClearingAuth = true;

    try {
      const { resetState, isAuthenticated } = useAuthStore.getState();

      resetState();

      if (isAuthenticated) {
        router.replace("/(auth)/connect");
      }
    } catch (error) {
      console.error("Failed to clear auth:", error);
    } finally {
      this.isClearingAuth = false;
    }
  }

  public getBaseURL(): string {
    return this.baseURL;
  }

  public setBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.instance.defaults.baseURL = newBaseURL;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
