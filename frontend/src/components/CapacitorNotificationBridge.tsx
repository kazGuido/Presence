import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Handles push notification taps when running inside Capacitor (must be under Router).
 */
export function CapacitorNotificationBridge() {
  const navigate = useNavigate();
  const handleRef = useRef<{ remove: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
      const h = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const path = event.notification.data?.path as string | undefined;
        if (path?.startsWith('/')) navigate(path);
      });
      handleRef.current = h;
    });
    return () => {
      void handleRef.current?.remove();
      handleRef.current = null;
    };
  }, [navigate]);

  return null;
}
