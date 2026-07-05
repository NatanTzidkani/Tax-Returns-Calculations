import { agorot } from '@taxreturns/shared';
import type { IlYearData } from '../../../core/types';
import { il2024 } from './2024';

// ---------------------------------------------------------------------------
// Israel, tax year 2025.
//
// חוק ההתייעלות הכלכלית (הקפאת עדכוני מס ומס יסף), התשפ"ה-2024 (ס"ח 3342,
// 26 Dec 2024) froze all §120ב-indexed amounts for 2025-2027 at 2024 values,
// so brackets / credit point / ceilings are inherited from the 2024 file.
// Sources for what DID change are annotated below. Owner MUST verify.
// Primary source: Israel Tax Authority January-2025 booklet —
// https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf
// ---------------------------------------------------------------------------

export const il2025: IlYearData = {
  ...il2024,
  year: 2025,

  surtax: {
    ...il2024.surtax,
    // NEW in 2025: additional 2% surtax on taxable income from capital
    // sources above the §121ב threshold (total 5% on that part).
    // source: booklet-2025 intro ("מס נוסף 'חדש' בשיעור של 2% על הכנסה
    // חייבת ממקורות הוניים העולה על הסכום הקבוע בסעיף").
    capitalAdditionalRateBp: 200,
  },

  nationalInsurance: {
    ...il2024.nationalInsurance,
    // Employee rates changed 1 Jan 2025 (NI reduced 0.40%→1.04%; health
    // reduced 3.10%→3.23%; health full stepped 5.00%→5.16% (Jan 2025)→5.17%
    // (from Feb 2025) — the engine uses the 5.17% full-year approximation,
    // overstating January by 0.01pp; informational only).
    // source: btl.gov.il "לעובדים שכירים - שיעורי וסכומי דמי ביטוח" —
    // https://www.btl.gov.il/Insurance/Rates/Pages/לעובדים שכירים.aspx
    employee: {
      reducedNiBp: 104, // 1.04%
      reducedHealthBp: 323, // 3.23%
      fullNiBp: 700, // 7.00%
      fullHealthBp: 517, // 5.17%
    },
    // 50,695 ₪/mo ceiling. source: btl employer letter בל/651 (01.2025);
    // verified in docs/superpowers/research/2026-07-05-tax-constants-verification.md.
    ceilingMonthlyAgorot: agorot(5_069_500),
  },
};
