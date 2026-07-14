# Credit-Points Downstream Wiring Plan — shared Zod → API → worksheet UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is a **planning document — no code is written by writing it.**

**This is the downstream-wiring follow-on both engine increments deferred**
(`docs/superpowers/plans/2026-07-13-credit-points.md` "Downstream, NOT in this
plan"; `docs/superpowers/plans/2026-07-14-degree-credit-points.md` same
section). The engine (since `il-0.4.0`/`il-0.5.0`, merged 2026-07-14) computes
child §40, oleh §35, and degree §40ג–§40ה credit points from optional
structured `TaxpayerInput` fields — but those fields are **engine-only**
today: `CalculateRequestSchema` strips them, and the worksheet form still
sends only `gender`/`additionalCreditPoints`. **This plan wires
`children` / `aliyah` / `degrees` end-to-end** so the reviewer enters them in
the worksheet form and sees the engine's labelled breakdown rows.

**Goal:** After this plan, the reviewer can (1) add children (age + role),
an aliyah record (year/month/schedule variant), and degrees (track,
completion year, study years, elected year, internship) in the worksheet
taxpayer form; (2) submit → shared-Zod-validated request → API →
engine → append-only snapshot (the snapshot already persists the full engine
`input`, so the new fields are audit-recorded for free); (3) read the
engine's Hebrew `label` on every child/oleh/degree breakdown row; and (4) see
the engine's **Hebrew fail-loud errors** (e.g. the disabled 6–17 band) in the
form instead of a generic failure line.

**No engine changes and no new tax-law constants.** `ENGINE_VERSION` stays
`il-0.5.0`. This plan is pure plumbing + UI.

---

## The one architectural rule this plan must not break

**Two single-sources-of-truth, cleanly split:**

- **Shape** (what a request may look like) is owned by the shared Zod schemas
  (CLAUDE.md: "Zod schemas in `packages/shared` are the single source of
  truth"). The new sub-schemas are **structural only**: field names, enums,
  integers, and physically-absurd bounds (month 1–12, age 0–18).
- **Law** (what a valid-shaped input *means*, and which inputs are
  legally contradictory or not-yet-verified) is owned by the **engine**, which
  already fails loudly in Hebrew-mapped 400s: the disabled 6–17 band, the
  2014–2022-vs-2023+ elective rules, internship conditions, §7(ב)/(ג)
  exclusivity, pre-2014 completions.

**Do NOT duplicate a legal rule into Zod** (e.g. `completionYear >= 2014`, the
6–17 ban, elective-year candidate sets). Duplicating would create a second
place to update when the owner verifies an open item, and the two layers would
drift. The UI surfaces the engine's Hebrew message instead (Phase A2 makes
that work). The one deliberate overlap is age 0–18 on `ageInTaxYear`, which is
the statutory *domain* of the child table, not an open legal question.

**Type-drift guard (load-bearing):** `mapConfirmedData` passes
`CalculateRequest['taxpayer']` straight into the engine's `TaxYearInput`
(`packages/api/src/calculation/map-confirmed-data.ts:130`), and TypeScript's
structural typing will NOT reject a typo'd optional field name in the Zod
schema — it would silently never reach the engine. Phase A1 therefore adds
**type-level equality assertions** (the new fields' element types vs the
engine's `TaxpayerInput` types) plus runtime route tests that assert the
points actually change.

## Current wiring surfaces (read these first)

| Surface | File | What changes |
|---|---|---|
| Request schema | `packages/shared/src/calculation.ts` (`CalculateRequestSchema.taxpayer`) | + `children`/`aliyah`/`degrees` optional sub-schemas |
| API mapping | `packages/api/src/calculation/map-confirmed-data.ts` | none (taxpayer passes through) — tests + type assertions only |
| Calculate route | `packages/api/src/routes/calculations.ts` | none expected (snapshot stores full `input`; engine errors already → 400 Hebrew) — verify + tests |
| Breakdown renderer | `packages/web/src/components/WorksheetPanel.tsx:386-399` | duplicate `key={row.reason}`, ignores engine `label`, unknown reasons render a raw i18n key |
| Reason i18n | `packages/web/src/i18n.ts:173-177` | only `resident`/`female`/`additional` defined |
| Form error line | `WorksheetPanel.tsx:300-304` | generic `calculateError`; must surface the server's Hebrew message (`ApiError.message` from `packages/web/src/api/client.ts`) |
| Taxpayer form | `WorksheetPanel.tsx` `TaxpayerForm` | + children/aliyah/degrees inputs; validity stays shared-Zod `safeParse` + `noValidate` |

Engine input contract (the target types): `packages/tax-engine/src/core/types.ts`
(`TaxpayerInput.children` / `.aliyah` / `.degrees`).

---

## Phases and tasks (TDD: failing test → red → implement → green → commit)

Phases A1 and A2 touch disjoint packages and run **in parallel**. Phase B
needs both (same form file as A2; schema from A1). Root `pnpm test` +
`pnpm typecheck` green before every commit; api integration tests need the
compose `db` container up.

### Phase A1 — shared schemas + API pass-through proof (packages/shared + packages/api)

- [ ] Failing shared tests (`packages/shared`): `CalculateRequestSchema`
      accepts a taxpayer with `children: [{ ageInTaxYear: 2, role: 'custodial' }]`,
      `aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'from2022' }`,
      `degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }]`
      (and an internship/electedClaimYear variant); rejects non-integer /
      out-of-domain shapes (age 19, month 0, unknown role/track/variant,
      negative studyYears); absent fields still parse (backward compat) and
      **do not appear as keys** in the parsed output (so the engine sees
      `undefined`, not `[]`).
- [ ] Implement `ChildInputSchema` / `AliyahInputSchema` / `DegreeInputSchema`
      in `packages/shared/src/calculation.ts` (structural only — see the
      architectural rule), extend `CalculateRequestSchema.taxpayer`, export
      the inferred types from the package index.
- [ ] Failing api tests: type-level `Expect<Equal<...>>` assertions pinning
      the new fields' element types to the engine's `TaxpayerInput` types
      (catches silent structural-typing drift); route tests through
      `buildApp(deps)` — calculate with a child age 2 → `creditPoints.points`
      reflects 6.75 and the snapshot row's stored `input.taxpayer` carries the
      structured fields; child age 7 → **400 with the engine's Hebrew
      message** (the disabled 6–17 band); degrees `vocational`+`bachelor` →
      400 (§7(ג)); mixed request (children + aliyah + degrees + additional)
      → exact expected points.
- [ ] Green; commits (conventional):
      `feat(shared): children/aliyah/degrees structured credit-point inputs in CalculateRequestSchema`,
      `test(api): structured credit-point inputs flow to the engine and snapshot`.

### Phase A2 — worksheet breakdown hardening (packages/web only; independent of A1)

- [ ] Failing web tests (`WorksheetPanel.test.tsx`): a calculation result with
      two `child` rows + an `oleh` row + a `degree` row renders one line per
      row (no React duplicate-key loss), showing the engine's Hebrew `label`
      when present and the i18n reason fallback otherwise; unknown future
      reason value does not render a raw `worksheet.creditReason.*` key; a
      failed calculate (400 with Hebrew message) shows the **server's
      message** in the alert, falling back to the generic
      `worksheet.calculateError` only when no message exists.
- [ ] Implement: unique `key` (row index is fine — order is engine-stable),
      `row.label ?? t(...)` display, new `creditReason.child/oleh/degree`
      Hebrew entries in `i18n.ts` (official terminology), and surface
      `ApiError.message` in the form's error alert.
- [ ] Green; commit
      `fix(web): worksheet breakdown renders engine labels, unique keys, and server Hebrew errors`.

### Phase B — worksheet form inputs (packages/web; after A1 + A2)

- [ ] Failing web tests: add/remove child rows (age + role selects) and the
      submitted body carries `children`; aliyah section toggle (year, month,
      variant selects) → body carries `aliyah`; degrees rows (track select,
      completion year, study years; `electedClaimYear` input shown only for
      completion years ≤ 2022 — a **display** convenience, the value is still
      sent verbatim and the engine stays the validator; internship toggle
      with start/end years) → body carries `degrees`; blank/removed sections
      omit the keys entirely; a Zod-shape failure shows the localized message
      without submitting; an engine 400 (child age 7) shows the server's
      Hebrew text (A2's surface).
- [ ] Implement in `TaxpayerForm`: Hebrew-RTL dynamic rows (logical
      properties only, Radix `Label`, i18next strings for every label/help/
      error), shared-Zod `safeParse` gate as today, `noValidate` preserved.
      Keep the reviewer's `additionalCreditPoints` field — it remains the
      catch-all for everything not yet modelled (6–17 children, parent
      allocation, PhD tracks, pre-2014).
- [ ] A help note under the children section: ages 6–17 are not yet
      supported by the automatic computation (owner-verify open) — enter
      those via the additional-points field.
- [ ] Green; commit
      `feat(web): children/aliyah/degrees structured inputs in the worksheet taxpayer form`.

### Phase C — verify, review, docs

- [ ] End-to-end verify against the running dev stack (worksheet → calculate
      with structured inputs → labelled rows render; 6–17 child → Hebrew
      error in the form).
- [ ] Independent reviewer pass on the full branch diff; apply findings.
- [ ] Update CLAUDE.md (api/web/tax-engine rows: structured inputs now wired
      end-to-end; drop the "engine-only" caveat; note what still routes via
      `additionalCreditPoints`). Commit `docs: note credit-point wiring in CLAUDE.md`.
- [ ] Merge to master after root `pnpm test` + `pnpm typecheck` green.

---

## ⚠️ Owner should know (not merge-gating — no new law is encoded)

- The form will let the reviewer *attempt* any legally-shaped input; the
  engine remains the authority and its Hebrew errors now surface in the UI.
  This is deliberate (single source of legal truth) — confirm you're happy
  with error-driven UX for the not-yet-verified cases (6–17 band, pre-2014
  degrees) instead of the UI pre-blocking them.
- Degree/aliyah facts (recognized degree, study years, aliyah date, schedule
  variant) are reviewer-attested, exactly as the engine plans specify.
- The Form 1301 filing view is untouched: credit points remain a worksheet
  quantity; no new field codes are involved.

## Out of scope / deferred

- Parent-allocation regimes (`parentContext`) — own plan, owner-gated.
- Persisting taxpayer profile data (children/degrees) across years — today
  the worksheet form is per-request by design; a stored taxpayer profile is
  its own future plan.
- Extraction-schema sources for any of these inputs (none exist on
  Form 106/867/receipts).
- Medicine/direct-track PhD tracks, pre-2014 completions, 6–17 band —
  `additionalCreditPoints` stays the reviewer fallback.
