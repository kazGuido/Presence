import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, setEmployeeToken } from '../api/client';

export function EmployeeMagic() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const next = params.get('next');
    const afterLogin =
      next && next.startsWith('/employee') && !next.includes('//') ? next : '/employee/loading';
    if (!token) {
      setErr(t('employee.scanNoToken'));
      return;
    }
    void apiFetch('/api/auth/employee-magic/consume', {
      method: 'POST',
      body: JSON.stringify({ token }),
      token: null,
    })
      .then(async (r) => (await r.json()) as { access_token: string })
      .then((d) => {
        setEmployeeToken(d.access_token);
        nav(afterLogin, { replace: true });
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [params, nav, t]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-on-surface-variant">{err ? err : t('common.loading')}</p>
    </div>
  );
}
