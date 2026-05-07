import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

type AuditRow = {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export function EmployerJournal() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch('/api/audit?limit=200')
      .then((r) => r.json())
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">{t('employer.journalTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.journalSubtitle')}</p>
      </div>
      {err && <p className="text-sm text-error">{err}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <article key={r.id} className="rounded-xl border border-outline/10 bg-surface-container-lowest p-4 text-sm">
            <p className="font-mono text-xs text-on-surface-variant">{new Date(r.created_at).toLocaleString()}</p>
            <p className="mt-1 text-on-surface">
              <span className="font-semibold">{r.action}</span> · {r.actor_type} ·{' '}
              <code className="text-xs">{r.actor_id}</code>
            </p>
            {r.entity_type && (
              <p className="mt-1 text-xs text-on-surface-variant">
                {r.entity_type} {r.entity_id}
              </p>
            )}
          </article>
        ))}
        {rows.length === 0 && !err && <p className="text-on-surface-variant">{t('employer.journalEmpty')}</p>}
      </div>
    </div>
  );
}
