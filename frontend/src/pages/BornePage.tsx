import { FormEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import { getCurrentPositionGeo } from '../capacitor/native';
import { apiFetch } from '../api/client';

type BorneInfo = {
  company_name: string;
  site_name: string;
  radius_m: number;
  allow_kiosk_scan: boolean;
};

export function BornePage() {
  const { kioskToken } = useParams<{ kioskToken?: string }>();
  const [info, setInfo] = useState<BorneInfo | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scanUrl = useMemo(() => {
    if (!kioskToken || typeof window === 'undefined') return '';
    return `${window.location.origin}/employee/scan-kiosk/${encodeURIComponent(kioskToken)}`;
  }, [kioskToken]);

  useEffect(() => {
    if (!kioskToken) return;
    void apiFetch(`/api/controller-sessions/${encodeURIComponent(kioskToken)}/public`, { token: null })
      .then((r) => r.json() as Promise<BorneInfo>)
      .then(setInfo)
      .catch((error: Error) => setErr(error.message));
  }, [kioskToken]);

  const submitFallback = async (e: FormEvent) => {
    e.preventDefault();
    if (!kioskToken) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('identifier', identifier.trim());
      fd.append('password', password);
      try {
        const pos = await getCurrentPositionGeo();
        fd.append('lat', String(pos.lat));
        fd.append('lng', String(pos.lng));
        fd.append('location_unavailable', 'false');
      } catch {
        fd.append('location_unavailable', 'true');
      }
      await apiFetch(`/api/controller-sessions/${encodeURIComponent(kioskToken)}/site-login-punch`, {
        method: 'POST',
        body: fd,
        token: null,
      });
      setMsg('Attendance confirmed.');
      setIdentifier('');
      setPassword('');
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Unable to confirm attendance');
    } finally {
      setBusy(false);
    }
  };

  if (!kioskToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4 text-center">
        <p className="text-on-surface-variant">Missing borne token.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(76,86,177,0.18),transparent_30rem),linear-gradient(135deg,#f8fbff,#fff7ed)] px-4 py-8">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/75 p-6 text-center shadow-2xl shadow-primary/10 backdrop-blur md:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </div>
          <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-primary">
            Presence borne
          </p>
          <h1 className="mt-2 text-3xl font-black text-on-surface md:text-5xl">
            {info ? info.site_name : 'Loading site...'}
          </h1>
          <p className="mt-2 text-on-surface-variant">
            {info ? `${info.company_name} · ${Math.round(info.radius_m)} m geofence` : 'Preparing QR scan.'}
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-3xl bg-white p-5 shadow-sm">
            {scanUrl ? <QRCodeSVG value={scanUrl} size={280} level="M" /> : null}
          </div>
          <p className="mx-auto mt-4 max-w-lg text-sm text-on-surface-variant">
            Scan this QR with your own phone. After sign-in, your phone records GPS and confirms your attendance for this site.
          </p>
          <p className="mx-auto mt-2 max-w-sm break-all font-mono text-xs text-on-surface-variant/80">{scanUrl}</p>
          {scanUrl && (
            <Link
              to={scanUrl.replace(window.location.origin, '')}
              className="mt-5 inline-flex rounded-2xl border border-primary/30 px-5 py-3 text-sm font-bold text-primary"
            >
              Open scan on this device
            </Link>
          )}
        </div>

        <aside className="rounded-[2rem] border border-outline/10 bg-surface-container-lowest p-6 shadow-xl md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Cannot scan?</p>
          <h2 className="mt-2 text-2xl font-black text-on-surface">Confirm on this borne</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Use your employee ID or work email and password. This still tries to save the device GPS location for the attendance record.
          </p>
          <form className="mt-6 space-y-4" onSubmit={(e) => void submitFallback(e)}>
            <input
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
              placeholder="Employee ID or work email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
            {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
            {msg && <p className="rounded-xl bg-primary-container/50 px-3 py-2 text-sm text-primary">{msg}</p>}
            <button
              type="submit"
              disabled={busy || !info?.allow_kiosk_scan}
              className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {busy ? '...' : 'Confirm attendance'}
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}
