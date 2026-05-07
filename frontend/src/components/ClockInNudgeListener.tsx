import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch, getEmployeeToken } from '../api/client';

type PunchStateJson = {
  next_kind: string;
  local_date: string;
  expected_start_local?: string | null;
  show_clock_in_reminder?: boolean;
};

/**
 * While the employee is signed in (employee shell), polls punch state and shows a Sonner toast
 * when the server signals the clock-in reminder window (schedule + local time).
 */
export function ClockInNudgeListener() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = getEmployeeToken();

  const maybeToast = useCallback(async () => {
    if (!token || typeof document === 'undefined' || document.visibilityState === 'hidden') {
      return;
    }
    try {
      const r = await apiFetch('/api/punches/me/state', { token });
      const s = (await r.json()) as PunchStateJson;
      if (!s.show_clock_in_reminder) {
        return;
      }
      const key = `ga_clock_in_nudge_${s.local_date}`;
      if (sessionStorage.getItem(key)) {
        return;
      }
      sessionStorage.setItem(key, '1');

      const time = s.expected_start_local?.trim();
      const description = time
        ? t('employee.nudgeClockInBody', { time })
        : t('employee.nudgeClockInBodyNoTime');

      toast.info(t('employee.nudgeClockInTitle'), {
        description,
        action: {
          label: t('employee.nudgeClockInAction'),
          onClick: () => navigate('/employee'),
        },
        duration: 14_000,
      });
    } catch {
      /* ignore */
    }
  }, [t, token, navigate]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void maybeToast();
    const id = window.setInterval(() => void maybeToast(), 90_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void maybeToast();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, maybeToast]);

  return null;
}
