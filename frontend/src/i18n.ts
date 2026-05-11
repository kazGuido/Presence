import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

const STORAGE_KEY = 'presence_lang';

function detectLng(): string {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'en' || s === 'fr') return s;
  } catch {
    /* ignore */
  }
  return 'fr';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: detectLng(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export function setPresenceLanguage(lng: 'en' | 'fr') {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lng);
}

export default i18n;
