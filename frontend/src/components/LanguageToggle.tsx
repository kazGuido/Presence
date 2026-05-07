import { useTranslation } from 'react-i18next';
import { setPresenceLanguage } from '../i18n';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const lng = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const next = lng === 'fr' ? 'en' : 'fr';

  return (
    <button
      type="button"
      onClick={() => setPresenceLanguage(next)}
      className={`pressable-sm rounded-full border border-outline/20 bg-surface-container px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant transition hover:border-primary/30 hover:text-primary ${className}`}
      title={t('common.switchLanguage')}
    >
      {lng === 'fr' ? 'FR' : 'EN'} → {next.toUpperCase()}
    </button>
  );
}
