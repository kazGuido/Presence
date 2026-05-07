import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setEmployeeToken } from '../api/client';

export function EmployeeLogin() {
  const nav = useNavigate();
  const [companySlug, setCompanySlug] = useState('demo-corp');
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('1234');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/auth/employee-login', {
        method: 'POST',
        body: JSON.stringify({ company_slug: companySlug, employee_id: employeeId, pin }),
        token: null,
      });
      const data = (await res.json()) as { access_token: string };
      setEmployeeToken(data.access_token);
      nav('/employee/loading');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-primary">Connexion employé</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <input className="w-full rounded border px-3 py-2" placeholder="Slug entreprise" value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="ID employé (UUID)" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        {err && <p className="text-sm text-error">{err}</p>}
        <button type="submit" className="w-full rounded-lg bg-primary py-3 text-on-primary">
          Continuer
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        DEMO_SEED: slug <code>demo-corp</code>, copiez l&apos;UUID employé depuis le portail employeur.
      </p>
    </div>
  );
}
