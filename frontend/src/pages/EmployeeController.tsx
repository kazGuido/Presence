import { FormEvent, useCallback, useEffect, useState } from 'react';
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
  const [allowPunchPhoto, setAllowPunchPhoto] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualPin, setManualPin] = useState('');
  const [manualPhoto, setManualPhoto] = useState<File | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState<string | null>(null);
  const [manualMsg, setManualMsg] = useState<string | null>(null);

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
      .then(
        (r) =>
          r.json() as Promise<{
            allow_kiosk_borne: boolean;
            allow_punch_photo: boolean;
          }>
      )
      .then((j) => {
        setBorneCompanyAllowed(j.allow_kiosk_borne);
        setAllowPunchPhoto(j.allow_punch_photo);
      })
      .catch(() => {
        setBorneCompanyAllowed(false);
        setAllowPunchPhoto(false);
      });
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

  const onManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !kioskToken) return;
    setManualBusy(true);
    setManualErr(null);
    setManualMsg(null);
    try {
      const fd = new FormData();
      fd.append('identifier', manualIdentifier.trim());
      fd.append('pin', manualPin);
      if (manualPhoto) fd.append('file', manualPhoto);
      await apiFetch(
        `/api/controller-sessions/${encodeURIComponent(kioskToken)}/manual-punch`,
        {
          method: 'POST',
          body: fd,
          token,
        }
      );
      setManualMsg(t('employee.controllerManualSuccess'));
      setManualPin('');
      setManualPhoto(null);
    } catch (e: unknown) {
      setManualErr(e instanceof Error ? e.message : String(e));
    } finally {
      setManualBusy(false);
    }
  };

  if (!token) {
    return <p className="text-center text-on-surface-variant">{t('employee.pointerLogin')}</p>;
  }

  if (allowed === null || borneCompanyAllowed === null || allowPunchPhoto === null) {
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

  /* Path-style token avoids some cameras/apps dropping query strings; ?t= still supported in EmployeeScanKiosk */
  const scanUrl =
    typeof window !== 'undefined' && kioskToken
      ? `${window.location.origin}/employee/scan-kiosk/${encodeURIComponent(kioskToken)}`
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
            className="pressable rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
          >
            {t('employee.controllerRefresh')}
          </button>
        </div>
      )}

      {allowed && borneCompanyAllowed && kioskToken && (
        <section className="rounded-2xl border border-outline/15 bg-surface-container-lowest p-6">
          <h2 className="text-lg font-semibold text-on-surface">{t('employee.controllerManualTitle')}</h2>
          <p className="mt-2 text-sm text-on-surface-variant">{t('employee.controllerManualHint')}</p>
          {!allowPunchPhoto ? (
            <p className="mt-4 text-sm text-secondary">{t('employee.controllerManualPhotoDisabled')}</p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={(e) => void onManualSubmit(e)}>
              <label className="block text-sm">
                <span className="text-on-surface-variant">{t('employee.controllerManualIdentifier')}</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={manualIdentifier}
                  onChange={(e) => setManualIdentifier(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline/25 bg-surface px-3 py-2 text-on-surface"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-on-surface-variant">{t('employee.controllerManualPin')}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={manualPin}
                  onChange={(e) => setManualPin(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline/25 bg-surface px-3 py-2 text-on-surface"
                  required
                  minLength={4}
                />
              </label>
              <label className="block text-sm">
                <span className="text-on-surface-variant">{t('employee.controllerManualSelfie')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(e) => setManualPhoto(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-on-surface"
                  required
                />
              </label>
              {manualErr && <p className="text-sm text-error">{manualErr}</p>}
              {manualMsg && <p className="text-sm text-primary">{manualMsg}</p>}
              <button
                type="submit"
                disabled={manualBusy || !manualPhoto}
                className="pressable w-full rounded-xl bg-primary py-3 font-semibold text-on-primary disabled:pointer-events-none disabled:opacity-50"
              >
                {manualBusy ? '…' : t('employee.controllerManualSubmit')}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
