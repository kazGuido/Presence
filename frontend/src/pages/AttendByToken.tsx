import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

export function AttendByToken() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<{
    site_name: string;
    employee_display_name: string;
    expires_at: string;
    status: string;
    already_completed: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/attendance-sessions/by-token/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setMeta)
      .catch((e) => setErr(e.message));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const fd = new FormData();
      fd.append('lat', String(pos.coords.latitude));
      fd.append('lng', String(pos.coords.longitude));
      if (file) fd.append('file', file);
      const res = await fetch(`/api/attendance-sessions/by-token/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      window.location.href = '/employee/confirmation?ok=1';
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  if (err && !meta) return <p className="p-8 text-center text-error">{err}</p>;
  if (!meta) return <p className="p-8 text-center">Chargement…</p>;
  if (meta.already_completed) return <p className="p-8 text-center">Ce lien a déjà été utilisé.</p>;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-primary">Valider présence</h1>
      <p className="mb-6 text-on-surface-variant">
        {meta.employee_display_name} — {meta.site_name}
      </p>
      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-primary/10 bg-surface-container-lowest p-6">
        <label className="block text-sm">
          Photo (optionnel)
          <input type="file" accept="image/*" capture="environment" className="mt-1 w-full" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {err && <p className="text-sm text-error">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary py-3 font-medium text-on-primary disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Confirmer avec GPS'}
        </button>
      </form>
    </div>
  );
}
