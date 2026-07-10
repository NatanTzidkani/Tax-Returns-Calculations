import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const resources = {
  he: {
    translation: {
      app: {
        title: 'דוח שנתי',
      },
      common: {
        loading: 'טוען…',
        loadError: 'אירעה שגיאה בטעינת הנתונים',
        none: '—',
      },
      taxYearStatus: {
        draft: 'טיוטה',
        in_review: 'בבדיקה',
        ready_to_file: 'מוכן להגשה',
        filed: 'הוגש',
        amended: 'מתוקן',
      },
      extractionStatus: {
        pending: 'ממתין לחילוץ',
        extracted: 'חולץ',
        confirmed: 'אושר',
        failed: 'נכשל',
      },
      documentKind: {
        form106: 'טופס 106',
        form867: 'טופס 867',
        charity_receipt: 'קבלת תרומה (סעיף 46)',
        other: 'אחר',
      },
      dashboard: {
        title: 'שנות מס',
        empty: 'אין עדיין שנות מס. הוסיפו שנה כדי להתחיל.',
        columnYear: 'שנה',
        columnStatus: 'סטטוס',
        columnDeadline: 'מועד הגשה',
        columnRefund: 'החזר משוער',
        addYearTitle: 'הוספת שנת מס',
        addYearLabel: 'שנה',
        addYearSubmit: 'הוספה',
        addYearError: 'הוספת שנת המס נכשלה',
      },
      taxYearDetail: {
        title: 'שנת מס {{year}}',
        titleUnknown: 'שנת מס',
        documentsPanel: 'מסמכים',
        dataPanel: 'נתונים',
        calculationPanel: 'חישוב',
        noDocuments: 'אין מסמכים עדיין',
        uploadTitle: 'העלאת מסמך',
        uploadFileLabel: 'קובץ',
        uploadKindLabel: 'סוג מסמך',
        uploadSubmit: 'העלאה',
        uploadError: 'העלאת המסמך נכשלה',
        dataPlaceholder: 'הנתונים המאושרים יוצגו כאן לאחר אישור המסמכים',
        calculationPlaceholder: 'דף החישוב המלא יוצג כאן לאחר אישור הנתונים',
        backToDashboard: 'חזרה לשנות המס',
      },
      auth: {
        signInTitle: 'התחברות',
        signInSubtitle: 'התחברו עם חשבון Google כדי להמשיך',
        signInError: 'ההתחברות נכשלה. נסו שוב.',
        signedInAs: 'מחובר/ת בתור {{email}}',
        signOut: 'התנתקות',
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
