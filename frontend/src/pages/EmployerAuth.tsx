import { FormEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../components/LanguageToggle';
import { apiFetch, setEmployerToken } from '../api/client';

function AuthShell({
  title,
  subtitle,
  children,
  side = 'login',
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  side?: 'login' | 'register';
}) {
  const { t } = useTranslation();
  const steps = [
    t('auth.onboardingStepCompany'),
    t('auth.onboardingStepTeam'),
    t('auth.onboardingStepInvite'),
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(76,86,177,0.16),transparent_30rem),linear-gradient(135deg,#f8fbff,#fff7ed)] px-4 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="hex-clip flex h-11 w-9 items-center justify-center bg-primary text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              domain
            </span>
          </div>
          <div>
            <p className="text-lg font-black">Presence</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">{t('landing.brandKicker')}</p>
          </div>
        </Link>
        <LanguageToggle />
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-2xl shadow-primary/10 backdrop-blur">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
            {side === 'register' ? t('auth.companyOnboarding') : t('auth.secureWorkspace')}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] text-on-surface md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-on-surface-variant">{subtitle}</p>

          <div className="mt-8 space-y-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-black text-on-primary">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold text-on-surface">{step}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-[2rem] border border-outline/10 bg-surface-container-lowest p-6 shadow-xl shadow-primary/10 md:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}

export function EmployerLogin() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        token: null,
      });
      const data = (await res.json()) as { access_token: string };
      setEmployerToken(data.access_token);
      nav('/employer');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <AuthShell title={t('auth.employerLoginTitle')} subtitle={t('auth.employerLoginSubtitle')} side="login">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{t('auth.loginKicker')}</p>
          <h2 className="mt-2 text-2xl font-black text-on-surface">{t('auth.loginCardTitle')}</h2>
        </div>
        <input
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
        <button type="submit" className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20">
          {t('auth.signIn')}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-on-surface-variant">
        {t('auth.noAccount')}{' '}
        <Link to="/employer/register" className="text-primary underline">
          {t('auth.employerRegisterLink')}
        </Link>
      </p>
    </AuthShell>
  );
}

export function EmployerRegister() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          company_name: companyName,
          employer_name: employerName,
          employer_email: email,
          password,
        }),
        token: null,
      });
      const data = (await res.json()) as { access_token: string };
      setEmployerToken(data.access_token);
      nav('/employer/welcome');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <AuthShell title={t('auth.employerRegisterTitle')} subtitle={t('auth.employerRegisterSubtitle')} side="register">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{t('auth.registerKicker')}</p>
          <h2 className="mt-2 text-2xl font-black text-on-surface">{t('auth.registerCardTitle')}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{t('auth.registerCardSubtitle')}</p>
        </div>
        <input
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.companyName')}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.yourName')}
          value={employerName}
          onChange={(e) => setEmployerName(e.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none ring-primary/20 focus:ring-4"
          placeholder={t('auth.passwordCreate')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{err}</p>}
        <button type="submit" className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20">
          {t('auth.createCompany')}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-on-surface-variant">
        {t('auth.hasAccount')}{' '}
        <Link to="/employer/login" className="text-primary underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
