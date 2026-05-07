import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { apiFetch, getEmployeeToken } from '../api/client';

/**
 * Registers FCM token with API when employee session exists (Capacitor Android/iOS).
 */
export function useEmployeePushRegistration() {
  const listenersRef = useRef<Array<{ remove: () => Promise<void> }>>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const jwt = getEmployeeToken();
    if (!jwt) return;

    let cancelled = false;

    void (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted' || cancelled) return;

      const regHandle = await PushNotifications.addListener('registration', async (reg) => {
        const t = getEmployeeToken();
        if (!t) return;
        try {
          await apiFetch('/api/employee/push/register', {
            method: 'POST',
            token: t,
            body: JSON.stringify({
              token: reg.value,
              platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
            }),
          });
        } catch {
          /* ignore */
        }
      });
      const errHandle = await PushNotifications.addListener('registrationError', (e) => {
        console.warn('Push registration error', e.error);
      });
      listenersRef.current = [regHandle, errHandle];
      await PushNotifications.register();
    })();

    return () => {
      cancelled = true;
      for (const h of listenersRef.current) void h.remove();
      listenersRef.current = [];
    };
  }, []);
}
