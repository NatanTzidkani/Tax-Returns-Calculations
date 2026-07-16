# Confirmed-data panel — the last unbuilt phase-1 screen element

**Date:** 2026-07-16 · **Status:** COMPLETE 2026-07-16 (all three TDD steps
as written; `PlaceholderPanel` deleted with its last consumer)
**Spec anchor:** design spec §6 screen 2 — "Tax year detail — … **data panel
(confirmed values grouped: שכר, תרומות, שוק ההון, פנסיה)** …". Shipped since
Plan 4 as `PlaceholderPanel` (`taxYearDetail.dataPlaceholder`). This plan
replaces the placeholder with the real panel. No engine change, no tax-law
constants, no new document fields.

## Design

**One new read-only endpoint, reusing the calculate route's own machinery.**
`GET /tax-years/:id/confirmed-data` (in `routes/calculations.ts`, which
already owns `loadTaxYear`, `latestConfirmedByDocument`, and the
loss-carry-forward IN-sum) runs `mapConfirmedData` with a stub taxpayer and
returns ONLY the document-derived projection:

```
{
  salaries:  SalaryInput[],          // employerName + gross/withheld/pension agorot
  donations: DonationInput[],        // §46-approved only
  excludedDonations: number,         // receipts without §46 approval
  capital: {
    entries: BrokerEntryInput[],     // broker gains/losses/interest-dividend/withheld
    lossCarryforwardInAgorot: number // open carry-forward from earlier years
  }
}
```

Why an endpoint and not client-side grouping over `GET /documents/:id`: the
Form-106 box-code mapping (158/042/045) and the §46-exclusion rule live in
`mapConfirmedData` — duplicating them in the web would fork the single source
of truth, and the panel's whole value is showing **exactly what the engine
will consume** (same mapper, same numbers as the next calculate). The stub
taxpayer never leaves the route (only document-derived fields are returned).
404 Hebrew for a foreign/missing year; auth via the global gate.

**Web:** new `DataPanel` component replacing the `PlaceholderPanel` in
`TaxYearDetail`. Groups per the spec: **שכר** (a row per employer: ברוטו /
ניכוי מס / הפרשות עובד לפנסיה — pension shown inside the salary group, which
is where it lives on Form 106), **תרומות** (institution + amount, plus the
excluded-receipts note reusing the worksheet's Hebrew), **שוק ההון** (a row
per broker + the carry-forward-in line when non-zero). All money `formatILS`;
empty year → the existing placeholder sentence (key reused); query error →
the standard load-error alert. i18next + logical properties throughout.

## TDD steps

- [ ] **API red:** extend `test/credit-points-wiring.test.ts`-style route
      tests (new `test/confirmed-data.test.ts`, own test db): empty year →
      empty arrays + 0s; a confirmed 106+867+receipt (one approved, one
      unapproved) year → mapped values, `excludedDonations: 1`; only the
      LATEST confirmed payload per document counts; a foreign year id → 404
      Hebrew; unauthenticated → 401. Implement the route. Commit
      `feat(api): GET /tax-years/:id/confirmed-data — the data panel's mapped projection`.
- [ ] **Web red:** `DataPanel.test.tsx` — renders the three groups with
      formatted agorot, the excluded-donations note, the carry-forward row
      only when non-zero; empty state shows the placeholder sentence; fetch
      error shows the load-error alert. Implement `DataPanel` + i18n keys +
      swap into `TaxYearDetail`. Commit
      `feat(web): confirmed-data panel replaces the placeholder (spec §6 screen 2)`.
- [ ] Full root green; CLAUDE.md web/api rows + this plan marked done. Commit
      `docs: note the confirmed-data panel in CLAUDE.md`.

## Out of scope

- Editing values here (the document-review screen owns corrections).
- Pension §45א/§47 *computed* figures (the worksheet owns computation; this
  panel shows confirmed inputs only).
- Any staleness indicator beyond query refetch-on-mount (the worksheet's
  `stale` flag already covers calculation staleness).
