import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';

type Site = {
  id: string;
  name: string;
};

type DraftEmployee = {
  display_name: string;
  email: string;
  phone_e164: string;
  pin: string;
  default_work_site_id: string;
};

type CreatedEmployee = {
  employee: {
    id: string;
    display_name: string;
    email: string | null;
  };
  invite: {
    sent: boolean;
    channel: string | null;
    message: string | null;
  };
};

const sampleRows = `Awa Diop,awa@example.com,+2250102030405,1234
Moussa Kone,moussa@example.com,+2250506070809,1234`;

function splitRow(row: string): string[] {
  const delimiter = row.includes('\t') ? '\t' : row.includes(';') ? ';' : ',';
  return row.split(delimiter).map((cell) => cell.trim());
}

function parseRows(text: string, fallbackPin: string): DraftEmployee[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .filter((row, index) => !(index === 0 && /name|nom|display/i.test(row) && /email|e-mail/i.test(row)))
    .map((row) => {
      const [displayName, email = '', phone = '', pin = fallbackPin] = splitRow(row);
      return {
        display_name: displayName,
        email,
        phone_e164: phone,
        pin: pin || fallbackPin,
        default_work_site_id: '',
      };
    })
    .filter((row) => row.display_name);
}

export function BatchEmployeeWizard({
  sites,
  onCreated,
}: {
  sites: Site[];
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [raw, setRaw] = useState(sampleRows);
  const [fallbackPin, setFallbackPin] = useState('1234');
  const [defaultSiteId, setDefaultSiteId] = useState('');
  const [sendInvites, setSendInvites] = useState(true);
  const [results, setResults] = useState<CreatedEmployee[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const drafts = useMemo(() => parseRows(raw, fallbackPin), [raw, fallbackPin]);
  const withDefaults = drafts.map((draft) => ({ ...draft, default_work_site_id: defaultSiteId }));
  const canSubmit = withDefaults.length > 0 && withDefaults.every((row) => row.display_name && row.pin.length >= 4);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    setResults(null);
    try {
      const response = await apiFetch('/api/employees/batch', {
        method: 'POST',
        body: JSON.stringify({
          send_invites: sendInvites,
          employees: withDefaults.map((row) => ({
            display_name: row.display_name,
            email: row.email || null,
            phone_e164: row.phone_e164 || null,
            pin: row.pin,
            default_work_site_id: row.default_work_site_id || null,
          })),
        }),
      });
      const payload = (await response.json()) as { created: CreatedEmployee[] };
      setResults(payload.created);
      setStep(3);
      onCreated();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-surface-container-lowest to-secondary-container/25 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-col gap-4 px-5 py-5 text-left md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">group_add</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
              {t('employer.batchKicker')}
            </p>
            <h2 className="mt-1 text-xl font-black text-on-surface">{t('employer.batchTitle')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{t('employer.batchSubtitle')}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-bold text-primary shadow-sm">
          {open ? t('employer.batchCollapse') : t('employer.batchOpen')}
          <span className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </span>
      </button>

      {open && (
        <form onSubmit={(e) => void submit(e)} className="border-t border-primary/10 bg-white/55 p-5 backdrop-blur">
          <div className="mb-5 grid gap-3 text-sm font-semibold text-on-surface-variant sm:grid-cols-3">
            {[1, 2, 3].map((number) => (
              <div
                key={number}
                className={`rounded-2xl px-4 py-3 ${
                  step === number ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest'
                }`}
              >
                {number}. {t(`employer.batchStep${number}`)}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
              <div>
                <label className="text-sm font-bold text-on-surface">{t('employer.batchPasteLabel')}</label>
                <textarea
                  className="mt-2 min-h-56 w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 font-mono text-sm outline-none ring-primary/20 focus:ring-4"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                />
                <p className="mt-2 text-xs text-on-surface-variant">{t('employer.batchPasteHint')}</p>
              </div>
              <div className="space-y-4 rounded-2xl border border-outline/10 bg-surface-container-lowest p-4">
                <label className="block text-sm font-bold text-on-surface">
                  {t('employer.batchFallbackPin')}
                  <input
                    className="mt-2 w-full rounded-xl border border-outline/20 bg-surface px-3 py-2.5 font-mono"
                    value={fallbackPin}
                    onChange={(e) => setFallbackPin(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-bold text-on-surface">
                  {t('employer.batchDefaultSite')}
                  <select
                    className="mt-2 w-full rounded-xl border border-outline/20 bg-surface px-3 py-2.5"
                    value={defaultSiteId}
                    onChange={(e) => setDefaultSiteId(e.target.value)}
                  >
                    <option value="">{t('employer.employeesDefaultSite')}</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-3 rounded-xl bg-surface-container px-3 py-3 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={sendInvites}
                    onChange={(e) => setSendInvites(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <strong>{t('employer.batchSendInvites')}</strong>
                    <span className="mt-1 block text-xs text-on-surface-variant">{t('employer.batchSendInvitesHint')}</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-outline/10 bg-surface-container-lowest">
                <div className="grid grid-cols-[1.2fr_1.2fr_1fr_0.6fr] gap-3 border-b border-outline/10 px-4 py-3 text-xs font-black uppercase tracking-wide text-on-surface-variant">
                  <span>{t('employer.employeesDisplayName')}</span>
                  <span>{t('employer.employeesEmailOpt')}</span>
                  <span>{t('employer.employeesPhoneOpt')}</span>
                  <span>{t('employer.employeesPin')}</span>
                </div>
                {withDefaults.map((row, index) => (
                  <div
                    key={`${row.display_name}-${index}`}
                    className="grid grid-cols-[1.2fr_1.2fr_1fr_0.6fr] gap-3 border-b border-outline/5 px-4 py-3 text-sm last:border-0"
                  >
                    <span className="font-semibold">{row.display_name}</span>
                    <span className="truncate text-on-surface-variant">{row.email || '—'}</span>
                    <span className="truncate text-on-surface-variant">{row.phone_e164 || '—'}</span>
                    <span className="font-mono">{row.pin}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-on-surface-variant">
                {t('employer.batchReviewCount', { count: withDefaults.length })}
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {results?.map((row) => (
                <div
                  key={row.employee.id}
                  className="flex flex-col gap-3 rounded-2xl border border-outline/10 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold">{row.employee.display_name}</p>
                    <p className="font-mono text-xs text-on-surface-variant">{row.employee.id}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                      row.invite.sent
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-700/20'
                        : 'bg-secondary-container text-on-secondary-container ring-secondary/20'
                    }`}
                  >
                    {row.invite.sent ? t('employer.batchInviteSent') : row.invite.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {err && (
            <div className="mt-4 rounded-xl border border-error/25 bg-error-container/40 px-4 py-3 text-sm text-error">
              {err}
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((value) => (value > 1 ? ((value - 1) as 1 | 2 | 3) : value))}
              disabled={step === 1 || loading}
              className="rounded-xl border border-outline/25 bg-surface px-5 py-2.5 text-sm font-bold text-on-surface disabled:opacity-40"
            >
              {t('common.back')}
            </button>
            <div className="flex gap-2">
              {step < 2 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!drafts.length}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-40"
                >
                  {t('common.continue')}
                </button>
              )}
              {step === 2 && (
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-40"
                >
                  {loading ? t('common.loading') : t('employer.batchCreate')}
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setRaw('');
                    setResults(null);
                    setStep(1);
                  }}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary"
                >
                  {t('employer.batchNewImport')}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
