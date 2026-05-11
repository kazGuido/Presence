import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../components/LanguageToggle';
import { apiFetch, setEmployeeToken } from '../api/client';

type Tab = 'magic' | 'password';

export function EmployeeLogin() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = useMemo(() => {
    const next = searchParams.get('next');
    if (next && next.startsWith('/employee') && !next.includes('//')) {
      return next;
    }
    return '/employee/loading';
  }, [searchParams]);
  const [tab, setTab] = useState<Tab>('magic');
  const [companySlug, setCompanySlug] = useState('demo-corp');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('1234');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/auth/employee-login', {
        method: 'POST',
        body: JSON.stringify({ company_slug: companySlug, employee_id: employeeId, password }),
        token: null,
      });
      const data = (await res.json()) as { access_token: string };
      setEmployeeToken(data.access_token);
      nav(afterLogin, { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const onMagicRequest = async () => {
    setErr(null);
    setInfo(null);
    try {
      await apiFetch('/api/auth/employee-magic/request', {
        method: 'POST',
        body: JSON.stringify({ company_slug: companySlug, employee_id: employeeId }),
        token: null,
      });
      setInfo(t('employee.loginMagicSent'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(76,86,177,0.18),transparent_30rem),linear-gradient(135deg,#f8fbff,#fff7ed)] px-4 py-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="hex-clip flex h-11 w-9 items-center justify-center bg-primary text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              badge
            </span>
          </div>
          <div>
            <p className="text-lg font-black">Presence</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">{t('employee.loginBadge')}</p>
          </div>
        </Link>
        <LanguageToggle />
      </header>

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-7 shadow-2xl shadow-primary/10 backdrop-blur md:p-8">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{t('employee.loginBadge')}</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] text-on-surface md:text-5xl">
            {t('employee.loginTitle')}
          </h1>
          <p className="mt-4 text-lg leading-8 text-on-surface-variant">{t('employee.loginSubtitle')}</p>

          <div className="mt-8 space-y-3">
            {[
              ['mark_email_read', t('employee.loginStepInvite')],
              ['passkey', t('employee.loginStepChoose')],
              ['touch_app', t('employee.loginStepPunch')],
            ].map(([icon, label], index) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary">
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">0{index + 1}</p>
                  <p className="text-sm font-semibold text-on-surface">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-primary p-5 text-on-primary shadow-xl shadow-primary/20">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <span className="material-symbols-outlined">support_agent</span>
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-white/75">{t('employee.loginAssistantTitle')}</p>
                <p className="mt-1 text-sm leading-6 text-white/90">{t('employee.loginAssistantBody')}</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-outline/10 bg-surface-container-lowest p-6 shadow-xl shadow-primary/10 md:p-8">
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{t('employee.loginCardKicker')}</p>
            <h2 className="mt-2 text-2xl font-black text-on-surface">{t('employee.loginCardTitle')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('employee.loginCardBody')}</p>
          </div>

          <div className="mb-6 flex gap-2 rounded-2xl border border-outline/15 bg-surface-container-low p-1">
            {(['magic', 'password'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setErr(null);
                  setInfo(null);
                }}
                className={`pressable flex-1 rounded-xl py-2.5 text-sm font-bold ${
                  tab === k ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {k === 'magic' ? t('employee.loginTabMagic') : t('employee.loginTabPassword')}
              </button>
            ))}
          </div>

          <div className="mb-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
              placeholder={t('employee.loginSlug')}
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 font-mono text-sm outline-none ring-primary/20 focus:ring-4"
              placeholder={t('employee.loginId')}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>

          {tab === 'password' && (
            <form onSubmit={(e) => void onPasswordSubmit(e)} className="space-y-4">
              <input
                type="password"
                className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
                placeholder={t('employee.loginPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
              <button type="submit" className="pressable w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20">
                {t('employee.loginSubmit')}
              </button>
            </form>
          )}

          {tab === 'magic' && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-primary-container/30 px-4 py-3 text-sm leading-6 text-on-surface-variant">
                {t('employee.loginMagicHint')}
              </p>
              <button type="button" onClick={() => void onMagicRequest()} className="pressable w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20">
                {t('employee.loginMagicSend')}
              </button>
              {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
              {info && <p className="rounded-xl bg-primary-container/50 px-3 py-2 text-sm text-primary">{t('employee.loginMagicSent')}</p>}
              <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary-container/25 p-4 text-sm text-on-surface-variant">
                <p>{t('employee.loginMagicEmployerNote')}</p>
                <p className="text-xs">{t('employee.loginDemoHint')}</p>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface">{t('employee.loginManualTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">{t('employee.loginManualBody')}</p>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface">{t('employee.loginHelpTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">{t('employee.loginHelpBody')}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
