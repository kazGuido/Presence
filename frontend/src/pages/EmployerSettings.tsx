import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

export function EmployerSettings() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<{ ok?: boolean; connected?: boolean; wid?: string | null } | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {t('employer.settingsWaShowQr')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logoutBridge()}
            className="rounded-full border border-outline/30 px-4 py-2 text-sm"
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
