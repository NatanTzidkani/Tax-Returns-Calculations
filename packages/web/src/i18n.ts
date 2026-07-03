import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const resources = {
  he: {
    translation: {
      dashboard: {
        title: 'שנות מס',
      },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'he',
  fallbackLng: 'he',
  interpolation: { escapeValue: false },
});

export default i18n;
