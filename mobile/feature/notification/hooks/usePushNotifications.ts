import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { usePaymentStore } from "@/feature/transaction/booking/store/payment.store";
import { notificationApi } from "@/feature/notification/services/notification.services";
import {
  PushNotificationState,
  NotificationData,
} from "@/shared/interfaces/notification.interface";

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

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isRegistering = useRef(false);
  const userTypeRef = useRef(userType);
  const lastHandledResponseId = useRef<string | null>(null);

  useEffect(() => {
    userTypeRef.current = userType;
  }, [userType]);

  const setupAndroidChannels = useCallback(async () => {
    if (Platform.OS !== "android") return;

    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCC00",
    });

    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Appointments",
      description: "Appointment reminders and confirmations",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#FFCC00",
    });

    await Notifications.setNotificationChannelAsync("rewards", {
      name: "Rewards",
      description: "RCN reward notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#FFCC00",
    });

    await Notifications.setNotificationChannelAsync("redemptions", {
      name: "Redemptions",
      description: "RCN redemption requests",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCC00",
    });
  }, []);

  const registerForPushNotifications = useCallback(async () => {
    if (isRegistering.current) {
      return null;
    }

    if (!Device.isDevice) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications require a physical device",
        isLoading: false,
      }));
      return null;
    }

    try {
      isRegistering.current = true;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

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
        return null;
      }

      await setupAndroidChannels();

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error("EAS project ID not found in app config");
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const expoPushToken = tokenResult.data;

      if (accessToken) {
        try {
          await notificationApi.registerPushToken({
            expoPushToken,
            deviceId: Constants.sessionId || undefined,
            deviceType: Platform.OS as "ios" | "android",
            deviceName: Device.deviceName || undefined,
            appVersion: Constants.expoConfig?.version,
          });

          setState({
            expoPushToken,
            isRegistered: true,
            isLoading: false,
            permissionStatus: "granted",
            error: null,
          });
        } catch (apiError: any) {
          console.error("[Push] Failed to register token with backend:", apiError);
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


  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      const data = notification.request.content.data as NotificationData;

      if (data?.type) {
      }
    },
    []
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content
        .data as NotificationData;

      const responseId = response.notification.request.identifier;
      if (lastHandledResponseId.current === responseId) {
        return;
      }
      lastHandledResponseId.current = responseId;

      if (AppState.currentState !== "active") {
        return;
      }

      if (usePaymentStore.getState().activeSession) {
        return;
      }

      const currentUserType = userTypeRef.current;

      if (!currentUserType) {
        return;
      }

      const isShop = currentUserType === "shop";
      const notificationType = data?.type;

      let route: string | null = null;

      switch (notificationType) {
        case "reward_issued":
        case "token_gifted":
          route = isShop
            ? "/(dashboard)/shop/tabs/history"
            : "/(dashboard)/customer/tabs/history";
          break;
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
        case "reschedule_request_created":
        case "reschedule_request_approved":
        case "reschedule_request_rejected":
          route = isShop
            ? "/(dashboard)/shop/booking"
            : "/(dashboard)/customer/tabs/service/";
          break;
        case "subscription_expiring":
        case "subscription_expired":
        case "subscription_renewed":
          route = isShop
            ? "/(dashboard)/shop/subscription"
            : "/(dashboard)/customer/notification";
          break;
        default:
          route = isShop
            ? "/(dashboard)/shop/notification"
            : "/(dashboard)/customer/notification";
      }

      if (route) {
        router.push(route as any);
      }
    },
    []
  );

  const unregisterPushNotifications = useCallback(async () => {
    if (!state.expoPushToken) return;

    try {
      await notificationApi.deactivatePushToken(state.expoPushToken);
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

  const unregisterAllPushNotifications = useCallback(async () => {
    try {
      await notificationApi.deactivateAllPushTokens();
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

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      registerForPushNotifications();
    } else {
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isLoading: false,
      }));
    }
  }, [isAuthenticated, accessToken, registerForPushNotifications]);

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener(handleNotificationReceived);

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(async (newToken) => {
      if (isRegistering.current) {
        return;
      }

      if (accessToken) {
        isRegistering.current = true;
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (!projectId) {
            console.error("[Push] No project ID for token refresh");
            isRegistering.current = false;
            return;
          }

          const tokenResult = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          const expoPushToken = tokenResult.data;

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
