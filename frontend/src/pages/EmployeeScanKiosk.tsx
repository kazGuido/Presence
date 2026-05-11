import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCurrentPositionGeo, isCapacitorNative, pickCameraPhotoFile } from '../capacitor/native';
import { apiFetch, getEmployeeToken } from '../api/client';

export function EmployeeScanKiosk() {
  const { t } = useTranslation();
  const location = useLocation();
  const { kioskToken: kioskFromPath } = useParams<{ kioskToken?: string }>();
  const [params] = useSearchParams();
  const kiosk = params.get('t') ?? kioskFromPath ?? null;
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
      if (!gpsDenied) {
        try {
          const pos = await getCurrentPositionGeo();
          fd.append('lat', String(pos.lat));
          fd.append('lng', String(pos.lng));
          fd.append('location_unavailable', 'false');
        } catch {
          locUnavailable = true;
        }
      }
      if (locUnavailable) {
        fd.append('location_unavailable', 'true');
        let attachment = photo;
        if (!attachment && isCapacitorNative()) {
          attachment = await pickCameraPhotoFile();
        }
        if (!attachment) {
          throw new Error(t('employee.pointerPhotoMode'));
        }
        fd.append('file', attachment);
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
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-primary">{t('employee.scanNoTokenTitle')}</h1>
        <p className="text-sm text-on-surface-variant">{t('employee.scanNoTokenBody')}</p>
        <Link
          to="/employee"
          className="inline-flex rounded-xl border border-outline/30 px-5 py-2 text-sm font-semibold text-primary pressable"
        >
          {t('employee.scanNoTokenBack')}
        </Link>
      </div>
    );
  }

  if (!token) {
    const nextAfterLogin = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <p className="text-on-surface-variant">{t('employee.scanNeedMagic')}</p>
        <Link
          to={`/employee/login?next=${nextAfterLogin}`}
          className="pressable inline-flex rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary motion-safe:transition-opacity hover:opacity-95"
        >
          {t('employee.scanSignInCta')}
        </Link>
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
          className="pressable w-full rounded-xl bg-primary py-3 font-semibold text-on-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? '…' : t('employee.scanConfirm')}
        </button>
      </form>
    </div>
  );
}
