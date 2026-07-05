import {
  documentSchemas,
  type ExtractableDocumentKind,
} from '@taxreturns/shared';
import { z } from 'zod';

// Structured outputs forbid `additionalProperties` other than false, so the
// wire schemas (what the model fills in) avoid records and optionals:
// records become arrays of pairs, optionals become nullables. toPayload folds
// a wire value into the shared-schema shape; the caller then validates it
// with documentSchemas[kind] — the single source of truth stays in shared.

const boxCode = z.string().regex(/^\d{3}$/);
const agorot = z.number().int();

const form106Wire = z.object({
  taxYear: z.number().int(),
  employerName: z.string(),
  employerDeductionsFileId: z.string(),
  employeeNationalId: z.string(),
  boxes: z.array(z.object({ code: boxCode, amountAgorot: agorot })),
  uncertainBoxes: z.array(boxCode),
});

const form867Wire = z.object({
  taxYear: z.number().int(),
  brokerName: z.string(),
  accountId: z.string().nullable(),
  realGainsAgorot: agorot,
  realLossesAgorot: agorot,
  interestDividendAgorot: agorot,
  taxWithheldAgorot: agorot,
  uncertainFields: z.array(z.string()),
});

const charityWire = z.object({
  taxYear: z.number().int(),
  institutionName: z.string(),
  institutionRegistrationId: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  amountAgorot: agorot,
  donationDate: z.string().nullable(),
  hasSection46Approval: z.boolean(),
  uncertainFields: z.array(z.string()),
});

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null));
}

const COMMON_RULES = `כללים:
- כל הסכומים בא גורות: הכפל שקלים ב-100 ועגל לשלם (1,234.50 ₪ → 123450).
- קרא את הקודים המודפסים על המסמך, לא את המיקום החזותי של השדות.
- שדה שאינך בטוח בו — כלול אותו וגם ציין את שמו ברשימת אי-הוודאות.`;

export interface KindConfig {
  wireSchema: z.ZodType;
  prompt: string;
  toPayload(wire: unknown): unknown;
}

export const extractionKinds: Record<ExtractableDocumentKind, KindConfig> = {
  form106: {
    wireSchema: form106Wire,
    prompt: `זהו טופס 106 (ריכוז שנתי ממעסיק). חלץ את שנת המס, שם המעסיק, תיק הניכויים (9 ספרות), ת"ז העובד (9 ספרות כולל אפסים מובילים), ואת כל התיבות הממוספרות המודפסות (למשל 158 שכר, 042 מס שנוכה, 045 תגמולי עובד לקופת גמל) עם סכומיהן.
${COMMON_RULES}`,
    toPayload(wire) {
      const w = form106Wire.parse(wire);
      const boxes: Record<string, number> = {};
      for (const { code, amountAgorot } of w.boxes) {
        boxes[code] = (boxes[code] ?? 0) + amountAgorot;
      }
      return {
        taxYear: w.taxYear,
        employerName: w.employerName,
        employerDeductionsFileId: w.employerDeductionsFileId,
        employeeNationalId: w.employeeNationalId,
        boxes,
        uncertainBoxes: w.uncertainBoxes,
      };
    },
  },
  form867: {
    wireSchema: form867Wire,
    prompt: `זהו טופס 867 (אישור שנתי על ניכוי מס במקור מניירות ערך). חלץ את שנת המס, שם הבנק/ברוקר, מספר חשבון אם מודפס, ואת הסיכומים השנתיים: רווח הון ריאלי, הפסד הון ריאלי (כמספר חיובי), הכנסות ריבית ודיבידנד מניירות ערך, ומס שנוכה במקור.
${COMMON_RULES}`,
    toPayload(wire) {
      return stripNulls(form867Wire.parse(wire));
    },
  },
  charity_receipt: {
    wireSchema: charityWire,
    prompt: `זוהי קבלה על תרומה. חלץ את שנת המס, שם המוסד, מספר עמותה (9 ספרות) אם מודפס, מספר קבלה, סכום התרומה, תאריך התרומה (YYYY-MM-DD), והאם מצוין אישור לפי סעיף 46 לפקודת מס הכנסה.
${COMMON_RULES}`,
    toPayload(wire) {
      return stripNulls(charityWire.parse(wire));
    },
  },
};

export function validatePayload(kind: ExtractableDocumentKind, payload: unknown) {
  return documentSchemas[kind].parse(payload);
}
