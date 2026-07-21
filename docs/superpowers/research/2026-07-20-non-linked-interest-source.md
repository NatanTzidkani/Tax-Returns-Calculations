# Non-linked 15% interest (§125ג(ג)(1)) — confirmed-document source design

Date: 2026-07-20 · Author: tax-law-analyst agent · Status: design proposal (no code changed)

**The gap.** The engine already computes 15% non-linked deposit/savings interest
end-to-end (input `nonLinkedInterest`, module `non-linked-interest.ts`, Form 1301
fields **078** income / **043** withholding, and it feeds the surtax
`capitalTaxable` base). But there is **no confirmed-document source** for the
amount: today it arrives per-request on `CalculateRequestSchema`
(`nonLinkedInterestAgorot` / `nonLinkedInterestWithheldAgorot`) and is threaded
through `mapConfirmedData(...)` — see the `TODO(non-linked-interest source)` at
`packages/api/src/calculation/map-confirmed-data.ts:55` and the calculate route
at `packages/api/src/routes/calculations.ts:139`. That per-request path
**violates the "the engine's only input is confirmed_data" convention**: the
amount is a transient reviewer entry, is not an auditable confirmed document,
does not appear in the `GET /confirmed-data` data panel, and must be re-typed on
every recalculation (the calculate snapshot does capture it inside `input`, so it
is not lost from the audit trail — but it is not *confirmed data*).

This report resolves **which real document/field** carries the amount and
proposes the **cleanest data-source design** to feed it through the
confirmed-data → engine pipeline. It changes no code; the rate/field-code facts
are already primary-confirmed in prior reports and are only summarised here.

Amounts below are in NIS; the engine stores integer **agorot** (₪ × 100).

## Sources

No new external pages were fetched for this report (owner rule: checked
`SOURCES.md` first — the underlying facts are already logged). It stands on three
existing primary-confirmed reports:

| Report | What it established (primary) |
|---|---|
| `docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md` | 15% rate on non-linked interest (§125ג(ג)(1)); Form 1301 codes **078** (income, part ה item 21) / **043** (withholding, item 82), distinct from securities **157/141/040**; surtax treats it as capital-source income |
| `docs/superpowers/research/2026-07-13-interest-residual-addendum.md` | §2: the amount lives in **Form 867 appendix ד'** ("ריבית ורווחים אחרים מפקדונות ותוכניות חיסכון", 15%), a *different* appendix from securities interest/dividend (**867 ג'**, 25%). §1: 15% is a **flat** rate (no marginal cap needed for any under-60 taxpayer) |
| `docs/superpowers/research/2026-07-13-interest-loss-offset-addendum.md` | deposit interest is **not** a §92(א)(4) loss-offset target (deposit ≠ security) → the engine correctly keeps it a standalone bucket |

Sources cited inside those reports include the official gov.il Form 1301 (2024 &
2025, extracted via `pdftotext -layout`), the ordinance text hosted on
btl.gov.il, a CPA Form-867 guide (roeahesbon), and Bank Discount's 867 page.

---

## 1. Which real document / field carries the amount

| Question | Answer | Grade |
|---|---|---|
| What document reports an individual's 15% non-linked interest? | The bank/broker **annual withholding certificate — Form 867**, specifically **appendix ד' ("נספח ד'"): "אישור ניכוי מס במקור מריבית ורווחים אחרים מפקדונות ותוכניות חיסכון"** (15%). Pure-deposit savers (no securities account) may receive the appendix-ד' certificate **standalone** from the bank, sometimes not even labelled "867"; the numbers are identical | CONFIRMED (appendix identity) |
| How is it distinguished from linked / securities interest? | **867 ד'** = non-linked deposit/savings interest → **15%** → Form 1301 field **078**, withholding **043**. **867 ג'** = securities interest + dividend → **25%** → Form 1301 fields **157 / 141**, withholding **040** (the bucket the engine already handles via `Form867Schema.interestDividendAgorot` / `taxWithheldAgorot`). The two are separate appendices on the same physical certificate | CONFIRMED |
| Which two numbers does the app need from 867 ד'? | (a) the **interest income** (→ 078) and (b) the **tax withheld at source** on it (→ 043). Both integer agorot | CONFIRMED |
| The discrete numeric box codes *inside* appendix ד' | **Issuer-template-dependent** — each bank numbers its own boxes; not published. Read them off the owner's actual 867 when building extraction. This does not block the design (the two logical fields are stable) | OWNER-VERIFY (extraction detail only) |

**Legal note (no rate cap):** §125ג(ג)(1) states the non-linked rate as a **flat**
"בשיעור של 15%" (the "שלא יעלה על" ceiling language sits only in §125ג(ב), the
25% linked/real path). For any taxpayer under 60, non-exertion interest is a ≥31%
top-slice under §121(א), so 15% always binds. The engine's flat 15% is correct;
no `min(15%, marginal)` branch is needed. (Details: residual addendum §1.)

---

## 2. Proposed data-source design

Three options were considered against the two governing conventions —
**shared-Zod-as-single-source-of-truth** and **engine's-only-input-is-
confirmed_data**.

| Option | Shape | Fit |
|---|---|---|
| **A — new document kind** `bank_interest_certificate` (867-ד') with its own Zod schema | Upload cert → AI extract → confirm → map to engine `nonLinkedInterest` | Clean & auditable, but heaviest surface: new `document_kind` enum value = **DB enum migration**, new extraction prompt, new review form, new mapping branch, new i18n. Also over-models: appendix ד' is not a separate legal document from the 867 |
| **B — extend `Form867Schema`** with two optional fields for the ד' appendix ✅ **RECOMMENDED** | Add `nonLinkedInterestAgorot?` + `nonLinkedInterestWithheldAgorot?` to the existing 867 schema; the 867 review form gains two fields; the mapper **sums** them across all 867 docs into the engine's single `nonLinkedInterest` bucket | Minimal, legally faithful (867-ד' *is* part of Form 867), no DB migration, reuses the whole 867 pipeline. Fits both conventions |
| **C — keep per-request manual entry** (status quo) but persist somewhere | The `CalculateRequest` fields as-is | Rejected: not confirmed data, invisible in the data panel, re-typed each recalc |

### Recommendation — Option B (extend `Form867Schema`)

Rationale:

1. **Legally the same document.** The residual addendum confirms 867-ד' is an
   appendix of Form 867, not a distinct document. Modelling it as two more
   optional fields on `Form867Schema` mirrors reality: one physical certificate,
   two rate buckets (ג' securities 25% + ד' deposits 15%). A pure-deposit saver's
   standalone bank certificate is still entered as a `form867` document.
2. **Cheapest faithful surface.** No `document_kind` enum change → **no DB
   migration**; no new extraction kind, review screen, or mapper branch — just
   two optional fields and an accumulation. Reuses upload → extract → confirm →
   snapshot → data panel wholesale.
3. **Conventions honoured.** The two fields become part of the shared Zod schema
   (single source of truth), so API validation, extraction structured-output, and
   the review form all derive from them; the value becomes real *confirmed data*
   (append-only, auditable, shown in `GET /confirmed-data`), replacing the
   convention-violating per-request path.

Proposed schema additions (design only — `packages/shared/src/documents/form867.ts`):

```
/** Appendix 867-ד': non-linked (15%) deposit/savings interest — Form 1301 field 078.
 *  Separate rate bucket from interestDividendAgorot (867-ג', securities, 25%). */
nonLinkedInterestAgorot: agorotAmount.default(0),
/** Withholding on the above (867-ד') — Form 1301 field 043. Distinct from
 *  taxWithheldAgorot, which is securities/867-ג' withholding → field 040. */
nonLinkedInterestWithheldAgorot: agorotAmount.default(0),
```

Both **default(0)** so every existing confirmed 867 payload re-validates
unchanged (backward-compatible; a 2024/2025 doc without deposit interest simply
carries 0, and the mapper contributes nothing to the bucket).

Key mapping rule — **single-bucket aggregation.** The engine's `nonLinkedInterest`
is one aggregate, not per-broker. `mapConfirmedData` must **sum**
`nonLinkedInterestAgorot` (and the withholding) across *all* `form867` docs of the
year into the one `nonLinkedInterest` input, attaching the bucket only when the
sum > 0 (so a year with no deposit interest still sends `undefined` and the engine
sees no such income — preserving current behaviour).

**Retire the per-request path.** Once 867 supplies the amount, the
`CalculateRequestSchema.nonLinkedInterestAgorot` /
`nonLinkedInterestWithheldAgorot` fields become redundant and, if both were added,
a **double-count risk**. Recommendation: make the mapper source non-linked
interest **only** from confirmed documents and **remove** the two per-request
fields from `CalculateRequestSchema` (and the two params on `mapConfirmedData`) in
the same change — a net simplification. This also deletes the
`TODO(non-linked-interest source)` block. (If the owner wants a transition window,
keep the per-request fields as a fallback used *only when no 867 doc carries
deposit interest*, guarded so the two can never both contribute — but a clean
cut-over is preferred since the app is single-user with no external callers.)

**No loss-offset interaction.** The loss-offset addendum confirmed deposit
interest is not a §92(א)(4) target; the engine already keeps `nonLinkedInterest`
out of the offset waterfall, so this design adds no offset wiring. Surtax is
already handled (the engine folds the amount into `capitalTaxable`).

---

## 3. Impact sketch (no code)

Flow of a confirmed 867-ד' amount to Form 1301 fields 078/043:

`Form 867 (appendix ד') upload → AI extraction → reviewer confirm → confirmed_data
→ mapConfirmedData (sum across 867 docs → engine nonLinkedInterest bucket) →
calculate() → result.nonLinkedInterest (15% tax, into totalLiability; withholding
into totalWithheld; amount into capitalTaxable for surtax) → form1301Fields 078
(income) + 043 (withholding)`.

| Layer | File(s) | Change |
|---|---|---|
| **Shared schema** (source of truth) | `packages/shared/src/documents/form867.ts` | Add the two optional `default(0)` fields above. `Form867` type flows everywhere automatically |
| **Extraction** | `packages/api/src/extraction/kinds.ts` (867 prompt/structured output) | Teach the Claude-vision extractor to read appendix-ד' interest + its withholding; mark uncertain per existing convention. Exact 867 box numbers are issuer-specific (OWNER-VERIFY off the real cert) |
| **Confirmed-data mapping** | `packages/api/src/calculation/map-confirmed-data.ts` | In the `form867` case, accumulate `nonLinkedInterestAgorot` / `nonLinkedInterestWithheldAgorot` into a running sum; after the loop, attach `nonLinkedInterest` only when the sum > 0. Remove the `nonLinkedInterestAgorot?` / `nonLinkedInterestWithheldAgorot?` params + the `TODO` block |
| **Calculate route** | `packages/api/src/routes/calculations.ts` | Drop the two per-request pass-throughs (lines ~139-142). No other change — snapshot still stores `input` |
| **Calculate request schema** | `packages/shared/src/calculation.ts` | Remove `nonLinkedInterestAgorot` / `nonLinkedInterestWithheldAgorot` + their doc comment (now document-sourced) |
| **Confirmed-data panel API** | `packages/api/src/routes/calculations.ts` `GET /confirmed-data` | The projection already runs `mapConfirmedData`; surface `input.nonLinkedInterest` in the response so the panel can show it under שוק ההון |
| **Web — review form** | `packages/web/src/screens/DocumentReview.tsx` + `lib/review-draft.ts` | Two new labelled inputs on the 867 form: "ריבית מפקדונות ותוכניות חיסכון (15%)" (078) and "ניכוי מס במקור מריבית פקדונות" (043); uncertain-field highlight reused |
| **Web — data panel + i18n** | `packages/web/src/components/DataPanel.tsx`, `src/i18n.ts` | Render the two per-broker deposit-interest rows; Hebrew strings via i18next |
| **Web — worksheet form** | `packages/web/src/screens/TaxYearDetail.tsx` (worksheet) | **Remove** the manual non-linked-interest inputs (now document-sourced) if any exist there |
| **Engine** | — | **No change.** Already computes 15% tax + emits 078/043 + feeds surtax (`calculate.ts`, `non-linked-interest.ts`, year files `nonLinkedInterestRateBp: 1_500`) |
| **DB** | — | **No migration.** `confirmed_data.payload` is jsonb; the new optional fields need no column and no `document_kind` enum change |
| **Tests** | api map/route, web review/panel, shared schema | 867 confirm carrying deposit interest → engine 078/043; two 867 docs each with deposit interest → summed into one bucket; a 2024/2025 legacy payload without the fields → re-validates and contributes 0 |

**Net:** an **additive, migration-free** change concentrated in the shared 867
schema + its existing pipeline, that promotes the amount from a
convention-violating per-request entry to real, auditable confirmed data, and lets
the reviewer supply it from the actual bank certificate. The engine and DB are
untouched.

## Open item for the owner (extraction only, not blocking design)

The discrete numeric box codes inside appendix 867-ד' are issuer-template-
dependent and unpublished. Pull them off the owner's actual Form 867 when wiring
the extractor. The two logical fields (interest income, withholding) are stable
regardless.
