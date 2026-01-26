import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import { notificationApi } from "@/shared/services/notification.services";
import {
  PushNotificationState,
  NotificationData,
} from "@/shared/interfaces/notification.interface";

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    isRegistered: false,
    isLoading: true,
    permissionStatus: "undetermined",
    error: null,
  });

  const { isAuthenticated, accessToken, userType } = useAuthStore();

  // Refs for notification listeners
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isRegistering = useRef(false);

  /**
   * Setup Android notification channels
   */
  const setupAndroidChannels = useCallback(async () => {
    if (Platform.OS !== "android") return;

    // Default channel
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCC00",
    });

    // Appointments channel
    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Appointments",
      description: "Appointment reminders and confirmations",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#FFCC00",
    });

    // Rewards channel
    await Notifications.setNotificationChannelAsync("rewards", {
      name: "Rewards",
      description: "RCN reward notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#FFCC00",
    });

    // Redemptions channel
    await Notifications.setNotificationChannelAsync("redemptions", {
      name: "Redemptions",
      description: "RCN redemption requests",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCC00",
    });

    console.log("[Push] Android notification channels created");
  }, []);

  /**
   * Register for push notifications
   */
  const registerForPushNotifications = useCallback(async () => {
    // Prevent concurrent registrations
    if (isRegistering.current) {
      console.log("[Push] Registration already in progress, skipping");
      return null;
    }

    // Only works on physical devices
    if (!Device.isDevice) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications require a physical device",
        isLoading: false,
      }));
      console.log("[Push] Not a physical device, skipping registration");
      return null;
    }

    try {
      isRegistering.current = true;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check existing permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Update permission status
      setState((prev) => ({
        ...prev,
        permissionStatus: finalStatus as PushNotificationState["permissionStatus"],
      }));

      if (finalStatus !== "granted") {
        setState((prev) => ({
          ...prev,
          error: "Push notification permission denied",
          isLoading: false,
        }));
        console.log("[Push] Permission denied");
        return null;
      }

      // Setup Android channels
      await setupAndroidChannels();

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error("EAS project ID not found in app config");
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const expoPushToken = tokenResult.data;

      console.log("[Push] Got Expo push token:", expoPushToken);

      // Register token with backend
      if (accessToken) {
        try {
          await notificationApi.registerPushToken({
            expoPushToken,
            deviceId: Constants.sessionId || undefined,
            deviceType: Platform.OS as "ios" | "android",
            deviceName: Device.deviceName || undefined,
            appVersion: Constants.expoConfig?.version,
          });

          console.log("[Push] Token registered with backend");

          setState({
            expoPushToken,
            isRegistered: true,
            isLoading: false,
            permissionStatus: "granted",
            error: null,
          });
        } catch (apiError: any) {
          console.error("[Push] Failed to register token with backend:", apiError);
          // Still save the token locally even if backend registration fails
          setState({
            expoPushToken,
            isRegistered: false,
            isLoading: false,
            permissionStatus: "granted",
            error: "Failed to register with server",
          });
        }
      } else {
        setState({
          expoPushToken,
          isRegistered: false,
          isLoading: false,
          permissionStatus: "granted",
          error: null,
        });
      }

      return expoPushToken;
    } catch (error: any) {
      console.error("[Push] Registration error:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to register for push notifications",
        isLoading: false,
      }));
      return null;
    } finally {
      isRegistering.current = false;
    }
  }, [accessToken, setupAndroidChannels]);

  /**
   * Handle incoming notification (when app is foregrounded)
   */
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      console.log("[Push] Notification received:", notification);
      const data = notification.request.content.data as NotificationData;

      // You can emit events or update state here based on notification type
      // For example, refresh data or show in-app alerts
      if (data?.type) {
        console.log("[Push] Notification type:", data.type);
      }
    },
    []
  );

  /**
   * Handle notification tap (user interacted with notification)
   */
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      console.log("[Push] Notification tapped:", response);
      const data = response.notification.request.content
        .data as NotificationData;

      const isShop = userType === "shop";
      const notificationType = data?.type;

      // Get route based on notification type and user type
      let route: string | null = null;

      switch (notificationType) {
        // Reward notifications → History tab
        case "reward_issued":
        case "token_gifted":
          route = isShop
            ? "/(dashboard)/shop/tabs/history"
            : "/(dashboard)/customer/tabs/history";
          break;

        // Redemption notifications
        case "redemption_approval_requested":
        case "redemption_approval_request":
          route = isShop
            ? "/(dashboard)/shop/redeem-token"
            : "/(dashboard)/customer/redeem";
          break;

        case "redemption_approved":
        case "redemption_rejected":
          route = isShop
            ? "/(dashboard)/shop/tabs/history"
            : "/(dashboard)/customer/tabs/history";
          break;

        // Appointment/Booking notifications → Service/Bookings tab
        case "booking_confirmed":
        case "appointment_reminder":
        case "upcoming_appointment":
        case "service_order_completed":
        case "order_completed":
        case "service_booking_received":
        case "new_booking":
          route = isShop
            ? "/(dashboard)/shop/booking"
            : "/(dashboard)/customer/tabs/service/";
          break;

        // Reschedule notifications → Bookings
        case "reschedule_request_created":
        case "reschedule_request_approved":
        case "reschedule_request_rejected":
          route = isShop
            ? "/(dashboard)/shop/booking"
            : "/(dashboard)/customer/tabs/service/";
          break;

        // Subscription notifications → Subscription screen (shop only)
        case "subscription_expiring":
        case "subscription_expired":
        case "subscription_renewed":
          route = isShop
            ? "/(dashboard)/shop/subscription"
            : "/(dashboard)/customer/notification";
          break;

        default:
          // Default: Navigate to notification screen
          route = isShop
            ? "/(dashboard)/shop/notification"
            : "/(dashboard)/customer/notification";
      }

      if (route) {
        router.push(route as any);
      }
    },
    [userType]
  );

  /**
   * Unregister push notifications (on logout)
   */
  const unregisterPushNotifications = useCallback(async () => {
    if (!state.expoPushToken) return;

    try {
      await notificationApi.deactivatePushToken(state.expoPushToken);
      console.log("[Push] Token deactivated");
    } catch (error) {
      console.error("[Push] Failed to deactivate token:", error);
    }

    setState({
      expoPushToken: null,
      isRegistered: false,
      isLoading: false,
      permissionStatus: state.permissionStatus,
      error: null,
    });
  }, [state.expoPushToken, state.permissionStatus]);

  /**
   * Unregister all push tokens (logout from all devices)
   */
  const unregisterAllPushNotifications = useCallback(async () => {
    try {
      await notificationApi.deactivateAllPushTokens();
      console.log("[Push] All tokens deactivated");
    } catch (error) {
      console.error("[Push] Failed to deactivate all tokens:", error);
    }

    setState({
      expoPushToken: null,
      isRegistered: false,
      isLoading: false,
      permissionStatus: state.permissionStatus,
      error: null,
    });
  }, [state.permissionStatus]);

  // Effect: Register when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      registerForPushNotifications();
    } else {
      // Reset state when logged out
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isLoading: false,
      }));
    }
  }, [isAuthenticated, accessToken, registerForPushNotifications]);

  // Effect: Setup notification listeners
  useEffect(() => {
    // Listen for incoming notifications (foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener(handleNotificationReceived);

    // Listen for notification taps
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Effect: Handle token refresh
  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(async (newToken) => {
      console.log("[Push] Native token refreshed:", newToken.data);

      // Skip if registration is already in progress
      if (isRegistering.current) {
        console.log("[Push] Skipping refresh - registration in progress");
        return;
      }

      // The listener provides native FCM/APNs token, not Expo push token
      // We need to get the Expo push token again
      if (accessToken) {
        isRegistering.current = true;
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (!projectId) {
            console.error("[Push] No project ID for token refresh");
            isRegistering.current = false;
            return;
          }

          // Get the updated Expo push token
          const tokenResult = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          const expoPushToken = tokenResult.data;

          console.log("[Push] Got refreshed Expo push token:", expoPushToken);

          // Only re-register if it's different from what we have
          if (expoPushToken !== state.expoPushToken) {
            await notificationApi.registerPushToken({
              expoPushToken,
              deviceId: Constants.sessionId || undefined,
              deviceType: Platform.OS as "ios" | "android",
              deviceName: Device.deviceName || undefined,
              appVersion: Constants.expoConfig?.version,
            });

            setState((prev) => ({
              ...prev,
              expoPushToken,
              isRegistered: true,
            }));

            console.log("[Push] Refreshed token registered");
          }
        } catch (error) {
          console.error("[Push] Failed to register refreshed token:", error);
        } finally {
          isRegistering.current = false;
        }
      }
    });

    return () => subscription.remove();
  }, [state.expoPushToken, accessToken]);

  return {
    ...state,
    registerForPushNotifications,
    unregisterPushNotifications,
    unregisterAllPushNotifications,
  };
}
