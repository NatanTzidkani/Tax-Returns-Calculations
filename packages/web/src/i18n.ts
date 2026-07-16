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
        columnActions: 'פעולות',
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
        duplicateBox:
          'קוד התיבה {{code}} מופיע ביותר משורה אחת — יש לאחד את השורות הכפולות.',
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
      // --- Calculation worksheet panel (Plan 5) --------------------------
      worksheet: {
        empty: 'עדיין לא בוצע חישוב לשנת מס זו. מלאו את פרטי הנישום ולחצו על "חישוב".',
        genderLabel: 'מין',
        genderMale: 'זכר',
        genderFemale: 'נקבה',
        additionalPointsLabel: 'נקודות זיכוי נוספות',
        additionalPointsHelp:
          'השדות המובנים למטה מכסים ילדים (גילאי 0-18) לפי ההקשר ההורי, עולה חדש ותואר ראשון/שני/תעודת מקצוע. שדה זה נותר לכל השאר — מסלולי דוקטורט וסיום לימודים לפני 2014 — מזינים כאן סך כולל מאומת (בכפולות של 0.25).',
        calculateButton: 'חישוב',
        // --- Stored taxpayer profile (pre-fill only; plan
        // 2026-07-14-taxpayer-profile.md). The profile never enters a
        // calculation server-side — the reviewer confirms everything.
        prefillNotice:
          'הטופס מולא מראש מהפרופיל השמור; גילאי הילדים נגזרו משנת הלידה עבור שנת מס זו. יש לאשר את כל הפרטים לפני החישוב.',
        prefillOmittedChildren:
          'ילדים שגילם מחוץ לטווח 0-18 בשנת מס זו הושמטו מהטופס ({{count}}).',
        saveProfileButton: 'שמור לפרופיל',
        profileSaved: 'פרטי הנישום נשמרו לפרופיל.',
        profileSaveFailed: 'שמירת הפרופיל נכשלה.',
        invalidPoints:
          'נקודות הזיכוי הנוספות חייבות להיות מספר לא שלילי בכפולות של 0.25',
        // --- Structured credit-point inputs (children §40 / oleh §35 /
        // degrees §40ג-§40ה). The shared Zod schema owns the SHAPE; the
        // engine owns the LAW and its Hebrew errors surface in the form.
        childrenTitle: 'ילדים (סעיף 40)',
        childAgeLabel: 'גיל בשנת המס',
        // Parent-allocation regime picker (§66(ג)/§40(ב)/§40א, il-0.6.0;
        // all six regimes compute since il-0.7.0). The regime is a filer-
        // level declaration; the LAW (schedules, guards) is the ENGINE's
        // rule — its Hebrew 400s surface in the form.
        parentRegimeLabel: 'הקשר הורי (סעיפים 40(ב)/66(ג))',
        parentRegimePlaceholder: 'בחרו הקשר הורי',
        parentRegime: {
          marriedRegisteredSpouse: 'בן/בת הזוג הרשום/ה — §66(ג)(4)',
          marriedOtherSpouse: 'בן הזוג השני — §66(ג)(5)',
          singleParent: 'משפחה חד-הורית (הורה יחיד)',
          singleFather: 'אב במשפחה חד-הורית — §40(ב)(1א)',
          separatedEntitled: 'הורה פרוד — הזכאי',
          separatedNonEntitled: 'הורה פרוד — שאינו זכאי',
        },
        parentRegimeHelp:
          'ההקשר ההורי קובע לפי איזה סעיף בפקודה מוקצות נקודות הזיכוי בגין הילדים.',
        parentReceivesAllowanceLabel:
          'מקבל/ת קצבת ילדים מהמוסד לביטוח לאומי (סעיף 66(ג)(3))',
        parentMaintenanceRemarriedLabel:
          'גרוש/ה המשלם/ת מזונות ונשוי/אה בשנית (סעיף 40א)',
        parentSeparateCalculationLabel: 'חישוב נפרד (סעיף 66(ג)(1))',
        parentMotherClaimsLabel: 'אם הילד זכאית לנקודות לפי סעיף 40(ב)(1)',
        childMaintenanceShareLabel: 'חלק בהוצאות הכלכלה (0-1)',
        childDeferBirthYearLabel: 'דחיית נקודת שנת הלידה (טופס 116ד)',
        childClaimDeferredLabel: 'נקודה שנדחתה משנה קודמת (טופס 116ד)',
        addChild: 'הוספת ילד',
        removeChild: 'הסרת ילד',
        childrenHelp:
          'כל הגילאים 0-18 מחושבים אוטומטית לפי ההקשר ההורי (מספר הנקודות לפי גיל אומת מול ס"ח 3184 והוראות רשות המסים).',
        invalidChildren:
          'פרטי הילדים אינם תקינים — יש לבדוק את הגיל, את חלק הכלכלה (בין 0 ל-1) ואת שדות ההקשר ההורי.',
        aliyahToggle: 'עלייה לישראל (סעיף 35)',
        aliyahYearLabel: 'שנת העלייה',
        aliyahMonthLabel: 'חודש העלייה',
        aliyahVariantLabel: 'מסלול הזיכוי',
        aliyahVariantPre2022: 'עלייה לפני 1.1.2022',
        aliyahVariantFrom2022: 'עלייה מ-1.1.2022',
        invalidAliyah:
          'פרטי העלייה אינם תקינים — יש להזין שנת עלייה (מספר שלם), חודש ומסלול.',
        degreesTitle: 'תארים ותעודות מקצוע (סעיפים 40ג-40ה)',
        degreeTrackLabel: 'מסלול',
        degreeTrackBachelor: 'תואר ראשון',
        degreeTrackMaster: 'תואר שני',
        degreeTrackVocational: 'תעודת מקצוע',
        degreeCompletionYearLabel: 'שנת סיום הלימודים',
        degreeStudyYearsLabel: 'שנות הלימוד',
        degreeElectedYearLabel: 'שנת הזיכוי שנבחרה',
        degreeInternshipToggle: 'התמחות (טופס 119)',
        degreeInternshipStartLabel: 'שנת תחילת ההתמחות',
        degreeInternshipEndLabel: 'שנת סיום ההתמחות',
        addDegree: 'הוספת תואר',
        removeDegree: 'הסרת תואר',
        invalidDegrees:
          'פרטי התארים אינם תקינים — יש לבדוק שנת סיום, שנות לימוד, שנת זיכוי ושנות התמחות.',
        nonLinkedInterestInputLabel:
          'הכנסת ריבית על נכס שאינו צמוד מדד (15%) (₪)',
        nonLinkedInterestWithheldInputLabel: 'ניכוי במקור על הריבית (₪)',
        nonLinkedInterestInputHelp:
          'ריבית על פיקדון או תוכנית חיסכון שאינם צמודי מדד (סעיף 125ג, שדה 078; ניכוי במקור שדה 043) — מזינים בשקלים.',
        invalidInterest:
          'הכנסת הריבית והניכוי במקור חייבים להיות סכומים לא שליליים בשקלים',
        calculateError: 'החישוב נכשל',
        refund: 'החזר מס',
        owed: 'יתרה לתשלום',
        auditStamp: 'חושב בגרסת מנוע {{version}} בתאריך {{date}}',
        staleNotice:
          'הנתונים המאושרים עודכנו לאחר החישוב האחרון — יש לבצע חישוב מחדש.',
        carryInNote:
          'החישוב כולל הפסד הון מועבר משנים קודמות בסך {{amount}}. שימו לב: חישוב מחדש של שנה מוקדמת אינו מעדכן שנה זו אוטומטית — במקרה כזה יש לחשב שנה זו מחדש.',
        carryOutNote: 'הפסד הון בסך {{amount}} מועבר לקיזוז בשנים הבאות.',
        excludedDonationsNote:
          'תרומות שלא נכללו בחישוב בהיעדר אישור לפי סעיף 46: {{n}}',
        incomeTaxTitle: 'מס הכנסה — מדרגות המס',
        taxableIncome: 'הכנסה חייבת',
        bracketFrom: 'מסכום',
        bracketTo: 'עד סכום',
        bracketRate: 'שיעור המס',
        bracketTaxed: 'סכום במדרגה',
        bracketTax: 'מס',
        bracketOpenEnded: 'ומעלה',
        incomeTaxTotal: 'סך מס הכנסה לפני זיכויים',
        creditPointsTitle: 'נקודות זיכוי',
        // Fallback names per reason — the engine's per-row Hebrew `label`
        // (age band, degree year…) is the primary display when present.
        creditReason: {
          resident: 'תושב/ת ישראל',
          female: 'אישה',
          additional: 'נקודות נוספות (סך מאומת ידנית)',
          child: 'נקודות זיכוי בגין ילד (סעיף 40)',
          oleh: 'עולה חדש (סעיף 35)',
          degree: 'תואר אקדמי / תעודת מקצוע (סעיפים 40ג-40ה)',
          // Parent-allocation reasons (§66(ג)/§40(ב)/§40א, il-0.6.0).
          childAllowance: 'נקודות קצבת ילדים (סעיף 66(ג)(3))',
          singleParentBonus: 'נקודת זיכוי למשפחה חד-הורית (סעיף 40(ב)(1ב))',
          separatedBonus: 'נקודת זיכוי להורה פרוד זכאי (סעיף 40(ב)(2))',
          maintenanceShare: 'חלק בהוצאות כלכלת ילד (סעיף 40(ב)(2))',
          section40aBonus: 'משלם/ת מזונות שנישא/ה בשנית (סעיף 40א)',
          birthYearDeferral: 'דחיית נקודת שנת הלידה לשנה הבאה (טופס 116ד)',
        },
        creditPointsTotal: 'סך נקודות זיכוי',
        creditPointsValue: 'שווי נקודות הזיכוי',
        pensionTitle: 'זיכוי בגין קופת גמל (סעיף 45א)',
        pensionContributions: 'תגמולי עובד לקופת גמל (תיבה 045)',
        pensionQualifyingIncome: 'הכנסה מזכה',
        pensionContributionCap: 'תקרת הפקדה מזכה',
        pensionCredited: 'הפקדה מוכרת לזיכוי',
        pensionCredit: 'סכום הזיכוי',
        charityTitle: 'זיכוי בגין תרומות (סעיף 46)',
        charityTotal: 'סך התרומות',
        charityAppliedCeiling: 'תקרה שהוחלה',
        charityEligible: 'סכום מוכר לזיכוי',
        charityCredit: 'סכום הזיכוי',
        charityCarryforwardOut: 'עודף תרומות מועבר לשנים הבאות',
        charityBelowMinimum:
          'סך התרומות נמוך מהמינימום הקבוע בחוק — אין זיכוי תרומות השנה.',
        capitalTitle: 'רווח הון וניירות ערך (טופס 867)',
        capitalRealGains: 'רווחי הון ריאליים',
        capitalRealLosses: 'הפסדי הון ריאליים',
        capitalInterestDividend: 'ריבית ודיבידנד מניירות ערך',
        capitalCarryIn: 'הפסד מועבר משנים קודמות',
        capitalOffsetGains: 'הפסדים שקוזזו כנגד רווחים',
        capitalOffsetInterest: 'הפסדים שקוזזו כנגד ריבית ודיבידנד',
        capitalCarryConsumed: 'הפסד מועבר שנוצל השנה',
        capitalTaxableGain: 'רווח הון חייב',
        capitalTaxableInterest: 'ריבית ודיבידנד חייבים',
        capitalTax: 'מס רווח הון',
        capitalWithheld: 'מס שנוכה בשוק ההון',
        capitalCarryOut: 'הפסד מועבר לשנים הבאות',
        // 15% non-linked deposit/savings interest (§125ג(ג); Form 1301 field
        // 078, withholding 043) — a separate bucket from the securities 25%
        // interest/dividend above. Keyed by the engine's 'nonLinkedInterest'
        // audit-worksheet breakdown reason. See
        // docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md.
        nonLinkedInterest: 'ריבית על נכס שאינו צמוד מדד (15%)',
        nonLinkedInterestAmount: 'הכנסת ריבית (שדה 078)',
        nonLinkedInterestTax: 'מס (15%)',
        nonLinkedInterestWithheld: 'ניכוי במקור (שדה 043)',
        surtaxTitle: 'מס יסף',
        surtaxThreshold: 'סף החיוב',
        surtaxBase: 'בסיס החיוב',
        surtaxBasic: 'מס יסף בסיסי',
        surtaxCapitalBase: 'בסיס הוני מעל הסף',
        surtaxCapitalAdditional: 'תוספת מס יסף על מקורות הוניים',
        surtaxTotal: 'סך מס יסף',
        totalsTitle: 'סיכום',
        creditsApplied: 'זיכויים שנוצלו',
        creditsUnused: 'זיכויים שלא נוצלו',
        incomeTaxAfterCredits: 'מס הכנסה לאחר זיכויים',
        totalLiability: 'סך חבות המס',
        totalWithheld: 'סך המס שנוכה במקור',
      },
      // --- Filing view (Plan 5): Form 1301 transcription + year status flow.
      filing: {
        title: 'טופס 1301 — שנת מס {{year}}',
        titleUnknown: 'טופס 1301',
        backToYear: 'חזרה לשנת המס',
        linkFromDetail: 'טופס 1301 והגשה',
        noCalculation:
          'עדיין לא בוצע חישוב לשנת מס זו — יש להריץ חישוב במסך שנת המס לפני מילוי טופס 1301.',
        goToYear: 'למסך שנת המס',
        form1301Panel: 'שדות טופס 1301 (דין וחשבון שנתי)',
        ownerVerificationWarning:
          'קודי השדות של טופס 1301 אומתו מול הטופס הרשמי של רשות המסים (יולי 2026) — עם זאת, יש לוודא את הערכים מול המקור לפני ההגשה. לא להגיש בלי בדיקה.',
        staleWarning:
          'נתונים אושרו לאחר החישוב האחרון — יש להריץ את החישוב מחדש לפני ההגשה.',
        columnCode: 'קוד שדה',
        columnLabel: 'תיאור',
        columnValue: 'סכום',
        auditStamp: 'חושב בגרסת מנוע {{engineVersion}} בתאריך {{createdAt}}',
        statusPanel: 'סטטוס הדוח',
        filedAt: 'הוגש בתאריך {{date}}',
        statusUpdateError: 'עדכון הסטטוס נכשל',
        // Action label per TARGET status (only legal next steps are offered).
        transitions: {
          draft: 'החזרה לטיוטה',
          in_review: 'העברה לבדיקה',
          ready_to_file: 'סימון כמוכן להגשה',
          filed: 'סימון כהוגש',
          amended: 'פתיחת דוח מתקן',
        },
        // Labels per form1301Fields key from @taxreturns/tax-engine — the
        // screen renders the map generically (unknown keys fall back to the
        // raw key), so this list may trail the engine without breaking.
        form1301Labels: {
          '158': 'שכר/הכנסה ברוטו',
          '042': 'מס הכנסה שנוכה במקור ממשכורת ומשכר עבודה',
          '045': 'תגמולי עובד לקופת גמל',
          '037': 'תרומות למוסדות ציבור בישראל (סעיף 46)',
          '040': 'סה"כ הסכומים שנוכו במקור מהכנסות אחרות הכלולות בדוח',
          // Non-linked-interest 15% branch (Form 1301 part ה item 21 / part טו
          // item 82) — see docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md.
          '078': 'ריבית על פקדונות ותוכניות חיסכון — מס בשיעור של 15%',
          '043': 'ניכוי במקור מריבית (פקדונות ותוכניות חיסכון)',
          '166': 'הפסדי הון שלא קוזזו (ללא חו"ל)',
          // Legacy engine keys (pre code-verification) — kept so an older
          // calculation snapshot still renders with a meaningful label.
          donationsEligible: 'תרומות מוכרות לזיכוי (סעיף 46)',
          capitalTaxableGain: 'רווח הון ריאלי חייב במס',
          capitalTax: 'מס על רווחי הון',
          surtax: 'מס יסף',
          totalLiability: 'סך חבות המס',
          refund: 'החזר מס (שלילי = יתרה לתשלום)',
        },
      },
      // --- Delete a tax year (DELETE /tax-years/:id) with confirmation -----
      deleteTaxYear: {
        trigger: 'מחיקת שנת מס',
        // Accessible label + tooltip for the icon-only per-row control on the
        // dashboard (rendered as a trash-can button, no visible text).
        rowTriggerAria: 'מחיקת שנת מס {{year}}',
        dialogTitle: 'מחיקת שנת מס',
        dialogBody:
          'האם אתה בטוח שברצונך למחוק את שנת המס {{year}}? כל המסמכים והחישובים יימחקו לצמיתות. פעולה זו בלתי הפיכה.',
        cancel: 'ביטול',
        confirm: 'מחיקה',
        error: 'מחיקת שנת המס נכשלה',
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
