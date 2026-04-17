import { useCallback, useRef } from 'react';
import { getVapidPublicKey, registerPushToken, deactivateAllPushTokens } from '@/services/api/notifications';

const PUSH_ENDPOINT_KEY = 'rc_push_endpoint';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function waitForServiceWorkerActive(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return;

  const sw = registration.installing || registration.waiting;
  if (!sw) return;

  return new Promise<void>((resolve) => {
    if (sw.state === 'activated') {
      resolve();
      return;
    }
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') resolve();
    });
  });
}

export function usePushSubscription() {
  const subscribingRef = useRef(false);

  const subscribeToPush = useCallback(async () => {
    if (subscribingRef.current) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    subscribingRef.current = true;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await waitForServiceWorkerActive(registration);

      // Check if already subscribed with the same endpoint
      const existingSubscription = await registration.pushManager.getSubscription();
      const storedEndpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);

      if (existingSubscription && existingSubscription.endpoint === storedEndpoint) {
        return; // Already registered with backend
      }

      // If permission was previously denied, don't prompt again
      if (Notification.permission === 'denied') {
        console.log('[push] Notification permission denied, skipping subscription');
        return;
      }

      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        console.warn('[push] VAPID public key not configured on server');
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // This triggers the browser permission prompt if permission is 'default'
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
      const auth = arrayBufferToBase64(subscription.getKey('auth'));

      await registerPushToken({
        deviceType: 'web',
        deviceName: (navigator.userAgent || 'Web Browser').substring(0, 100),
        webPushSubscription: {
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        },
      });

      localStorage.setItem(PUSH_ENDPOINT_KEY, subscription.endpoint);
      console.log('[push] Web push subscription registered');
    } catch (error) {
      console.error('[push] Failed to subscribe:', error);
    } finally {
      subscribingRef.current = false;
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
      await deactivateAllPushTokens();
      localStorage.removeItem(PUSH_ENDPOINT_KEY);
      console.log('[push] Web push subscription removed');
    } catch (error) {
      console.error('[push] Failed to unsubscribe:', error);
    }
  }, []);

  return { subscribeToPush, unsubscribeFromPush };
}
