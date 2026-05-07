import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, getEmployeeToken } from '../api/client';

export function EmployeeScanKiosk() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const kiosk = params.get('t');
  const token = getEmployeeToken();
  const [state, setState] = useState<{ next_kind: string; local_date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);

  useEffect(() => {
    if (!token || !kiosk) return;
    void apiFetch('/api/punches/me/state', { token })
      .then((r) => r.json())
      .then(setState)
      .catch((e: Error) => setErr(e.message));
  }, [token, kiosk]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !kiosk) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const kind = state?.next_kind ?? 'punch_in';
      const fd = new FormData();
      fd.append('kind', kind);
      let locUnavailable = gpsDenied;
      await new Promise<void>((resolve, reject) => {
        if (gpsDenied) {
          resolve();
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fd.append('lat', String(pos.coords.latitude));
            fd.append('lng', String(pos.coords.longitude));
            fd.append('location_unavailable', 'false');
            resolve();
          },
          () => {
            locUnavailable = true;
            resolve();
          },
          { enableHighAccuracy: true, timeout: 12000 }
        );
      });
      if (locUnavailable) {
        fd.append('location_unavailable', 'true');
        if (!photo) {
          throw new Error(t('employee.pointerPhotoMode'));
        }
        fd.append('file', photo);
      }
      await apiFetch(`/api/controller-sessions/${encodeURIComponent(kiosk)}/punch`, {
        method: 'POST',
        body: fd,
        token,
      });
      setMsg(t('employee.scanSuccess'));
      setPhoto(null);
      const r = await apiFetch('/api/punches/me/state', { token });
      setState((await r.json()) as { next_kind: string; local_date: string });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!kiosk) {
    return <p className="px-4 py-12 text-center text-on-surface-variant">{t('employee.scanNoToken')}</p>;
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-on-surface-variant">{t('employee.scanNeedMagic')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12">
      <h1 className="text-xl font-semibold text-primary">{t('employee.scanTitle')}</h1>
      <p className="text-sm text-on-surface-variant">
        {t('employee.pointerNext')}: <strong>{state?.next_kind ?? '…'}</strong>
      </p>
      <label className="flex items-center gap-2 text-sm text-on-surface-variant">
        <input type="checkbox" checked={gpsDenied} onChange={(e) => setGpsDenied(e.target.checked)} />
        {t('employee.pointerPhotoMode')}
      </label>
      {gpsDenied && (
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      )}
      {err && <p className="text-sm text-error">{err}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <form onSubmit={(e) => void onSubmit(e)}>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? '…' : t('employee.scanConfirm')}
        </button>
      </form>
    </div>
  );
}
