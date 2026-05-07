import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../components/LanguageToggle';
import { WorkSiteMap } from '../components/WorkSiteMap';
import { MobileHexTabBar, type HexTabItem } from '../components/MobileHexTabBar';
import { apiFetch, getEmployerToken, setEmployerToken } from '../api/client';

export function EmployerShell() {
  const { t } = useTranslation();
  const token = getEmployerToken();
  const employerHexTabs: HexTabItem[] = useMemo(
    () => [
      { to: '/employer', label: t('employer.navSynth'), icon: 'monitoring', matchIndex: true },
      { to: '/employer/sites', label: t('employer.navSites'), icon: 'pin_drop' },
      { to: '/employer/schedules', label: t('employer.navTemps'), icon: 'schedule' },
      { to: '/employer/employees', label: t('employer.navTeam'), icon: 'groups' },
    ],
    [t]
  );
  const logout = () => {
    setEmployerToken(null);
    window.location.href = '/employer/login';
  };

  if (!token) {
    return <Navigate to="/employer/login" replace />;
  }

  const navLinks = [
    { to: '/employer', label: t('employer.navAnalytics'), icon: 'bar_chart', end: true },
    { to: '/employer/sites', label: t('employer.navSites'), icon: 'location_on', end: false },
    { to: '/employer/schedules', label: t('employer.navSchedules'), icon: 'event', end: false },
    { to: '/employer/employees', label: t('employer.navEmployees'), icon: 'badge', end: false },
    { to: '/employer/sessions', label: t('employer.navSessions'), icon: 'link', end: false },
    { to: '/employer/journal', label: t('employer.navJournal'), icon: 'history', end: false },
    { to: '/employer/settings', label: t('employer.navSettings'), icon: 'settings', end: false },
  ];

  return (
    <div className="min-h-screen bg-surface motion-safe:transition-colors">
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
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">{t('employer.spaceLabel')}</p>
              <p className="text-lg font-semibold text-on-surface">{t('employer.portalTitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <LanguageToggle />
            <nav className="hidden flex-wrap items-center gap-1 lg:flex xl:gap-2">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium motion-safe:transition-colors xl:px-4',
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface',
                    ].join(' ')
                  }
                >
                  <span className="material-symbols-outlined text-[18px]">{l.icon}</span>
                  <span className="hidden xl:inline">{l.label}</span>
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-outline/20 bg-surface px-4 py-2 text-sm font-medium text-on-surface-variant motion-safe:transition-colors hover:border-primary/30 hover:text-primary"
            >
              {t('common.logout')}
            </button>
          </div>
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

function formatShortDate(iso: string, lng: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lng.startsWith('fr') ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
  const { t, i18n } = useTranslation();
  const describeFlag = (flag: string) => t(`employer.flags.${flag}`, { defaultValue: flag });
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

  const exportCsv = async () => {
    try {
      const r = await apiFetch(`/api/analytics/attendance/export?from=${from}&to=${to}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'presence-attendance.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface md:text-3xl">{t('employer.dashboardTitle')}</h1>
          <p className="mt-1 text-on-surface-variant">{t('employer.dashboardSubtitle')}</p>
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
            onClick={() => void exportCsv()}
            className="rounded-xl border border-outline/25 bg-surface px-4 py-2 text-sm font-medium text-primary motion-safe:transition-opacity hover:opacity-90"
          >
            {t('employer.exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {loading ? '…' : t('common.refresh')}
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined">error</span>
          {err}
        </div>
      )}

      {data && data.per_employee.length === 0 && (
        <div className="rounded-2xl border border-dashed border-outline/30 bg-surface-container-low/50 p-10 text-center">
          <p className="text-lg font-semibold text-on-surface">{t('employer.dashboardEmptyTitle')}</p>
          <p className="mt-2 text-sm text-on-surface-variant">{t('employer.dashboardEmptyBody')}</p>
        </div>
      )}

      {data && data.per_employee.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon="groups"
              title={t('employer.dashboardStatEmployees')}
              value={data.summary.employees}
              subtitle={t('employer.dashboardPeriod')}
              accent="primary"
            />
            <StatCard
              icon="check_circle"
              title={t('employer.dashboardStatOk')}
              value={data.summary.days_ok}
              subtitle={`${data.summary.days_ok + data.summary.days_flagged} ${t('employer.dashboardTotalPersonDays')}`}
              accent="success"
            />
            <StatCard
              icon="warning"
              title={t('employer.dashboardStatFlagged')}
              value={data.summary.days_flagged}
              subtitle={t('employer.dashboardFlaggedExplain')}
              accent="warn"
            />
          </div>

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary">person_search</span>
              {t('employer.dashboardDetailTitle')}
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
                          <p className="text-xs font-medium uppercase text-on-surface-variant">{t('employer.dashboardAlerts')}</p>
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
                                title={day.flags.map(describeFlag).join(', ') || 'OK'}
                                className={[
                                  'flex min-w-[4.5rem] flex-col items-center rounded-xl border px-2 py-2 text-center',
                                  ok
                                    ? 'border-emerald-700/20 bg-emerald-50 text-emerald-900'
                                    : 'border-secondary/30 bg-secondary-container/30 text-on-secondary-container',
                                ].join(' ')}
                              >
                                <span className="text-[10px] font-semibold uppercase leading-tight text-on-surface-variant">
                                  {formatShortDate(day.date, i18n.language)}
                                </span>
                                <span className="material-symbols-outlined mt-1 text-[22px]">{ok ? 'task_alt' : 'priority_high'}</span>
                                {!ok && (
                                  <span className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight">
                                    {day.flags.slice(0, 2).map(describeFlag).join(' · ')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
                          <p>
                            <span className="font-semibold text-on-surface">{t('employer.dashboardFirstIn')}</span>{' '}
                            {(() => {
                              const ins = block.days.map((d) => d.first_punch_in_at).filter(Boolean) as string[];
                              if (!ins.length) return '—';
                              const tm = ins.reduce((a, b) => (a < b ? a : b));
                              return new Date(tm).toLocaleString(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US');
                            })()}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">{t('employer.dashboardLastOut')}</span>{' '}
                            {(() => {
                              const outs = block.days.map((d) => d.last_punch_out_at).filter(Boolean) as string[];
                              if (!outs.length) return '—';
                              const tm = outs.reduce((a, b) => (a > b ? a : b));
                              return new Date(tm).toLocaleString(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US');
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
          {t('common.loading')}
        </div>
      )}
    </div>
  );
}

type Site = { id: string; name: string; lat: number; lng: number; radius_m: number };

export function EmployerSites() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState('');
  const [lat, setLat] = useState(5.3364);
  const [lng, setLng] = useState(-4.0277);
  const [radiusM, setRadiusM] = useState(200);
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
        body: JSON.stringify({
          name,
          lat,
          lng,
          radius_m: radiusM,
        }),
      });
      setName('');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const onMapMove = (la: number, lo: number) => {
    setLat(Math.round(la * 1e6) / 1e6);
    setLng(Math.round(lo * 1e6) / 1e6);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">{t('employer.sitesTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.sitesSubtitle')}</p>
      </div>

      <WorkSiteMap
        lat={lat}
        lng={lng}
        radiusM={radiusM}
        onPositionChange={onMapMove}
        mapClickHint={t('employer.sitesMapHint')}
      />

      <form
        onSubmit={(e) => void add(e)}
        className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-container/15 to-surface-container-lowest p-6 shadow-sm"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <span className="material-symbols-outlined text-xl">add_location_alt</span>
          {t('employer.sitesNew')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 text-sm sm:col-span-2"
            placeholder={t('employer.sitesNamePh')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            <span>{t('employer.sitesLat')}</span>
            <input
              className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono text-sm"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
              aria-label={t('employer.sitesLat')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            <span>{t('employer.sitesLng')}</span>
            <input
              className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono text-sm"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
              aria-label={t('employer.sitesLng')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            <span>{t('employer.sitesRadius')}</span>
            <input
              className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono text-sm"
              type="number"
              min={30}
              max={5000}
              step={10}
              value={radiusM}
              onChange={(e) => setRadiusM(parseInt(e.target.value, 10) || 200)}
              aria-label={t('employer.sitesRadius')}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow-sm sm:w-auto sm:px-8"
        >
          {t('employer.sitesAdd')}
        </button>
      </form>

      {err && <p className="text-sm text-error">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {sites.map((s) => (
          <article
            key={s.id}
            className="group relative overflow-hidden rounded-2xl border border-outline/15 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative h-36 w-full overflow-hidden">
              <WorkSiteMap
                lat={s.lat}
                lng={s.lng}
                radiusM={s.radius_m}
                onPositionChange={() => {}}
                interactive={false}
              />
            </div>
            <div className="p-5 pt-3">
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
      {sites.length === 0 && !err && (
        <p className="text-center text-on-surface-variant">{t('employer.sitesEmpty')}</p>
      )}
    </div>
  );
}

type ScheduleRow = { id: string; name: string };
type ScheduleRule = { id: string; weekday: number; start_time: string; end_time: string };
type ScheduleDetail = { id: string; name: string; rules: ScheduleRule[] };

type DayEdit = { worked: boolean; start: string; end: string };

const blankWeek = (): DayEdit[] =>
  Array.from({ length: 7 }, () => ({ worked: false, start: '09:00', end: '17:00' }));

export function EmployerSchedules() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('Bureau');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [week, setWeek] = useState<DayEdit[]>(blankWeek);
  const [dirty, setDirty] = useState(false);

  const wdLabels = i18n.language.startsWith('fr')
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const load = () =>
    apiFetch('/api/work-schedules')
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  const loadDetail = (id: string) => {
    setEditId(id);
    setErr(null);
    void apiFetch(`/api/work-schedules/${id}`)
      .then((r) => r.json())
      .then((d: ScheduleDetail) => {
        setEditName(d.name);
        const base = blankWeek();
        for (const rule of d.rules) {
          if (rule.weekday >= 0 && rule.weekday < 7) {
            base[rule.weekday] = {
              worked: true,
              start: rule.start_time.slice(0, 5),
              end: rule.end_time.slice(0, 5),
            };
          }
        }
        setWeek(base);
        setDirty(false);
      })
      .catch((e: Error) => setErr(e.message));
  };

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
      setMsg(t('employer.schedulesRulesNote'));
      setName('Bureau');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const buildRules = () => {
    const rules: { weekday: number; start_time: string; end_time: string }[] = [];
    week.forEach((d, weekday) => {
      if (!d.worked) return;
      const st = d.start.length === 5 ? `${d.start}:00` : d.start;
      const en = d.end.length === 5 ? `${d.end}:00` : d.end;
      rules.push({ weekday, start_time: st, end_time: en });
    });
    return rules;
  };

  const saveEdit = async () => {
    if (!editId) return;
    setErr(null);
    try {
      await apiFetch(`/api/work-schedules/${editId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, rules: buildRules() }),
      });
      setMsg(t('common.save'));
      setDirty(false);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const copyMonday = () => {
    setWeek((w) => {
      const mon = { ...w[0] };
      return w.map((d, i) => (i === 0 ? d : { ...mon }));
    });
    setDirty(true);
  };

  const applyTemplate = (office: boolean) => {
    if (office) {
      setWeek(Array.from({ length: 7 }, () => ({ worked: true, start: '09:00', end: '18:00' })));
    } else {
      setWeek(Array.from({ length: 7 }, () => ({ worked: true, start: '08:00', end: '14:00' })));
    }
    setDirty(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">{t('employer.schedulesTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.schedulesSubtitle')}</p>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="flex max-w-xl flex-col gap-3 rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{t('employer.schedulesName')}</label>
          <input className="w-full rounded-xl border border-outline/25 bg-surface px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm">
          {t('employer.schedulesCreate')}
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
          <button
            key={r.id}
            type="button"
            onClick={() => loadDetail(r.id)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-shadow hover:shadow-md ${
              editId === r.id ? 'border-primary bg-primary-container/10' : 'border-outline/15 bg-surface-container-lowest'
            }`}
          >
            <div className="hex-clip flex h-11 w-9 shrink-0 items-center justify-center bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined">event</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">{r.name}</p>
              <p className="mt-1 font-mono text-[11px] text-on-surface-variant">{r.id}</p>
              <p className="mt-2 text-xs text-primary">{t('employer.schedulesTapToEdit')}</p>
            </div>
          </button>
        ))}
      </div>

      {editId && (
        <section className="space-y-4 rounded-2xl border border-primary/20 bg-surface-container-lowest p-6 shadow-inner">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">{t('employer.schedulesName')}</label>
              <input
                className="w-full rounded-xl border border-outline/25 bg-surface px-3 py-2"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <button type="button" onClick={() => applyTemplate(true)} className="rounded-lg border px-3 py-2 text-xs font-medium">
              {t('employer.schedulesTemplateOffice')}
            </button>
            <button type="button" onClick={() => applyTemplate(false)} className="rounded-lg border px-3 py-2 text-xs font-medium">
              {t('employer.schedulesTemplateShort')}
            </button>
            <button type="button" onClick={() => copyMonday()} className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-medium text-primary">
              {t('employer.schedulesCopyMon')}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {week.map((d, i) => (
              <div key={i} className="rounded-xl border border-outline/15 bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-on-surface">{wdLabels[i]}</span>
                  <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={d.worked}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setWeek((w) => w.map((x, j) => (j === i ? { ...x, worked: v } : x)));
                        setDirty(true);
                      }}
                    />
                    {t('employer.schedulesWorked')}
                  </label>
                </div>
                {d.worked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      className="rounded-lg border border-outline/25 px-2 py-1 text-sm"
                      value={d.start}
                      onChange={(e) => {
                        const v = e.target.value;
                        setWeek((w) => w.map((x, j) => (j === i ? { ...x, start: v } : x)));
                        setDirty(true);
                      }}
                    />
                    <span className="text-on-surface-variant">→</span>
                    <input
                      type="time"
                      className="rounded-lg border border-outline/25 px-2 py-1 text-sm"
                      value={d.end}
                      onChange={(e) => {
                        const v = e.target.value;
                        setWeek((w) => w.map((x, j) => (j === i ? { ...x, end: v } : x)));
                        setDirty(true);
                      }}
                    />
                  </div>
                )}
                {d.worked && (
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-surface-variant"
                    title={`${d.start}–${d.end}`}
                  >
                    <div
                      className="h-full rounded-full bg-primary motion-safe:transition-all"
                      style={{
                        width: '100%',
                        opacity: 0.85,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={() => void saveEdit()}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40"
            >
              {t('common.save')}
            </button>
            <button type="button" onClick={() => setEditId(null)} className="rounded-xl border px-6 py-2.5 text-sm">
              {t('common.cancel')}
            </button>
          </div>
        </section>
      )}
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
  can_show_controller_ui?: boolean;
};

export function EmployerEmployees() {
  const { t } = useTranslation();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('1234');
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [magicMsg, setMagicMsg] = useState<string | null>(null);

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

  const patchKiosk = async (em: Emp, v: boolean) => {
    setMagicMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/employees/${em.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ can_show_controller_ui: v }),
      });
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const sendMagic = async (em: Emp) => {
    setMagicMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/employees/${em.id}/send-login-link`, { method: 'POST' });
      setMagicMsg(`${em.display_name}: OK`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">{t('employer.employeesTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.employeesSubtitle')}</p>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="space-y-4 rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <span className="material-symbols-outlined">person_add</span>
          {t('employer.employeesAddTitle')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5"
            placeholder={t('employer.employeesDisplayName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5"
            placeholder={t('employer.employeesEmailOpt')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5"
            placeholder={t('employer.employeesPhoneOpt')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 font-mono"
            placeholder={t('employer.employeesPin')}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <select className="rounded-xl border border-outline/25 bg-surface px-3 py-2.5 sm:col-span-2" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{t('employer.employeesDefaultSite')}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm">
          {t('employer.employeesSave')}
        </button>
      </form>

      {magicMsg && <p className="text-sm text-primary">{magicMsg}</p>}
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
                  {t('employer.employeesDefaultSiteLabel')} : <strong className="text-on-surface">{siteName(em.default_work_site_id)}</strong>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded-lg bg-surface-container px-2 py-1 font-mono text-[10px] text-on-surface-variant">{em.id}</code>
                  <button
                    type="button"
                    onClick={() => void copyId(em.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-outline/25 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {copied === em.id ? t('common.copied') : t('employer.employeesCopyId')}
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-outline/10 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface">
                    <input
                      type="checkbox"
                      checked={Boolean(em.can_show_controller_ui)}
                      onChange={(e) => void patchKiosk(em, e.target.checked)}
                    />
                    {t('employer.employeesKiosk')}
                  </label>
                  <button
                    type="button"
                    disabled={!em.email}
                    onClick={() => void sendMagic(em)}
                    className="self-start rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary disabled:opacity-40"
                  >
                    {t('employer.employeesSendMagic')}
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
