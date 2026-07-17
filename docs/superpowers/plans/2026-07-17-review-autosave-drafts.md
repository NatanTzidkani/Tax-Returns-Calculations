# Review edits autosave as drafts — the unmet spec §9.3 promise

**Date:** 2026-07-17 · **Status:** planned
**Spec anchor:** design spec §9.3 — "**User input is never lost.** Review
edits autosave as drafts; confirmations are transactional; calculations are
append-only." Confirmations and calculations were delivered in Plans 3/5;
the *drafts* half was never built and no plan descoped it. Today every edit
on the document-review screen lives only in React `useState` — a reload or
navigation before the explicit confirm silently loses every in-progress
correction.

## Design

**Client-side draft persistence in `localStorage`, keyed by document id +
a payload-version discriminator.** Rationale, recorded here as the decision
of record:

- Phase 1 is single-user, single-browser (the owner). `localStorage` covers
  exactly the loss mode the spec names (reload / navigation before confirm)
  with **zero new API surface** and **zero risk to the confirmed-data
  discipline** — the engine's only input remains `confirmed_data`, written
  solely by the transactional `POST /documents/:id/confirm`; a draft is
  browser-local scratch state that never reaches the server.
- **Server-side drafts are the multi-device alternative** (a
  `draft_payload` column or a drafts table + debounced PUT). Listed as
  future work below; nothing in this design blocks it — the storage module
  is the single seam to swap.

**Storage shape.** Key `taxreturns.reviewDraft.v1.<documentId>` (the `v1`
is the draft-record schema version — an unknown/old record shape is treated
as no draft and removed, never guessed at). Record:

```
{
  version: 1,
  kind: 'form106' | 'form867' | 'charity_receipt',
  baseFingerprint: string,   // stable-stringify of the payload the edit
                             // session started from (extracted OR confirmed
                             // OR null for manual entry)
  form: <kind-specific raw form state>,  // the INPUT STRINGS as typed
  savedAt: ISO timestamp
}
```

Two deliberate choices:

- **Drafts store the raw input strings** (shekel text, year text…), not a
  parsed payload — an in-progress edit is usually not yet schema-valid;
  that is the whole point of a draft. Money therefore never exists as a
  parsed float anywhere: agorot conversion still happens only at confirm
  through the shared Zod schema. `formatILS`/agorot rules untouched.
- **`baseFingerprint` is the re-extraction guard** (requirement d). A draft
  saved against extraction A must not silently overwrite fresh extraction
  B: on restore the fingerprint of the *current* server payload is compared
  with the stored one; a mismatch drops the draft and shows a Hebrew notice
  saying an outdated draft was discarded because the document was
  re-extracted. Fingerprint = sorted-key deterministic stringify (no crypto
  needed — equality is the only question).

**Behavior** (all user-visible strings via i18next; logical properties
only):

1. **Autosave (debounced).** Each kind form reports its full raw form state
   on every change; a debounced writer (~300 ms, flushed on unmount so a
   navigation right after typing still saves) persists it. A form state
   identical to the server-derived one clears the draft instead of saving
   it (no junk records).
2. **Restore on mount.** If a valid draft exists for this document, kind
   matches, fingerprint matches, and the draft differs from the
   server-derived form state → the form initializes from the draft AND a
   visible Hebrew notice announces the restored unconfirmed draft, with a
   **discard-draft button** that deletes the draft and remounts the form on
   the server values. A draft equal to the server values restores nothing
   and shows nothing (it is deleted as housekeeping).
3. **Cleared** on successful confirm (before navigation, with any pending
   debounce cancelled so the unmount flush cannot resurrect it) and on
   discard.
4. **Stale draft** (fingerprint mismatch, i.e. re-extracted since) →
   dropped + Hebrew notice; the fresh extraction wins, loudly.

**Where the code lives.**

- `packages/web/src/lib/review-draft.ts` — pure, unit-testable module
  (mirrors `lib/taxpayer-profile.ts`): per-kind raw-form-state types +
  `formStateFromPayload` derivations (moved out of the screen's `useState`
  initializers so draft and server state share one derivation),
  `fingerprintPayload`, load/save/clear with strict structural validation
  of anything read back (corrupt/foreign records → null + removal), and
  the pure `resolveDraft` decision (none / restored / equal / stale).
- `DocumentReview.tsx` — a `useReviewDraft` hook (debounce, unmount flush,
  discard/clear, StrictMode-safe: the lazy resolve is pure; the removal
  side effect runs in a mount effect) + a `DraftedKindForm` wrapper that
  owns the confirm mutation (so clearing on success sits next to the
  draft), renders the two notices, and remounts the kind form on discard.
  The three kind forms gain `initialForm`/`onFormChange` props; drafts are
  active only when the form is editable (read-only confirmed view leaves a
  stored draft untouched until "עריכה ואישור מחדש" re-enters edit mode).

## TDD steps

- [ ] **Lib red:** `src/lib/review-draft.test.ts` — fingerprint is stable
      under key reordering and differs across payloads; load rejects
      corrupt JSON / wrong version / wrong shape (and removes them);
      `formStateFromPayload` mirrors the current screen initializers (106
      boxes → shekel-string rows, null → empty form); `resolveDraft`
      returns server/no-notice, draft/restored, server/stale-dropped, and
      deletes the equal draft. Implement the module.
- [ ] **Screen red:** extend `DocumentReview.test.tsx` (same style,
      `localStorage.clear()` per test): (1) editing an extracted form106
      autosaves a v1 record with the base fingerprint and the typed value;
      (2) a differing seeded draft restores with the Hebrew notice and the
      discard button reverts to server values + deletes the record; (3) a
      draft equal to the server values shows no notice and is removed; (4)
      a stale-fingerprint draft is dropped with its own notice and the
      fresh extraction's values render; (5) a successful confirm clears the
      draft. Implement the hook + wiring + i18n keys.
- [ ] `pnpm --filter @taxreturns/web test` + `typecheck` + root `pnpm
      typecheck` green; plan marked complete.

## Out of scope / future work

- **Server-side drafts** (multi-device continuity, drafts surviving a
  browser wipe): the phase-2 path if ever needed — swap the storage module
  for a debounced `PUT /documents/:id/draft`; the fingerprint/notice
  semantics carry over unchanged.
- Drafts for the worksheet taxpayer form (it has its own pre-fill profile
  store; a separate decision if wanted).
- Any change to `POST /confirm` semantics — confirmations stay
  transactional and server-authoritative.
- Cross-document draft listing/expiry UI (single-owner phase 1; records
  are per-document and self-clean on confirm/discard/stale).
