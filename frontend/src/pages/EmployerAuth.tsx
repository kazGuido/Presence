import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, setEmployerToken } from '../api/client';

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
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-primary">{t('auth.employerLoginTitle')}</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <input
          className="w-full rounded border border-outline/30 px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-outline/30 px-3 py-2"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-sm text-error">{err}</p>}
        <button type="submit" className="w-full rounded-lg bg-primary py-3 text-on-primary">
          Se connecter
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/employer/register" className="text-primary underline">
          {t('auth.employerRegisterLink')}
        </Link>
      </p>
    </div>
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
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-primary">{t('auth.employerRegisterTitle')}</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <input className="w-full rounded border px-3 py-2" placeholder="Nom entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Votre nom" value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full rounded border px-3 py-2" placeholder="Mot de passe (8+)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-error">{err}</p>}
        <button type="submit" className="w-full rounded-lg bg-primary py-3 text-on-primary">
          S&apos;inscrire
        </button>
      </form>
    </div>
  );
}
