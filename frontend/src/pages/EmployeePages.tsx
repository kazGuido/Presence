import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickCameraPhotoFile, getCurrentPositionGeo, isCapacitorNative } from '../capacitor/native';
import { apiFetch, getEmployeeToken } from '../api/client';

export type AttendancePolicy = {
  allow_punch_gps: boolean;
  allow_punch_photo: boolean;
  allow_punch_kiosk_scan: boolean;
  allow_kiosk_borne: boolean;
};

export function EmployeeLoading() {
  const { t } = useTranslation();
  const nav = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => nav('/employee', { replace: true }), 1800);
    return () => clearTimeout(timer);
  }, [nav]);

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5">
        <span className="material-symbols-outlined text-[400px] text-primary">hexagon</span>
      </div>
      <div className="relative z-10 max-w-md text-center">
        <div className="mb-8 flex items-center justify-center gap-2 text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            hexagon
          </span>
          <span className="text-xs font-medium uppercase tracking-wider opacity-80">{t('employee.loadingBadge')}</span>
        </div>
        <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            my_location
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-primary">{t('employee.loadingTitle')}</h1>
        <p className="text-on-surface-variant">{t('employee.loadingSubtitle')}</p>
      </div>
    </div>
  );
}

export function EmployeePointer() {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    next_kind: string;
    local_date: string;
    expected_start_local?: string | null;
    show_clock_in_reminder?: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const token = getEmployeeToken();

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/punches/me/state', { token })
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setErr(String(e.message)));
    apiFetch('/api/employee/attendance-policy', { token })
      .then((r) => r.json() as Promise<AttendancePolicy>)
      .then(setPolicy)
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  useEffect(() => {
    if (!policy) return;
    if (policy.allow_punch_photo && !policy.allow_punch_gps) setPhotoMode(true);
    if (policy.allow_punch_gps && !policy.allow_punch_photo) setPhotoMode(false);
  }, [policy]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'denied' && policy?.allow_punch_gps) setPhotoMode(true);
        p.onchange = () => {
          if (p.state === 'denied' && policy?.allow_punch_gps) setPhotoMode(true);
        };
      })
      .catch(() => {});
  }, [policy?.allow_punch_gps]);

  const punch = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    const canGps = policy?.allow_punch_gps ?? true;
    const canPhoto = policy?.allow_punch_photo ?? true;
    try {
      if (!canGps && !canPhoto) {
        setErr(t('employee.pointerAppPunchDisabled'));
        return;
      }

      const kind = state?.next_kind ?? 'punch_in';
      const fd = new FormData();
      fd.append('kind', kind);

      if (!canGps && canPhoto) {
        let attachment = photo;
        if (!attachment && isCapacitorNative()) {
          attachment = await pickCameraPhotoFile();
        }
        if (!attachment) {
          setErr(t('employee.pointerPhotoMode'));
          return;
        }
        fd.append('location_unavailable', 'true');
        fd.append('file', attachment);
      } else if (canGps && !canPhoto) {
        const pos = await getCurrentPositionGeo();
        fd.append('lat', String(pos.lat));
        fd.append('lng', String(pos.lng));
        fd.append('location_unavailable', 'false');
      } else {
        if (photoMode) {
          let attachment = photo;
          if (!attachment && isCapacitorNative()) {
            attachment = await pickCameraPhotoFile();
          }
          if (!attachment) {
            setErr(t('employee.pointerPhotoMode'));
            return;
          }
          fd.append('location_unavailable', 'true');
          fd.append('file', attachment);
        } else {
          try {
            const pos = await getCurrentPositionGeo();
            fd.append('lat', String(pos.lat));
            fd.append('lng', String(pos.lng));
            fd.append('location_unavailable', 'false');
          } catch {
            let attachment = photo;
            if (!attachment && isCapacitorNative()) {
              attachment = await pickCameraPhotoFile();
            }
            if (!attachment) {
              if (!canPhoto) {
                setErr(t('employee.pointerGpsRequired'));
                return;
              }
              setErr(t('employee.pointerPhotoMode'));
              return;
            }
            fd.append('location_unavailable', 'true');
            fd.append('file', attachment);
          }
        }
      }

      const res = await apiFetch('/api/punches/me', {
        method: 'POST',
        body: fd,
        token,
      });
      const data = (await res.json()) as { at: string };
      window.location.href = `/employee/confirmation?ok=1&at=${encodeURIComponent(data.at)}`;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return <p className="text-center text-on-surface-variant">{t('employee.pointerLogin')}</p>;
  }

  const canGps = policy?.allow_punch_gps ?? true;
  const canPhoto = policy?.allow_punch_photo ?? true;
  const canKioskScan = policy?.allow_punch_kiosk_scan ?? true;
  const showAppPunch = canGps || canPhoto;
  const showPhotoToggle = canGps && canPhoto;
  const showGpsHint = canGps;

  const label =
    state?.next_kind === 'punch_out' ? t('employee.pointerClockOut') : t('employee.pointerClockIn');

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-semibold text-primary">{t('employee.pointerTitle')}</h1>
        <p className="text-on-surface-variant">{t('employee.pointerSubtitle')}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-primary/10 bg-surface-container-lowest shadow-sm motion-safe:transition-shadow lg:col-span-8">
          <div className="absolute inset-0 bg-surface-container" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="hex-clip flex h-56 w-56 items-center justify-center border-4 border-secondary-container/60 bg-secondary-container/10">
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            </div>
          </div>
          <div className="absolute left-4 top-4 rounded-lg border border-primary/10 bg-surface-container-lowest/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant">{t('employee.pointerSite')}</p>
            <p className="text-lg font-semibold">{t('employee.pointerDefaultSite')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-surface-container-lowest p-6 shadow-sm motion-safe:transition-shadow">
            <h3 className="mb-4 text-lg font-semibold">{t('employee.pointerState')}</h3>
            <p className="text-sm text-on-surface-variant">
              {t('employee.pointerNext')}: <strong className="text-primary">{state?.next_kind ?? '…'}</strong>
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t('employee.pointerDate')}: {state?.local_date ?? '…'}
            </p>
            {state?.expected_start_local && (
              <p className="mt-2 text-sm text-on-surface-variant">
                {t('employee.pointerScheduledStart')}:{' '}
                <strong className="text-on-surface">{state.expected_start_local}</strong>
              </p>
            )}
            {err && !showAppPunch && <p className="mt-3 text-sm text-error">{err}</p>}
          </div>

          {canKioskScan && (
            <div className="rounded-xl border border-primary/20 bg-primary-container/10 p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-primary">{t('employee.pointerKioskCardTitle')}</h3>
              <p className="mb-4 text-sm text-on-surface-variant">{t('employee.pointerKioskCardBody')}</p>
              {!showAppPunch && (
                <p className="mb-4 rounded-lg border border-secondary-container/30 bg-surface-container-lowest/80 p-3 text-sm text-on-surface-variant">
                  {t('employee.pointerKioskOnlyHint')}
                </p>
              )}
              <Link
                to="/employee/scan-kiosk"
                className="pressable flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-surface-container-lowest py-3 text-center font-semibold text-primary motion-safe:transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  qr_code_scanner
                </span>
                {t('employee.pointerKioskCta')}
              </Link>
            </div>
          )}

          {showAppPunch ? (
            <div className="rounded-xl border border-primary/10 bg-surface-container-lowest p-6 shadow-sm motion-safe:transition-shadow">
              <h3 className="mb-2 text-sm font-semibold text-on-surface">{t('employee.pointerAppPunchTitle')}</h3>
              {showPhotoToggle && (
                <label className="mb-3 flex items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" checked={photoMode} onChange={(e) => setPhotoMode(e.target.checked)} />
                  {t('employee.pointerPhotoMode')}
                </label>
              )}
              {photoMode && canPhoto && (
                <input type="file" accept="image/*" capture="environment" className="mb-3 w-full text-sm" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              )}
              {showGpsHint && (
                <p className="mb-4 text-center text-sm text-on-surface-variant">{t('employee.pointerGpsHint')}</p>
              )}
              {!showGpsHint && canPhoto && (
                <p className="mb-4 text-center text-sm text-on-surface-variant">{t('employee.pointerPhotoOnlyHint')}</p>
              )}
              {err && <p className="mb-2 text-center text-sm text-error">{err}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void punch()}
                className="pressable flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-semibold text-on-primary motion-safe:transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  alarm_on
                </span>
                {busy ? '…' : label}
              </button>
            </div>
          ) : (
            !canKioskScan && <p className="rounded-xl border border-error/30 bg-error-container/10 p-4 text-center text-sm text-error">{t('employee.pointerAppPunchDisabled')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmployeeHistorique() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      kind: string;
      at: string;
      within_geofence: boolean;
      distance_m: number | null;
      photo_only_attestation?: boolean;
    }>
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const token = getEmployeeToken();
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/punches/me', { token })
      .then((r) => r.json())
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  if (!token) return <p className="text-center">{t('employee.historyNeedLogin')}</p>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold">{t('employee.historyTitle')}</h1>
      <p className="mb-8 text-on-surface-variant">{t('employee.historySubtitle')}</p>
      {err && <p className="text-error">{err}</p>}
      <div className="space-y-4">
        {rows.map((p) => (
          <article
            key={p.id}
            className="flex flex-col justify-between gap-4 rounded-xl border border-primary/10 bg-surface-container-lowest p-5 motion-safe:transition-shadow sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-semibold">{p.kind === 'punch_in' ? t('employee.historyIn') : t('employee.historyOut')}</p>
              <p className="text-sm text-on-surface-variant">{new Date(p.at).toLocaleString(loc)}</p>
              {p.photo_only_attestation && (
                <p className="mt-1 text-xs text-on-surface-variant">Photo</p>
              )}
            </div>
            <div
              className={`hex-clip inline-flex items-center gap-1 px-4 py-1 text-xs font-medium uppercase ${
                p.within_geofence ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              {p.within_geofence ? t('employee.historyOk') : t('employee.historyFlagged')}
            </div>
          </article>
        ))}
        {rows.length === 0 && !err && <p className="text-on-surface-variant">{t('employee.historyEmpty')}</p>}
      </div>
    </div>
  );
}

export function EmployeeParametres() {
  const { t } = useTranslation();
  const token = getEmployeeToken();
  const [email, setEmail] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWa, setNotifyWa] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [waVerified, setWaVerified] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setErr(null);
    void apiFetch('/api/employee/communication/me', { token })
      .then((r) => r.json() as Promise<{
        email: string | null;
        phone_e164: string | null;
        notify_email: boolean;
        notify_whatsapp: boolean;
        notify_push?: boolean;
        email_verified: boolean;
        whatsapp_verified: boolean;
      }>)
      .then((j) => {
        setEmail(j.email ?? '');
        setNotifyEmail(j.notify_email);
        setNotifyWa(j.notify_whatsapp);
        setNotifyPush(j.notify_push !== false);
        setEmailVerified(j.email_verified);
        setWaVerified(j.whatsapp_verified);
        setPhone(j.phone_e164);
      })
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, [token]);

  const savePrefs = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        notify_email: notifyEmail,
        notify_whatsapp: notifyWa,
        notify_push: notifyPush,
      };
      if (email.trim()) body.email = email.trim();
      await apiFetch('/api/employee/communication/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      });
      setMsg(t('employee.settingsSaved'));
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const requestCode = async () => {
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/employee/communication/verify/request', {
        method: 'POST',
        token,
        body: JSON.stringify({ channel }),
      });
      setMsg(`Code envoyé (${channel === 'email' ? 'e-mail' : 'WhatsApp'}).`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const confirmCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/employee/communication/verify/confirm', {
        method: 'POST',
        token,
        body: JSON.stringify({ channel, code }),
      });
      setMsg('Canal vérifié.');
      setCode('');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  if (!token) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold">{t('employee.settingsTitle')}</h1>
        <p className="text-on-surface-variant">{t('employee.settingsLoginPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">{t('employee.settingsTitle')}</h1>

      <form onSubmit={(e) => void savePrefs(e)} className="space-y-3 rounded-xl border border-outline/10 bg-surface-container-lowest p-4">
        <h2 className="text-lg font-medium">{t('employee.settingsContact')}</h2>
        <label className="block text-sm text-on-surface-variant">{t('employee.settingsEmail')}</label>
        <input
          className="w-full rounded border border-outline/20 px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {phone && (
          <p className="text-sm text-on-surface-variant">
            {t('employee.settingsPhoneManaged')}: <span className="font-mono">{phone}</span>
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
          {t('employee.settingsNotifyEmail')}
          {emailVerified ? <span className="text-primary">{t('employee.settingsVerified')}</span> : <span className="text-secondary">{t('employee.settingsNotVerified')}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyWa} onChange={(e) => setNotifyWa(e.target.checked)} />
          {t('employee.settingsNotifyWa')}
          {waVerified ? <span className="text-primary">{t('employee.settingsVerified')}</span> : <span className="text-secondary">{t('employee.settingsNotVerified')}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} />
          {t('employee.settingsNotifyPush')}
        </label>
        <button type="submit" className="pressable rounded-lg bg-primary px-4 py-2 text-on-primary">
          {t('employee.settingsSave')}
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-outline/10 bg-surface-container-lowest p-4">
        <h2 className="text-lg font-medium">Vérifier un canal</h2>
        <p className="text-sm text-on-surface-variant">Nécessite Redis et SMTP (e-mail) ou le pont WhatsApp.</p>
        <select
          className="w-full rounded border border-outline/20 px-3 py-2"
          value={channel}
          onChange={(e) => setChannel(e.target.value as 'email' | 'whatsapp')}
        >
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <button type="button" className="rounded-lg border border-primary px-4 py-2 text-primary" onClick={() => void requestCode()}>
          Envoyer le code
        </button>
        <form onSubmit={(e) => void confirmCode(e)} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded border border-outline/20 px-3 py-2"
            placeholder="Code reçu"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="pressable rounded-lg bg-secondary-container px-4 py-2 text-on-secondary-container">
            Confirmer
          </button>
        </form>
      </div>

      {err && <p className="text-sm text-error">{err}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}
    </div>
  );
}

export function EmployeeConfirmation() {
  const sp = new URLSearchParams(window.location.search);
  const ok = sp.get('ok');
  const at = sp.get('at');
  return (
    <div className="mx-auto max-w-md space-y-8 py-8">
      {ok ? (
        <div className="rounded-xl border border-outline/10 bg-surface-container-lowest p-8 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center bg-primary text-on-primary hex-clip">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-primary">Pointage Réussi</h2>
          <p className="mb-4 text-on-surface-variant">Votre présence a été enregistrée.</p>
          {at && (
            <p className="text-sm">
              Heure: <strong>{new Date(at).toLocaleString('fr-FR')}</strong>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-secondary-container/20 bg-surface-container-lowest p-8 text-center">
          <h2 className="mb-2 text-2xl font-semibold text-secondary">Erreur</h2>
          <p className="text-on-surface-variant">Réessayez depuis Pointer.</p>
        </div>
      )}
    </div>
  );
}
