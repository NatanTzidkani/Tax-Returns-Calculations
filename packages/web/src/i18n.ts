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
        reviewLink: 'בדיקה ואישור',
      },
      documentReview: {
        title: 'בדיקת מסמך',
        backToYear: 'חזרה לשנת המס',
        filePanel: 'מסמך המקור',
        filePreview: 'תצוגת המסמך {{filename}}',
        openFile: 'פתיחת הקובץ',
        zoomIn: 'הגדלה',
        zoomOut: 'הקטנה',
        formPanel: 'נתוני המסמך',
        pendingHint:
          'המסמך טרם עבר חילוץ נתונים. אפשר להפעיל חילוץ אוטומטי או להזין את הנתונים ידנית.',
        extract: 'חילוץ נתונים',
        retryExtract: 'ניסיון חילוץ חוזר',
        extractFailed: 'החילוץ נכשל: {{error}}',
        extractRequestError: 'הפעלת החילוץ נכשלה',
        manualEntry: 'הזנה ידנית',
        uncertainLegend:
          'שדות מסומנים בכתום: החילוץ לא היה בטוח בהם — יש להשוות מול המסמך.',
        confirm: 'אישור הנתונים',
        confirmError: 'אישור הנתונים נכשל',
        invalidForm: 'הנתונים שהוזנו אינם תקינים — יש לבדוק את השדות ולנסות שוב.',
        confirmedNote: 'המסמך אושר. הנתונים המאושרים מוצגים לקריאה בלבד.',
        editConfirmed: 'עריכה ואישור מחדש',
        otherKindNote:
          'למסמך מסוג "אחר" אין נתונים לחילוץ או לאישור — הקובץ מוצג לעיון בלבד.',
        fields: {
          taxYear: 'שנת מס',
          employerName: 'שם המעסיק',
          employerDeductionsFileId: 'תיק ניכויים',
          employeeNationalId: 'תעודת זהות העובד',
          brokerName: 'שם הבנק/הברוקר',
          accountId: 'מספר חשבון',
          realGainsAgorot: 'רווח הון ריאלי (בש"ח)',
          realLossesAgorot: 'הפסד הון ריאלי (בש"ח)',
          interestDividendAgorot: 'ריבית ודיבידנד מניירות ערך (בש"ח)',
          taxWithheldAgorot: 'מס שנוכה בשוק ההון (בש"ח)',
          institutionName: 'שם המוסד',
          institutionRegistrationId: 'מספר עמותה',
          receiptNumber: 'מספר קבלה',
          amount: 'סכום התרומה (בש"ח)',
          donationDate: 'תאריך התרומה',
          hasSection46Approval: 'אישור לפי סעיף 46',
        },
        boxes: {
          title: 'תיבות הטופס',
          codeLabel: 'קוד תיבה',
          amountLabel: 'סכום (בש"ח)',
          add: 'הוספת תיבה',
          remove: 'הסרת תיבה',
          bare: 'תיבה {{code}}',
          labeled: 'תיבה {{code}} — {{label}}',
        },
        // Only box codes documented in packages/shared/src/documents/form106.ts;
        // every other code renders as the bare "תיבה NNN".
        boxCodes: {
          '158': 'שכר/הכנסה ברוטו',
          '042': 'מס הכנסה שנוכה',
          '045': 'תגמולי עובד לקופת גמל',
        },
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
