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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/15 via-surface-container-lowest to-secondary-container/30 p-6 shadow-sm md:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{t('employer.welcomeKicker')}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.03em] text-on-surface md:text-5xl">
              {t('employer.welcomeTitle')}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-on-surface-variant">{t('employer.welcomeSubtitle')}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/employer/sites"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20"
              >
                {t('employer.welcomePrimaryCta')}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <Link
                to="/employer/employees"
                className="inline-flex items-center justify-center rounded-2xl border border-outline/20 bg-surface px-5 py-3 text-sm font-bold text-on-surface"
              >
                {t('employer.welcomeSecondaryCta')}
              </Link>
            </div>
          </div>
          <section className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-xl shadow-primary/10 backdrop-blur">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{t('employer.welcomeSlug')}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{t('employer.welcomeSlugHint')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="rounded-xl bg-surface-container px-4 py-3 font-mono text-sm font-bold">{slug || '...'}</code>
              <button
                type="button"
                onClick={() => void copySlug()}
                className="rounded-full border border-outline/25 bg-surface px-4 py-2 text-sm font-bold text-primary"
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['pin_drop', t('employer.welcomeStepSite'), '/employer/sites'],
          ['event', t('employer.welcomeStepSchedule'), '/employer/schedules'],
          ['group_add', t('employer.welcomeStepEmployee'), '/employer/employees'],
          ['mobile_friendly', t('employer.welcomeStepPunch'), '/employee/login'],
        ].map(([icon, label, to], index) => (
          <Link
            key={label}
            to={to}
            className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-sm hover:border-primary/25"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-primary">
              <span className="material-symbols-outlined">{icon}</span>
            </span>
            <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">0{index + 1}</p>
            <h3 className="mt-1 font-bold text-on-surface">{label}</h3>
          </Link>
        ))}
      </section>

      <Link to="/employer" className="inline-flex items-center gap-2 text-sm font-bold text-primary underline">
        {t('common.back')}
      </Link>
    </div>
  );
}
