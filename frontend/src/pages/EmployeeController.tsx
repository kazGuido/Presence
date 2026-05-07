import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { apiFetch, getEmployeeToken } from '../api/client';

export function EmployeeController() {
  const { t } = useTranslation();
  const token = getEmployeeToken();
  const [kioskToken, setKioskToken] = useState<string | null>(null);
  const [, setTtl] = useState(90);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [borneCompanyAllowed, setBorneCompanyAllowed] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const r = await apiFetch('/api/controller-sessions', { method: 'POST', token });
      const j = (await r.json()) as { kiosk_token: string; ttl_seconds: number };
      setKioskToken(j.kiosk_token);
      setTtl(j.ttl_seconds);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch('/api/employee/attendance-policy', { token })
      .then((r) => r.json() as Promise<{ allow_kiosk_borne: boolean }>)
      .then((j) => setBorneCompanyAllowed(j.allow_kiosk_borne))
      .catch(() => setBorneCompanyAllowed(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch('/api/employee/communication/me', { token })
      .then((r) => r.json() as Promise<{ can_show_controller_ui?: boolean }>)
      .then((j) => setAllowed(Boolean(j.can_show_controller_ui)))
      .catch(() => setAllowed(false));
  }, [token]);

  useEffect(() => {
    if (allowed && borneCompanyAllowed) void refresh();
  }, [allowed, borneCompanyAllowed, refresh]);

  useEffect(() => {
    if (!kioskToken || !allowed || !borneCompanyAllowed) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [kioskToken, allowed, borneCompanyAllowed, refresh]);

  if (!token) {
    return <p className="text-center text-on-surface-variant">{t('employee.pointerLogin')}</p>;
  }

  if (allowed === null || borneCompanyAllowed === null) {
    return <p className="text-center text-on-surface-variant">{t('common.loading')}</p>;
  }

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-outline/20 bg-surface-container-lowest p-8 text-center">
        <p className="text-on-surface-variant">{t('employee.controllerDisabled')}</p>
      </div>
    );
  }

  if (borneCompanyAllowed === false) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-outline/20 bg-surface-container-lowest p-8 text-center">
        <p className="text-on-surface-variant">{t('employee.controllerBorneCompanyOff')}</p>
      </div>
    );
  }

  const scanUrl =
    typeof window !== 'undefined' && kioskToken
      ? `${window.location.origin}/employee/scan-kiosk?t=${encodeURIComponent(kioskToken)}`
      : '';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">{t('employee.controllerTitle')}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{t('employee.controllerSubtitle')}</p>
      </div>
      {err && <p className="text-sm text-error">{err}</p>}
      {allowed && borneCompanyAllowed && kioskToken && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/15 bg-surface-container-lowest p-6">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <QRCodeSVG value={scanUrl} size={220} level="M" />
          </div>
          <p className="max-w-xs break-all text-center font-mono text-xs text-on-surface-variant">{scanUrl}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
          >
            {t('employee.controllerRefresh')}
          </button>
        </div>
      )}
    </div>
  );
}
