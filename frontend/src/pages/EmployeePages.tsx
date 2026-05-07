import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getEmployeeToken } from '../api/client';

export function EmployeeLoading() {
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => nav('/employee', { replace: true }), 1800);
    return () => clearTimeout(t);
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
          <span className="text-xs font-medium uppercase tracking-wider opacity-80">Protocole Sécurisé</span>
        </div>
        <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            my_location
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-primary">Vérification de la localisation...</h1>
        <p className="text-on-surface-variant">Établissement d&apos;une connexion sécurisée et validation des paramètres de zone.</p>
      </div>
    </div>
  );
}

export function EmployeePointer() {
  const [state, setState] = useState<{ next_kind: string; local_date: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = getEmployeeToken();

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/punches/me/state', { token })
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  const punch = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const kind = state?.next_kind ?? 'punch_in';
      const res = await apiFetch('/api/punches/me/json', {
        method: 'POST',
        token,
        body: JSON.stringify({
          kind,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
      const data = await res.json();
      window.location.href = `/employee/confirmation?ok=1&at=${encodeURIComponent(data.at)}`;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return <p className="text-center text-on-surface-variant">Connectez-vous sur /employee/login</p>;
  }

  const label = state?.next_kind === 'punch_out' ? 'Pointer le départ' : "Pointer l'arrivée";

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-semibold text-primary">Validation de présence</h1>
        <p className="text-on-surface-variant">Veuillez confirmer votre position pour l&apos;enregistrement.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-primary/10 bg-surface-container-lowest shadow-sm lg:col-span-8">
          <div className="absolute inset-0 bg-surface-container" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="hex-clip flex h-56 w-56 items-center justify-center border-4 border-secondary-container/60 bg-secondary-container/10">
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
          <div className="absolute left-4 top-4 rounded-lg border border-primary/10 bg-surface-container-lowest/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant">Site</p>
            <p className="text-lg font-semibold">Votre site par défaut</p>
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">État</h3>
            <p className="text-sm text-on-surface-variant">
              Prochain pointage: <strong className="text-primary">{state?.next_kind ?? '…'}</strong>
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">Date locale: {state?.local_date ?? '…'}</p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-surface-container-lowest p-6 shadow-sm">
            <p className="mb-4 text-center text-sm text-on-surface-variant">GPS requis pour pointer.</p>
            {err && <p className="mb-2 text-center text-sm text-error">{err}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void punch()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-semibold text-on-primary transition hover:opacity-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                alarm_on
              </span>
              {busy ? '…' : label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeHistorique() {
  const [rows, setRows] = useState<
    Array<{ id: string; kind: string; at: string; within_geofence: boolean; distance_m: number | null }>
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const token = getEmployeeToken();

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/punches/me', { token })
      .then((r) => r.json())
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  if (!token) return <p className="text-center">Connexion requise.</p>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold">Historique des présences</h1>
      <p className="mb-8 text-on-surface-variant">Vos derniers pointages.</p>
      {err && <p className="text-error">{err}</p>}
      <div className="space-y-4">
        {rows.map((p) => (
          <article
            key={p.id}
            className="flex flex-col justify-between gap-4 rounded-xl border border-primary/10 bg-surface-container-lowest p-5 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-semibold">{p.kind === 'punch_in' ? 'Entrée' : 'Sortie'}</p>
              <p className="text-sm text-on-surface-variant">{new Date(p.at).toLocaleString('fr-FR')}</p>
            </div>
            <div
              className={`hex-clip inline-flex items-center gap-1 px-4 py-1 text-xs font-medium uppercase ${
                p.within_geofence ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              {p.within_geofence ? 'Validé' : 'Signalé'}
            </div>
          </article>
        ))}
        {rows.length === 0 && !err && <p className="text-on-surface-variant">Aucun pointage.</p>}
      </div>
    </div>
  );
}

export function EmployeeParametres() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Paramètres</h1>
      <p className="text-on-surface-variant">À venir — préférences et appareil.</p>
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
