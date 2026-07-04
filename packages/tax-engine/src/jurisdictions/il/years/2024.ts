import { agorot } from '@taxreturns/shared';
import type { IlYearData } from '../../../core/types';

// ---------------------------------------------------------------------------
// Israel, tax year 2024. All amounts are ANNUAL integer agorot (₪ × 100).
//
// Primary source ("booklet-2025"): Israel Tax Authority, לוח עזר לחישוב מס
// הכנסה ממשכורת ושכר עבודה, January 2025 —
// https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf
// The booklet states (חוק ההתייעלות הכלכלית, הקפאת עדכוני מס ומס יסף,
// התשפ"ה-2024, published 26 Dec 2024) that 2025-2027 amounts are FROZEN at
// their 2024 values, so it documents the 2024 figures as well.
// Owner MUST verify every constant before relying on results (spec §3).
// ---------------------------------------------------------------------------

export const il2024: IlYearData = {
  year: 2024,

  // Annual brackets, יגיעה אישית. source: booklet-2025 "מדרגות המס" table
  // (monthly 7,010 / 10,060 / 16,150 / 22,440 / 46,690; annual ×12).
  brackets: [
    { upToAgorot: agorot(8_412_000), rateBp: 1_000 }, // עד 84,120 ₪ — 10%
    { upToAgorot: agorot(12_072_000), rateBp: 1_400 }, // עד 120,720 ₪ — 14%
    { upToAgorot: agorot(19_380_000), rateBp: 2_000 }, // עד 193,800 ₪ — 20%
    { upToAgorot: agorot(26_928_000), rateBp: 3_100 }, // עד 269,280 ₪ — 31%
    { upToAgorot: agorot(56_028_000), rateBp: 3_500 }, // עד 560,280 ₪ — 35%
    { upToAgorot: null, rateBp: 4_700 }, // מכל שקל נוסף — 47%
  ],

  // נקודת זיכוי (§33א): 242 ₪/month → 2,904 ₪/year. source: booklet-2025 §א.
  creditPointValueAgorot: agorot(290_400),

  surtax: {
    // מס יסף §121ב: 3% on taxable income above 721,560 ₪ (60,130 ₪/mo).
    // source: booklet-2025 (סעיף 121ב לפקודה).
    thresholdAgorot: agorot(72_156_000),
    rateBp: 300,
    // The extra 2% on capital-source income applies only from 2025.
    capitalAdditionalRateBp: 0,
  },

  charity: {
    // §46(א): credit is 35% of eligible donations (individuals).
    // source: פקודת מס הכנסה §46(א); kolzchut "זיכוי ממס הכנסה בשל תרומה".
    creditRateBp: 3_500,
    // Minimum total donations: 207 ₪/yr. source: booklet-2025
    // "תרומה למוסד ציבורי - סכום תרומה מינימלי 46(א)".
    minTotalAgorot: agorot(20_700),
    // Ceiling: 10,354,816 ₪/yr. source: booklet-2025
    // "תרומה למוסד ציבורי - סכום תרומה מקסימלי 46(א)".
    ceilingAgorot: agorot(1_035_481_600),
    // …or 30% of taxable income, whichever is lower. source: §46(א).
    ceilingIncomeShareBp: 3_000,
  },

  pension45a: {
    // §45א: credit of 35% of employee pension contributions.
    // source: פקודת מס הכנסה §45א (owner-verify rate + cap share).
    creditRateBp: 3_500,
    // Contributions credited up to 7% of qualifying income. source: §45א.
    contributionCapShareBp: 700,
    // תקרת הכנסה מזכה §47(א)(1)(1) from work income: 9,700 ₪/mo → 116,400 ₪/yr.
    // source: booklet-2025 §ב "קופות גמל".
    qualifyingIncomeCeilingAgorot: agorot(11_640_000),
  },

  capitalGains: {
    // Real gains of an individual: 25%. source: פקודת מס הכנסה §91(ב)(1)
    // (owner-verify; assumes no §101A 30%+ substantial-shareholder cases).
    realGainRateBp: 2_500,
  },

  nationalInsurance: {
    // Employee share, 2024. source: btl.gov.il "לעובדים שכירים - שיעורי
    // וסכומי דמי ביטוח" — https://www.btl.gov.il/Insurance/Rates/Pages/לעובדים שכירים.aspx
    // (page lists the 1.04%/3.23%/5.17% values as effective 2025; the 2024
    // values below are the long-standing prior rates shown there).
    employee: {
      reducedNiBp: 40, // 0.40%
      reducedHealthBp: 310, // 3.10%
      fullNiBp: 700, // 7.00%
      fullHealthBp: 500, // 5.00%
    },
    // Reduced band: up to 60% of the average wage (12,536 ₪/mo per
    // booklet-2025 "שכר ממוצע לעניין גביית דמי ביטוח") → 7,522 ₪/mo.
    reducedBandTopMonthlyAgorot: agorot(752_200),
    // TODO(owner-verify): 2024 monthly contribution ceiling (49,030 ₪ per
    // btl publications). Informational module only — never affects refund.
    ceilingMonthlyAgorot: agorot(4_903_000),
  },
};
