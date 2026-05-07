import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { apiFetch, getEmployerToken, setEmployerToken } from '../api/client';

export function EmployerShell() {
  const token = getEmployerToken();
  const logout = () => {
    setEmployerToken(null);
    window.location.href = '/employer/login';
  };

  if (!token) {
    return <Navigate to="/employer/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-primary/10 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <span className="font-semibold text-primary">Portail employeur</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            <NavLink to="/employer" className={({ isActive }) => (isActive ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
              Analytique
            </NavLink>
            <NavLink to="/employer/sites" className={({ isActive }) => (isActive ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
              Sites
            </NavLink>
            <NavLink to="/employer/schedules" className={({ isActive }) => (isActive ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
              Horaires
            </NavLink>
            <NavLink to="/employer/employees" className={({ isActive }) => (isActive ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
              Employés
            </NavLink>
          </nav>
          <button type="button" onClick={logout} className="text-sm text-on-surface-variant underline">
            Déconnexion
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}

export function EmployerDashboard() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    apiFetch(`/api/analytics/attendance?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Analytique présence</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        <input type="date" className="rounded border px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded border px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" onClick={() => void load()} className="rounded bg-primary px-4 py-1 text-on-primary">
          Actualiser
        </button>
      </div>
      {err && <p className="text-error">{err}</p>}
      <pre className="overflow-auto rounded border bg-surface-container-low p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

type Site = { id: string; name: string; lat: number; lng: number; radius_m: number };

export function EmployerSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('5.3364');
  const [lng, setLng] = useState('-4.0277');
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    apiFetch('/api/work-sites')
      .then((r) => r.json())
      .then(setSites)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    void load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch('/api/work-sites', {
        method: 'POST',
        body: JSON.stringify({ name, lat: parseFloat(lat), lng: parseFloat(lng), radius_m: 200 }),
      });
      setName('');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Sites de travail</h1>
      <form onSubmit={(e) => void add(e)} className="mb-8 flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-28 rounded border px-2 py-1" value={lat} onChange={(e) => setLat(e.target.value)} />
        <input className="w-28 rounded border px-2 py-1" value={lng} onChange={(e) => setLng(e.target.value)} />
        <button type="submit" className="rounded bg-primary px-3 py-1 text-on-primary">
          Ajouter
        </button>
      </form>
      {err && <p className="text-error">{err}</p>}
      <ul className="space-y-2">
        {sites.map((s) => (
          <li key={s.id} className="rounded border p-3 text-sm">
            <strong>{s.name}</strong> — {s.lat}, {s.lng} — r={s.radius_m}m — <code className="text-xs">{s.id}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmployerSchedules() {
  const [name, setName] = useState('Bureau');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch('/api/work-schedules', {
        method: 'POST',
        body: JSON.stringify({
          name,
          rules: [{ weekday: 0, start_time: '08:00:00', end_time: '17:00:00' }],
        }),
      });
      setMsg('Horaire créé');
      setName('Bureau');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Horaires</h1>
      <form onSubmit={(e) => void add(e)} className="flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="rounded bg-primary px-3 py-1 text-on-primary">
          Créer (lun 8h–17h)
        </button>
      </form>
      {err && <p className="mt-2 text-error">{err}</p>}
      {msg && <p className="mt-2 text-primary">{msg}</p>}
    </div>
  );
}

type Emp = { id: string; display_name: string; default_work_site_id: string | null };

export function EmployerEmployees() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('1234');
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    void apiFetch('/api/employees')
      .then((r) => r.json())
      .then(setEmps)
      .catch((e) => setErr(e.message));
    void apiFetch('/api/work-sites')
      .then((r) => r.json())
      .then(setSites)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          display_name: name,
          pin,
          default_work_site_id: siteId || null,
        }),
      });
      setName('');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Employés</h1>
      <form onSubmit={(e) => void add(e)} className="mb-8 space-y-2 rounded border p-4">
        <input className="w-full rounded border px-2 py-1" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full rounded border px-2 py-1" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        <select className="w-full rounded border px-2 py-1" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">— site défaut —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-primary px-3 py-1 text-on-primary">
          Ajouter
        </button>
      </form>
      {err && <p className="text-error">{err}</p>}
      <ul className="space-y-3">
        {emps.map((em) => (
          <li key={em.id} className="rounded border p-3">
            <div className="font-medium">{em.display_name}</div>
            <code className="text-xs break-all">{em.id}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
