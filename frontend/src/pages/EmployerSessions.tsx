import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

type SessionRow = {
  id: string;
  employee_id: string;
  work_site_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  completed_punch_id: string | null;
};

type Emp = { id: string; display_name: string };
type Site = { id: string; name: string };

export function EmployerSessions() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [empId, setEmpId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [hours, setHours] = useState(24);
  const [tokenModal, setTokenModal] = useState<{ id: string; token: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    void apiFetch('/api/attendance-sessions')
      .then((r) => r.json())
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
    void apiFetch('/api/employees')
      .then((r) => r.json())
      .then(setEmps)
      .catch(() => {});
    void apiFetch('/api/work-sites')
      .then((r) => r.json())
      .then(setSites)
      .catch(() => {});
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/attendance-sessions', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId, work_site_id: siteId, expires_hours: hours }),
      });
      const j = (await res.json()) as { id: string; token: string };
      setTokenModal({ id: j.id, token: j.token });
      setEmpId('');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const send = async (channel: 'auto' | 'email' | 'whatsapp') => {
    if (!tokenModal) return;
    setErr(null);
    try {
      await apiFetch(`/api/attendance-sessions/${tokenModal.id}/send-notification-with-token`, {
        method: 'POST',
        body: JSON.stringify({ token: tokenModal.token, channel }),
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const empName = (id: string) => emps.find((e) => e.id === id)?.display_name ?? id.slice(0, 8);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">{t('employer.sessionsTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.sessionsSubtitle')}</p>
      </div>
      {err && <p className="text-sm text-error">{err}</p>}

      <form onSubmit={(e) => void create(e)} className="rounded-2xl border border-outline/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase text-primary">{t('employer.sessionsNew')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            required
          >
            <option value="">{t('employer.sessionsEmployee')}</option>
            {emps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.display_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-outline/25 bg-surface px-3 py-2"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            <option value="">{t('employer.sessionsSite')}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">{t('employer.sessionsExpiry')}</span>
            <input
              type="number"
              min={1}
              max={168}
              className="w-full rounded-xl border border-outline/25 bg-surface px-3 py-2"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
        </div>
        <button type="submit" className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary">
          {t('employer.sessionsCreate')}
        </button>
      </form>

      {tokenModal && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary-container/20 p-6">
          <p className="text-sm font-semibold text-on-secondary-container">{t('employer.sessionsTokenOnce')}</p>
          <code className="mt-2 block break-all rounded-lg bg-surface p-3 font-mono text-xs">{tokenModal.token}</code>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(tokenModal.token)}
              className="rounded-full border border-outline/30 px-4 py-2 text-sm"
            >
              {t('common.copy')}
            </button>
            <button type="button" onClick={() => void send('auto')} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
              {t('employer.sessionsSend')} (auto)
            </button>
            <button type="button" onClick={() => void send('email')} className="rounded-full border px-4 py-2 text-sm">
              Email
            </button>
            <button type="button" onClick={() => void send('whatsapp')} className="rounded-full border px-4 py-2 text-sm">
              WhatsApp
            </button>
            <button type="button" onClick={() => setTokenModal(null)} className="rounded-full px-4 py-2 text-sm text-on-surface-variant">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((s) => (
          <article key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/15 bg-surface-container-lowest p-4 text-sm">
            <div>
              <p className="font-medium text-on-surface">{empName(s.employee_id)}</p>
              <p className="text-on-surface-variant">
                {siteName(s.work_site_id)} · {new Date(s.expires_at).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-surface-variant px-3 py-1 text-xs font-medium uppercase">{s.status}</span>
          </article>
        ))}
        {rows.length === 0 && <p className="text-on-surface-variant">—</p>}
      </div>
    </div>
  );
}
