import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { usePaymentStore } from "@/feature/services/payment/store/payment.store";
import { useNotificationUiStore } from "@/shared/store/notification-ui.store";
import { notificationApi } from "@/feature/notification/services/notification.services";
import {
  PushNotificationState,
  NotificationData,
} from "@/feature/notification/services/notification.interface";

// Persists the user's explicit "Turn off notifications" choice so the app does
// NOT silently re-register the push token on the next launch / re-login.
//
// Scoped PER WALLET. AsyncStorage is device-global, so a single shared key let
// one account's "off" choice suppress registration for the NEXT account that
// logs in on the same device — leaving the previous user's token active and
// still receiving pushes. Keying by wallet keeps each account's choice isolated.
const PUSH_DISABLED_PREFIX = "push_notifications_disabled";

function pushDisabledKey(address?: string | null): string {
  return address
    ? `${PUSH_DISABLED_PREFIX}:${address.toLowerCase()}`
    : PUSH_DISABLED_PREFIX;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as NotificationData;
    const isForeground = AppState.currentState === "active";
    const activeConversationId =
      useNotificationUiStore.getState().activeConversationId;

    // If we're already inside the exact conversation this message belongs to,
    // the chat screen polls and renders it live — so suppress the redundant OS
    // banner/sound. Pushes for other conversations (or any other type, or while
    // backgrounded) still show normally.
    const viewingThisConversation =
      isForeground &&
      data?.type === "new_message" &&
      !!data?.conversationId &&
      data.conversationId === activeConversationId;

    if (viewingThisConversation) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    isRegistered: false,
    isLoading: true,
    permissionStatus: "undetermined",
    error: null,
  });

  const { isAuthenticated, accessToken, userType, isDemo, account, userProfile } =
    useAuthStore();

  const walletAddress: string | null =
    userProfile?.walletAddress || userProfile?.address || account?.address || null;

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isRegistering = useRef(false);
  const userTypeRef = useRef(userType);
  const walletAddressRef = useRef(walletAddress);
  const lastHandledResponseId = useRef<string | null>(null);
  // Holds a tap whose deep link couldn't be resolved yet because auth state
  // (userType) hadn't hydrated — typical when a tap cold-starts a killed app.
  // Replayed once userType is available so the redirect isn't lost.
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    userTypeRef.current = userType;
  }, [userType]);

  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

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

          // Successfully registered → clear any prior "turned off" choice.
          await AsyncStorage.removeItem(pushDisabledKey(walletAddressRef.current));

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

      // NOTE: do not gate on AppState here. Tapping a native notification while
      // the app is backgrounded or killed fires this listener during the
      // foreground transition, when currentState is still "background"/
      // "inactive" — gating on "active" silently dropped the redirect.

      // Don't redirect away from an in-progress payment flow.
      if (usePaymentStore.getState().activeSession) {
        lastHandledResponseId.current = responseId;
        return;
      }

      const currentUserType = userTypeRef.current;

      if (!currentUserType) {
        // Auth hasn't hydrated yet (cold start from a killed app). Stash the
        // tap and replay it once userType is available instead of dropping the
        // deep link. Don't mark it handled yet, or the replay would dedupe out.
        pendingResponseRef.current = response;
        return;
      }

      lastHandledResponseId.current = responseId;
      pendingResponseRef.current = null;

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
        case "new_booking":
        case "service_booking_received": {
          // Open the specific booking. New-booking notifications target the shop
          // and carry orderId; fall back to the bookings list if it's missing.
          const orderId = data?.orderId as string | undefined;
          const base = isShop
            ? "/(dashboard)/shop/booking"
            : "/(dashboard)/customer/booking";
          route = orderId ? `${base}/${orderId}` : base;
          break;
        }
        case "booking_confirmed":
        case "appointment_reminder":
        case "upcoming_appointment":
        case "service_order_completed":
        case "order_completed":
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
        case "new_message": {
          // Open the conversation directly. Fall back to the messages list if
          // the payload is missing the conversationId for any reason.
          const conversationId = data?.conversationId as string | undefined;
          const base = isShop
            ? "/(dashboard)/shop/messages"
            : "/(dashboard)/customer/messages";
          route = conversationId ? `${base}/${conversationId}` : base;
          break;
        }
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
    // Remember the user's choice first, so it persists even if the backend call
    // fails — otherwise the next launch / re-login would silently re-register
    // and turn notifications back on. Scoped to this wallet so it does not
    // suppress a different account that later logs in on the same device.
    await AsyncStorage.setItem(pushDisabledKey(walletAddressRef.current), "true");

    // Deactivate ALL of this user's tokens (by wallet), not just the one in
    // local state. The current token may have rotated or be missing from state,
    // and the backend keeps sending to any token still marked is_active = true —
    // so deactivating only the in-memory token can leave a live one behind.
    try {
      await notificationApi.deactivateAllPushTokens();
    } catch (error) {
      console.error("[Push] Failed to deactivate tokens:", error);
    }

    setState({
      expoPushToken: null,
      isRegistered: false,
      isLoading: false,
      permissionStatus: state.permissionStatus,
      error: null,
    });
  }, [state.permissionStatus]);

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
    if (isDemo) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }
    if (isAuthenticated && accessToken) {
      (async () => {
        // Respect an explicit "Turn off notifications" choice — do not
        // auto-register on launch / re-login if THIS wallet disabled push.
        const disabled = await AsyncStorage.getItem(pushDisabledKey(walletAddress));
        if (disabled === "true") {
          setState((prev) => ({
            ...prev,
            isRegistered: false,
            isLoading: false,
          }));
          return;
        }
        registerForPushNotifications();
      })();
    } else {
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isLoading: false,
      }));
    }
  }, [isAuthenticated, accessToken, isDemo, walletAddress, registerForPushNotifications]);

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

  // Handle the notification that LAUNCHED the app from a killed state. The
  // response listener above isn't guaranteed to fire for the cold-start tap, so
  // pull it explicitly on mount. Dedupe via lastHandledResponseId prevents
  // double-routing if the listener also delivers it.
  useEffect(() => {
    let isMounted = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (isMounted && response) {
        handleNotificationResponse(response);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [handleNotificationResponse]);

  // Replay a tap that arrived before auth hydrated (see pendingResponseRef).
  useEffect(() => {
    if (userType && pendingResponseRef.current) {
      const pending = pendingResponseRef.current;
      pendingResponseRef.current = null;
      handleNotificationResponse(pending);
    }
  }, [userType, handleNotificationResponse]);

  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(async () => {
      if (isRegistering.current) {
        return;
      }

      // Don't re-register on token rotation if this wallet turned push off.
      const disabled = await AsyncStorage.getItem(
        pushDisabledKey(walletAddressRef.current)
      );
      if (disabled === "true") {
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
