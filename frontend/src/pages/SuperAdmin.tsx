import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch, getSuperAdminToken, setSuperAdminToken } from '../api/client';

type Overview = {
  generated_at: string;
  summary: Record<string, number>;
  health: Record<string, string | number>;
  recent_companies: Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    employees: number;
    sites: number;
    punches_7d: number;
  }>;
  top_companies_7d: Array<{ id: string; name: string; slug: string; punches: number }>;
  recent_audit: Array<{
    id: string;
    company: string;
    company_slug: string;
    actor_type: string;
    action: string;
    entity_type: string | null;
    created_at: string;
  }>;
};

type ReportConfig = {
  enabled: boolean;
  recipients: string[];
  weekday: number;
  hour_utc: number;
  smtp_configured: boolean;
};

function metricLabel(key: string) {
  return key.replaceAll('_', ' ');
}

function healthClasses(value: string | number) {
  const text = String(value);
  if (text === 'ok' || text === 'configured' || text === 'enabled') return 'bg-emerald-50 text-emerald-700 ring-emerald-700/20';
  if (text === 'disabled' || text === 'not_configured') return 'bg-secondary-container text-on-secondary-container ring-secondary/20';
  return 'bg-surface-container text-on-surface-variant ring-outline/20';
}

export function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const response = await apiFetch('/api/auth/super-admin/login', {
        method: 'POST',
        token: null,
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { access_token: string };
      setSuperAdminToken(data.access_token);
      setDone(true);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Unable to sign in');
    }
  };

  if (done || getSuperAdminToken()) return <Navigate to="/super-admin" replace />;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(76,86,177,0.16),transparent_30rem),linear-gradient(135deg,#f8fbff,#fff7ed)] px-4 py-10">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] bg-primary p-8 text-on-primary shadow-2xl shadow-primary/20">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-white/70">Presence ops</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">Super admin observability</h1>
          <p className="mt-4 leading-7 text-white/80">
            Monitor platform adoption, health signals, company activity, geofence review load, and weekly reporting from one protected workspace.
          </p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="rounded-[2rem] border border-outline/10 bg-surface-container-lowest p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Restricted access</p>
          <h2 className="mt-2 text-2xl font-black">Sign in as super admin</h2>
          <div className="mt-6 space-y-4">
            <input
              type="email"
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
              placeholder="Super admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
            <button type="submit" className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20">
              Open platform dashboard
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export function SuperAdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const token = getSuperAdminToken();

  const load = () => {
    if (!token) return;
    setErr(null);
    void Promise.all([
      apiFetch('/api/super-admin/overview', { token }).then((r) => r.json() as Promise<Overview>),
      apiFetch('/api/super-admin/report-config', { token }).then((r) => r.json() as Promise<ReportConfig>),
    ])
      .then(([overviewData, config]) => {
        setOverview(overviewData);
        setReportConfig(config);
      })
      .catch((error: Error) => setErr(error.message));
  };

  useEffect(load, [token]);

  const logout = () => {
    setSuperAdminToken(null);
    window.location.href = '/super-admin/login';
  };

  const sendReport = async () => {
    if (!token) return;
    setReportMsg(null);
    setErr(null);
    try {
      const response = await apiFetch('/api/super-admin/weekly-report/send', { method: 'POST', token });
      const data = (await response.json()) as { sent: number };
      setReportMsg(`Report sent to ${data.sent} recipient(s).`);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Unable to send report');
    }
  };

  if (!token) return <Navigate to="/super-admin/login" replace />;

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-primary/10 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Presence super admin</p>
            <h1 className="text-2xl font-black text-on-surface md:text-3xl">Platform observability</h1>
            <p className="mt-1 text-sm text-on-surface-variant">Generated {overview?.generated_at ? new Date(overview.generated_at).toLocaleString() : '...'}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="rounded-full border border-outline/20 px-4 py-2 text-sm font-bold text-primary">
              Refresh
            </button>
            <button type="button" onClick={logout} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-6">
        {err && <div className="rounded-2xl bg-error-container/50 px-4 py-3 text-sm text-error">{err}</div>}

        {overview && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(overview.summary).map(([key, value]) => (
                <article key={key} className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">{metricLabel(key)}</p>
                  <p className="mt-2 text-3xl font-black tabular-nums text-on-surface">{value}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <article className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm">
                <h2 className="text-lg font-black">Health and reporting</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(overview.health).map(([key, value]) => (
                    <span key={key} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${healthClasses(value)}`}>
                      {metricLabel(key)}: {String(value)}
                    </span>
                  ))}
                </div>
                {reportConfig && (
                  <div className="mt-5 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    <p><strong className="text-on-surface">Weekly email:</strong> {reportConfig.enabled ? 'enabled' : 'disabled'}</p>
                    <p className="mt-1">Schedule: weekday {reportConfig.weekday}, {reportConfig.hour_utc}:00 UTC</p>
                    <p className="mt-1">Recipients: {reportConfig.recipients.join(', ') || 'none configured'}</p>
                    <button type="button" onClick={() => void sendReport()} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">
                      Send report now
                    </button>
                    {reportMsg && <p className="mt-2 text-primary">{reportMsg}</p>}
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm">
                <h2 className="text-lg font-black">Top companies by punches, last 7 days</h2>
                <div className="mt-4 space-y-3">
                  {overview.top_companies_7d.map((company) => (
                    <div key={company.id} className="flex items-center justify-between rounded-2xl bg-surface-container-low p-3">
                      <div>
                        <p className="font-bold">{company.name}</p>
                        <p className="text-xs text-on-surface-variant">{company.slug}</p>
                      </div>
                      <p className="text-xl font-black text-primary">{company.punches}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm">
                <h2 className="text-lg font-black">Recent companies</h2>
                <div className="mt-4 space-y-3">
                  {overview.recent_companies.map((company) => (
                    <div key={company.id} className="rounded-2xl bg-surface-container-low p-3">
                      <p className="font-bold">{company.name}</p>
                      <p className="text-xs text-on-surface-variant">{company.slug} · {company.employees} employees · {company.sites} sites · {company.punches_7d} punches 7d</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm">
                <h2 className="text-lg font-black">Recent audit events</h2>
                <div className="mt-4 space-y-3">
                  {overview.recent_audit.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-surface-container-low p-3">
                      <p className="font-bold">{event.action}</p>
                      <p className="text-xs text-on-surface-variant">{event.company} · {event.actor_type} · {new Date(event.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
