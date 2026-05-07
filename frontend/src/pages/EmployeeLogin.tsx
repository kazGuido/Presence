import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, setEmployeeToken } from '../api/client';

type Tab = 'pin' | 'otp' | 'magic';

export function EmployeeLogin() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('magic');
  const [companySlug, setCompanySlug] = useState('demo-corp');
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('1234');
  const [otpCode, setOtpCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onPinSubmit = async (e: FormEvent) => {
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
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const onOtpRequest = async () => {
    setErr(null);
    setInfo(null);
    try {
      await apiFetch('/api/auth/employee-otp/request', {
        method: 'POST',
        body: JSON.stringify({ company_slug: companySlug, employee_id: employeeId }),
        token: null,
      });
      setInfo(t('employee.loginOtpHint'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const onOtpVerify = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch('/api/auth/employee-otp/verify', {
        method: 'POST',
        body: JSON.stringify({ company_slug: companySlug, employee_id: employeeId, code: otpCode }),
        token: null,
      });
      const data = (await res.json()) as { access_token: string };
      setEmployeeToken(data.access_token);
      nav('/employee/loading');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-primary">{t('employee.loginTitle')}</h1>
      <div className="mb-6 flex gap-2 rounded-xl border border-outline/15 bg-surface-container-low p-1">
        {(['magic', 'otp', 'pin'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              setErr(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              tab === k ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {k === 'magic' ? t('employee.loginTabMagic') : k === 'otp' ? t('employee.loginTabOtp') : t('employee.loginTabPin')}
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <input
          className="w-full rounded border border-outline/30 px-3 py-2"
          placeholder={t('employee.loginSlug')}
          value={companySlug}
          onChange={(e) => setCompanySlug(e.target.value)}
        />
        <input
          className="w-full rounded border border-outline/30 px-3 py-2 font-mono text-sm"
          placeholder={t('employee.loginId')}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
      </div>

      {tab === 'pin' && (
        <form onSubmit={(e) => void onPinSubmit(e)} className="space-y-4">
          <input
            className="w-full rounded border border-outline/30 px-3 py-2"
            placeholder={t('employee.loginPin')}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {err && <p className="text-sm text-error">{err}</p>}
          <button type="submit" className="w-full rounded-lg bg-primary py-3 text-on-primary">
            {t('employee.loginSubmit')}
          </button>
        </form>
      )}

      {tab === 'otp' && (
        <form onSubmit={(e) => void onOtpVerify(e)} className="space-y-4">
          <p className="text-sm text-on-surface-variant">{t('employee.loginOtpHint')}</p>
          <button type="button" onClick={() => void onOtpRequest()} className="w-full rounded-lg border border-primary py-2 text-sm font-medium text-primary">
            {t('employee.loginOtpRequest')}
          </button>
          <input
            className="w-full rounded border border-outline/30 px-3 py-2"
            placeholder={t('employee.loginOtpCode')}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
          />
          {err && <p className="text-sm text-error">{err}</p>}
          {info && <p className="text-sm text-primary">{t('employee.loginMagicSent')}</p>}
          <button type="submit" className="w-full rounded-lg bg-primary py-3 text-on-primary">
            {t('employee.loginOtpVerify')}
          </button>
        </form>
      )}

      {tab === 'magic' && (
        <div className="space-y-3 rounded-xl border border-outline/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
          <p>{t('employee.loginMagicHint')}</p>
          <p className="text-xs">{t('employee.loginDemoHint')}</p>
          <p className="text-xs text-on-surface-variant/80">
            Magic links are sent by your employer from the team page (&quot;{t('employer.employeesSendMagic')}&quot;).
          </p>
        </div>
      )}

      {tab !== 'magic' && (
        <p className="mt-6 text-center text-sm text-on-surface-variant">{t('employee.loginDemoHint')}</p>
      )}
    </div>
  );
}
