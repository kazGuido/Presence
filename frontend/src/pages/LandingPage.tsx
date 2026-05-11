import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../components/LanguageToggle';

const metrics = [
  { value: '3 min', labelKey: 'landing.metricSetup' },
  { value: 'GPS + QR', labelKey: 'landing.metricChannels' },
  { value: 'CSV', labelKey: 'landing.metricExports' },
];

const features = [
  {
    icon: 'location_on',
    titleKey: 'landing.featureGeofenceTitle',
    bodyKey: 'landing.featureGeofenceBody',
  },
  {
    icon: 'groups',
    titleKey: 'landing.featureOnboardingTitle',
    bodyKey: 'landing.featureOnboardingBody',
  },
  {
    icon: 'fact_check',
    titleKey: 'landing.featureReviewTitle',
    bodyKey: 'landing.featureReviewBody',
  },
];

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen overflow-hidden bg-surface text-on-surface">
      <section className="relative border-b border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(76,86,177,0.18),transparent_32rem),linear-gradient(135deg,#f8fbff_0%,#eef4ff_48%,#fff7ed_100%)]">
        <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="hex-clip flex h-12 w-10 items-center justify-center bg-primary text-on-primary shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Presence</p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
                {t('landing.brandKicker')}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              to="/employer/login"
              className="hidden rounded-full border border-outline/20 bg-white/70 px-4 py-2 text-sm font-semibold text-on-surface shadow-sm backdrop-blur hover:border-primary/30 sm:inline-flex"
            >
              {t('landing.login')}
            </Link>
            <Link
              to="/employer/register"
              className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 hover:opacity-95"
            >
              {t('landing.start')}
            </Link>
          </div>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.05fr_0.95fr] md:px-6 md:pb-24 md:pt-16">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary shadow-sm backdrop-blur">
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              {t('landing.badge')}
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-0.04em] text-on-surface md:text-6xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-on-surface-variant md:text-xl">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/employer/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-xl shadow-primary/20 hover:opacity-95"
              >
                {t('landing.primaryCta')}
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
              <Link
                to="/employer/login"
                className="inline-flex items-center justify-center rounded-2xl border border-outline/20 bg-white/75 px-6 py-4 text-base font-bold text-on-surface shadow-sm backdrop-blur hover:border-primary/30"
              >
                {t('landing.secondaryCta')}
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {metrics.map((metric) => (
                <div key={metric.labelKey} className="rounded-2xl border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur">
                  <p className="text-xl font-black text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs font-medium text-on-surface-variant">{t(metric.labelKey)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden rounded-3xl bg-white/80 p-4 shadow-2xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur md:block">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t('landing.liveCardLabel')}</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">96%</p>
              <p className="text-xs text-on-surface-variant">{t('landing.liveCardBody')}</p>
            </div>
            <div className="rounded-[2rem] border border-white/70 bg-white/75 p-3 shadow-2xl shadow-primary/15 backdrop-blur">
              <div className="overflow-hidden rounded-[1.5rem] border border-outline/10 bg-surface-container-lowest">
                <div className="flex items-center justify-between border-b border-outline/10 bg-surface-container-low px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">{t('landing.mockHeader')}</p>
                    <p className="font-bold">{t('landing.mockTitle')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-700/20">
                    {t('landing.mockStatus')}
                  </span>
                </div>
                <div className="space-y-4 p-5">
                  {[
                    ['Awa Diop', '08:02', 'OK', 'emerald'],
                    ['Moussa Kone', '08:17', t('landing.mockReview'), 'amber'],
                    ['Nadia Traore', '08:00', 'OK', 'emerald'],
                  ].map(([name, time, status, tone]) => (
                    <div key={name} className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
                      <div className="hex-clip flex h-11 w-9 items-center justify-center bg-primary text-sm font-black text-on-primary">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-on-surface-variant">{t('landing.mockClockIn')} {time}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          tone === 'emerald'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/15'
                            : 'bg-secondary-container text-on-secondary-container ring-1 ring-secondary/25'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">{t('landing.sectionKicker')}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{t('landing.sectionTitle')}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.titleKey}
              className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-sm"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-primary">
                <span className="material-symbols-outlined">{feature.icon}</span>
              </div>
              <h3 className="text-xl font-bold">{t(feature.titleKey)}</h3>
              <p className="mt-3 leading-7 text-on-surface-variant">{t(feature.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
