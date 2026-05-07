import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

export function EmployerWelcome() {
  const { t } = useTranslation();
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void apiFetch('/api/employer/company')
      .then((r) => r.json() as Promise<{ slug: string }>)
      .then((j) => setSlug(j.slug))
      .catch(() => {});
  }, []);

  const copySlug = async () => {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">{t('employer.welcomeTitle')}</h1>
        <p className="mt-1 text-on-surface-variant">{t('employer.welcomeSubtitle')}</p>
      </div>
      <section className="rounded-2xl border border-primary/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{t('employer.welcomeSlug')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-surface-container px-3 py-2 font-mono text-sm">{slug || '…'}</code>
          <button
            type="button"
            onClick={() => void copySlug()}
            className="rounded-full border border-outline/25 px-4 py-1.5 text-sm font-medium text-primary"
          >
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
      </section>
      <ol className="list-decimal space-y-3 pl-5 text-on-surface">
        <li>
          <Link className="text-primary underline" to="/employer/sites">
            {t('employer.welcomeStepSite')}
          </Link>
        </li>
        <li>
          <Link className="text-primary underline" to="/employer/schedules">
            {t('employer.welcomeStepSchedule')}
          </Link>
        </li>
        <li>
          <Link className="text-primary underline" to="/employer/employees">
            {t('employer.welcomeStepEmployee')}
          </Link>
        </li>
        <li>
          <Link className="text-primary underline" to="/employee/login">
            {t('employer.welcomeStepPunch')}
          </Link>
        </li>
      </ol>
      <Link to="/employer" className="inline-block text-sm font-medium text-primary underline">
        {t('common.back')}
      </Link>
    </div>
  );
}
