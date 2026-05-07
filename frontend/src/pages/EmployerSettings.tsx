import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

export function EmployerSettings() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<{ ok?: boolean; connected?: boolean; wid?: string | null } | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attendance, setAttendance] = useState<{
    allow_punch_gps: boolean;
    allow_punch_photo: boolean;
    allow_punch_kiosk_scan: boolean;
    allow_kiosk_borne: boolean;
  } | null>(null);
  const [attErr, setAttErr] = useState<string | null>(null);
  const [attOk, setAttOk] = useState<string | null>(null);
  const [attBusy, setAttBusy] = useState(false);

  const loadAttendance = () => {
    setAttErr(null);
    void apiFetch('/api/employer/company/attendance')
      .then((r) => r.json() as Promise<{
        allow_punch_gps: boolean;
        allow_punch_photo: boolean;
        allow_punch_kiosk_scan: boolean;
        allow_kiosk_borne: boolean;
      }>)
      .then(setAttendance)
      .catch((e: Error) => setAttErr(e.message));
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const saveAttendance = async (e: FormEvent) => {
    e.preventDefault();
    if (!attendance) return;
    if (!attendance.allow_punch_gps && !attendance.allow_punch_photo && !attendance.allow_punch_kiosk_scan) {
      setAttErr(t('employer.settingsAttendanceOneRequired'));
      return;
    }
    setAttBusy(true);
    setAttErr(null);
    setAttOk(null);
    try {
      await apiFetch('/api/employer/company/attendance', {
        method: 'PUT',
        body: JSON.stringify(attendance),
      });
      setAttOk(t('employer.settingsAttendanceSaved'));
      loadAttendance();
    } catch (e: unknown) {
      setAttErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAttBusy(false);
    }
  };

  const loadHealth = () => {
    void apiFetch('/api/whatsapp-bridge/health-proxy')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const showQr = async () => {
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiFetch('/api/whatsapp-bridge/qr');
      if (res.status === 204) {
        setQrSvg(null);
        setInfo(t('employer.settingsWaNoQrNeeded'));
        loadHealth();
        return;
      }
      const text = await res.text();
      setQrSvg(text);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setQrSvg(null);
    } finally {
      setBusy(false);
    }
  };

  const logoutBridge = async () => {
    if (!window.confirm(t('employer.settingsWaRelinkConfirm'))) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      await apiFetch('/api/whatsapp-bridge/logout', { method: 'POST' });
      setQrSvg(null);
      loadHealth();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">{t('employer.settingsTitle')}</h1>
      </div>
      {err && <p className="text-sm text-error">{err}</p>}
      {info && <p className="text-sm text-primary">{info}</p>}

      <section className="rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-on-surface">{t('employer.settingsAttendanceTitle')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{t('employer.settingsAttendanceHint')}</p>
        {attendance ? (
          <form onSubmit={(e) => void saveAttendance(e)} className="mt-6 space-y-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={attendance.allow_punch_gps}
                onChange={(e) =>
                  setAttendance((prev) =>
                    prev ? { ...prev, allow_punch_gps: e.target.checked } : prev
                  )
                }
              />
              <span>{t('employer.settingsAttendanceGps')}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={attendance.allow_punch_photo}
                onChange={(e) =>
                  setAttendance((prev) =>
                    prev ? { ...prev, allow_punch_photo: e.target.checked } : prev
                  )
                }
              />
              <span>{t('employer.settingsAttendancePhoto')}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={attendance.allow_punch_kiosk_scan}
                onChange={(e) =>
                  setAttendance((prev) =>
                    prev ? { ...prev, allow_punch_kiosk_scan: e.target.checked } : prev
                  )
                }
              />
              <span>{t('employer.settingsAttendanceKioskScan')}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={attendance.allow_kiosk_borne}
                onChange={(e) =>
                  setAttendance((prev) =>
                    prev ? { ...prev, allow_kiosk_borne: e.target.checked } : prev
                  )
                }
              />
              <span>{t('employer.settingsAttendanceBorne')}</span>
            </label>
            <button
              type="submit"
              disabled={attBusy}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary pressable disabled:pointer-events-none disabled:opacity-50"
            >
              {t('employer.settingsAttendanceSave')}
            </button>
          </form>
        ) : (
          !attErr && <p className="mt-4 text-sm text-on-surface-variant">{t('common.loading')}</p>
        )}
        {attErr && <p className="mt-4 text-sm text-error">{attErr}</p>}
        {attOk && <p className="mt-2 text-sm text-primary">{attOk}</p>}
      </section>

      <section className="rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-on-surface">{t('employer.settingsWaTitle')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          {t('employer.settingsWaStatus')}:{' '}
          {health?.connected ? (
            <span className="font-medium text-emerald-700">{t('employer.settingsWaConnected')}</span>
          ) : (
            <span className="font-medium text-secondary">{t('employer.settingsWaDisconnected')}</span>
          )}
          {health?.wid && <span className="ml-2 font-mono text-xs">{health.wid}</span>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void showQr()}
            className="pressable rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {t('employer.settingsWaShowQr')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logoutBridge()}
            className="pressable rounded-full border border-outline/30 px-4 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {t('employer.settingsWaRelink')}
          </button>
        </div>
        {qrSvg && (
          <div
            className="mt-6 flex justify-center [&>svg]:max-h-[min(70vh,420px)] [&>svg]:w-auto"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
      </section>
    </div>
  );
}
