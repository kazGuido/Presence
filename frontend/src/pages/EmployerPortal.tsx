import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { MobileHexTabBar, type HexTabItem } from '../components/MobileHexTabBar';
import { apiFetch, getEmployerToken, setEmployerToken } from '../api/client';

const employerHexTabs: HexTabItem[] = [
  { to: '/employer', label: 'Synthèse', icon: 'monitoring', matchIndex: true },
  { to: '/employer/sites', label: 'Sites', icon: 'pin_drop' },
  { to: '/employer/schedules', label: 'Temps', icon: 'schedule' },
  { to: '/employer/employees', label: 'Équipe', icon: 'groups' },
];

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
      <header className="relative overflow-hidden border-b border-primary/10 bg-surface-container-lowest">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 opacity-[0.07]"
          aria-hidden
        >
          <span className="material-symbols-outlined text-[280px] text-primary">hexagon</span>
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="hex-clip flex h-11 w-9 shrink-0 items-center justify-center bg-primary text-on-primary shadow-md shadow-primary/20">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                domain
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Espace employeur</p>
              <p className="text-lg font-semibold text-on-surface">Portail présence</p>
            </div>
          </div>
          <nav className="hidden flex-wrap items-center gap-2 md:flex">
            {[
              { to: '/employer', label: 'Analytique', icon: 'bar_chart' },
              { to: '/employer/sites', label: 'Sites', icon: 'location_on' },
              { to: '/employer/schedules', label: 'Horaires', icon: 'event' },
              { to: '/employer/employees', label: 'Employés', icon: 'badge' },
            ].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/employer'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface',
                  ].join(' ')
                }
              >
                <span className="material-symbols-outlined text-[18px]">{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-outline/20 bg-surface px-4 py-2 text-sm font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary"
          >
            Déconnexion
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:px-6 md:pb-10">
        <Outlet />
      </div>
      <MobileHexTabBar items={employerHexTabs} variant="compact" />
    </div>
  );
}

/* ——— Analytics types (mirror API) ——— */

type AnalyticsDay = {
  date: string;
  employee_id: string;
  employee_name: string;
  first_punch_in_at: string | null;
  last_punch_out_at: string | null;
  expected_start: string | null;
  expected_end: string | null;
  flags: string[];
};

type AnalyticsPayload = {
  summary: { employees: number; days_flagged: number; days_ok: number };
  per_employee: Array<{ employee: { id: string; name: string }; days: AnalyticsDay[] }>;
};

function flagLabel(flag: string): string {
  const m: Record<string, string> = {
    missing_in: 'Entrée absente',
    missing_out: 'Sortie absente',
    late_in: 'Entrée tardive',
    early_out: 'Sortie anticipée',
    out_of_geofence: 'Hors zone',
  };
  return m[flag] ?? flag;
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  accent,
}: {
  icon: string;
  title: string;
  value: number | string;
  subtitle: string;
  accent: 'primary' | 'success' | 'warn';
}) {
  const ring =
    accent === 'success'
      ? 'from-emerald-600/15 to-primary-container/20 ring-emerald-700/15'
      : accent === 'warn'
        ? 'from-secondary-container/40 to-secondary-container/10 ring-secondary/25'
        : 'from-primary/15 to-primary-container/25 ring-primary/20';
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-sm ring-1 ${ring} bg-surface-container-lowest`}
    >
      <div className="absolute -right-2 -top-2 opacity-[0.12]">
        <span className="material-symbols-outlined text-7xl text-primary">{icon}</span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
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
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openEmp, setOpenEmp] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    setLoading(true);
    apiFetch(`/api/analytics/attendance?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => setData(j as AnalyticsPayload))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface md:text-3xl">Analytique présence</h1>
          <p className="mt-1 text-on-surface-variant">Vue synthétique par employé et par jour sur la période choisie.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline/15 bg-surface-container-low p-2 shadow-sm">
          <input
            type="date"
            className="rounded-xl border border-outline/20 bg-surface px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-on-surface-variant">→</span>
          <input
            type="date"
            className="rounded-xl border border-outline/20 bg-surface px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {loading ? '…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined">error</span>
          {err}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon="groups"
              title="Employés actifs"
              value={data.summary.employees}
              subtitle="Période sélectionnée"
              accent="primary"
            />
            <StatCard
              icon="check_circle"
              title="Jours conformes"
              value={data.summary.days_ok}
              subtitle={`${data.summary.days_ok + data.summary.days_flagged} jour·employé au total`}
              accent="success"
            />
            <StatCard
              icon="warning"
              title="Jours signalés"
              value={data.summary.days_flagged}
              subtitle="Entrées manquantes, retards, zone…"
              accent="warn"
            />
          </div>

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary">person_search</span>
              Détail par employé
            </h2>
            <div className="space-y-3">
              {data.per_employee.map((block) => {
                const flagged = block.days.filter((d) => d.flags.length > 0).length;
                const open = openEmp === block.employee.id;
                return (
                  <article
                    key={block.employee.id}
                    className="overflow-hidden rounded-2xl border border-outline/15 bg-surface-container-lowest shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenEmp(open ? null : block.employee.id)}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-container-low"
                    >
                      <div className="hex-clip flex h-12 w-10 shrink-0 items-center justify-center bg-primary-container text-lg font-bold text-on-primary-container">
                        {block.employee.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-on-surface">{block.employee.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{block.employee.id}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase text-on-surface-variant">Alertes</p>
                          <p className="text-lg font-bold tabular-nums text-secondary">{flagged}</p>
                        </div>
                        <span
                          className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
                        >
                          expand_more
                        </span>
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-outline/10 bg-surface-container-low/60 px-4 py-4">
                        <div className="flex gap-1.5 overflow-x-auto pb-2">
                          {block.days.map((day) => {
                            const ok = day.flags.length === 0;
                            return (
                              <div
                                key={day.date}
                                title={day.flags.map(flagLabel).join(', ') || 'OK'}
                                className={[
                                  'flex min-w-[4.5rem] flex-col items-center rounded-xl border px-2 py-2 text-center',
                                  ok
                                    ? 'border-emerald-700/20 bg-emerald-50 text-emerald-900'
                                    : 'border-secondary/30 bg-secondary-container/30 text-on-secondary-container',
                                ].join(' ')}
                              >
                                <span className="text-[10px] font-semibold uppercase leading-tight text-on-surface-variant">
                                  {formatShortDate(day.date)}
                                </span>
                                <span className="material-symbols-outlined mt-1 text-[22px]">{ok ? 'task_alt' : 'priority_high'}</span>
                                {!ok && (
                                  <span className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight">
                                    {day.flags.slice(0, 2).map(flagLabel).join(' · ')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
                          <p>
                            <span className="font-semibold text-on-surface">Première entrée (période)</span>{' '}
                            {(() => {
                              const ins = block.days.map((d) => d.first_punch_in_at).filter(Boolean) as string[];
                              if (!ins.length) return '—';
                              const t = ins.reduce((a, b) => (a < b ? a : b));
                              return new Date(t).toLocaleString('fr-FR');
                            })()}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">Dernière sortie (période)</span>{' '}
                            {(() => {
                              const outs = block.days.map((d) => d.last_punch_out_at).filter(Boolean) as string[];
                              if (!outs.length) return '—';
                              const t = outs.reduce((a, b) => (a > b ? a : b));
                              return new Date(t).toLocaleString('fr-FR');
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {!data && !err && loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-outline/30 py-16 text-on-surface-variant">
          <span className="material-symbols-outlined animate-pulse text-3xl text-primary">hourglass_top</span>
          Chargement des statistiques…
        </div>
      )}
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
      .catch((e: Error) => setErr(e.message));

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">Sites de travail</h1>
        <p className="mt-1 text-on-surface-variant">Géofences pour valider les pointages sur le terrain.</p>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-container/15 to-surface-container-lowest p-6 shadow-sm"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <span className="material-symbols-outlined text-xl">add_location_alt</span>
          Nouveau site
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 text-sm"
            placeholder="Nom du site"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono text-sm"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            aria-label="Latitude"
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono text-sm"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            aria-label="Longitude"
          />
          <button type="submit" className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow-sm">
            Ajouter le site
          </button>
        </div>
      </form>

      {err && <p className="text-sm text-error">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {sites.map((s) => (
          <article
            key={s.id}
            className="group relative overflow-hidden rounded-2xl border border-outline/15 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="h-28 bg-gradient-to-br from-primary/20 via-surface-container to-secondary-container/25"
              style={{
                backgroundImage: `radial-gradient(circle at 30% 40%, rgba(0,70,40,0.25) 0%, transparent 45%),
                  radial-gradient(circle at 70% 60%, rgba(253,133,53,0.15) 0%, transparent 40%)`,
              }}
            />
            <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/95 shadow-md ring-1 ring-primary/20">
              <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                location_on
              </span>
            </div>
            <div className="p-5 pt-2">
              <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/40 px-3 py-1 text-xs font-medium text-on-primary-container">
                  <span className="material-symbols-outlined text-[14px]">sensors</span>
                  {s.radius_m} m
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-3 py-1 font-mono text-xs text-on-surface-variant">
                  {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                </span>
              </div>
              <p className="mt-3 truncate font-mono text-[11px] text-on-surface-variant/80" title={s.id}>
                ID {s.id}
              </p>
            </div>
          </article>
        ))}
      </div>
      {sites.length === 0 && !err && <p className="text-center text-on-surface-variant">Aucun site — ajoutez votre premier lieu.</p>}
    </div>
  );
}

type ScheduleRow = { id: string; name: string };

export function EmployerSchedules() {
  const [name, setName] = useState('Bureau');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const load = () =>
    apiFetch('/api/work-schedules')
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/work-schedules', {
        method: 'POST',
        body: JSON.stringify({
          name,
          rules: [{ weekday: 0, start_time: '08:00:00', end_time: '17:00:00' }],
        }),
      });
      setMsg('Horaire créé (lun. 8h–17h par défaut)');
      setName('Bureau');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">Horaires</h1>
        <p className="mt-1 text-on-surface-variant">Modèles de journée pour comparer aux pointages réels.</p>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="flex max-w-xl flex-col gap-3 rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Nom</label>
          <input className="w-full rounded-xl border border-outline/25 bg-surface px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm">
          Créer
        </button>
      </form>
      {err && <p className="text-sm text-error">{err}</p>}
      {msg && (
        <p className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-container/20 px-4 py-3 text-sm text-primary">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {msg}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-start gap-3 rounded-2xl border border-outline/15 bg-surface-container-lowest p-4 shadow-sm"
          >
            <div className="hex-clip flex h-11 w-9 shrink-0 items-center justify-center bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined">event</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">{r.name}</p>
              <p className="mt-1 font-mono text-[11px] text-on-surface-variant">{r.id}</p>
              <p className="mt-2 text-xs text-on-surface-variant">Règles détaillées visibles côté API / futures éditions.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Emp = {
  id: string;
  display_name: string;
  email?: string | null;
  phone_e164?: string | null;
  notify_email?: boolean;
  notify_whatsapp?: boolean;
  email_verified?: boolean;
  whatsapp_verified?: boolean;
  default_work_site_id: string | null;
};

export function EmployerEmployees() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('1234');
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    void apiFetch('/api/employees')
      .then((r) => r.json())
      .then(setEmps)
      .catch((e: Error) => setErr(e.message));
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
          email: email.trim() || null,
          phone_e164: phone.trim() || null,
          pin,
          default_work_site_id: siteId || null,
        }),
      });
      setName('');
      setEmail('');
      setPhone('');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">Employés</h1>
        <p className="mt-1 text-on-surface-variant">Cartes, canaux de contact et site par défaut.</p>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="space-y-4 rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <span className="material-symbols-outlined">person_add</span>
          Ajouter un employé
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5" placeholder="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5"
            placeholder="E-mail (optionnel)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5"
            placeholder="Téléphone E.164 (optionnel)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          <select className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 sm:col-span-2" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">— Site par défaut —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm">
          Enregistrer
        </button>
      </form>

      {err && <p className="text-sm text-error">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {emps.map((em) => (
          <article key={em.id} className="overflow-hidden rounded-2xl border border-outline/15 bg-surface-container-lowest shadow-sm">
            <div className="flex gap-4 p-5">
              <div className="hex-clip flex h-14 w-11 shrink-0 items-center justify-center bg-primary text-lg font-bold text-on-primary">
                {em.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-on-surface">{em.display_name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {em.email && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs text-on-surface">
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      {em.email}
                      {em.email_verified && (
                        <span className="material-symbols-outlined text-[14px] text-emerald-700" title="Vérifié">
                          verified
                        </span>
                      )}
                    </span>
                  )}
                  {em.phone_e164 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs text-on-surface">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      {em.phone_e164}
                      {em.whatsapp_verified && (
                        <span className="material-symbols-outlined text-[14px] text-emerald-700" title="WhatsApp vérifié">
                          verified
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
                  Site défaut : <strong className="text-on-surface">{siteName(em.default_work_site_id)}</strong>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded-lg bg-surface-container px-2 py-1 font-mono text-[10px] text-on-surface-variant">{em.id}</code>
                  <button
                    type="button"
                    onClick={() => void copyId(em.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-outline/25 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {copied === em.id ? 'Copié' : 'Copier ID'}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
