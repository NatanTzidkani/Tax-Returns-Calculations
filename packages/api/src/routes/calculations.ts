import {
  CalculateRequestSchema,
  TaxYearStatusUpdateSchema,
  type TaxYearStatus,
} from '@taxreturns/shared';
import {
  calculate,
  ENGINE_VERSION,
  TaxEngineError,
  type TaxReturnResult,
} from '@taxreturns/tax-engine';
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ResolvedDeps } from '../app';
import { requireUserId } from '../auth/session';
import {
  mapConfirmedData,
  type ConfirmedDocumentInput,
} from '../calculation/map-confirmed-data';
import {
  calculations,
  confirmedData,
  documents,
  lossCarryforward,
  taxYears,
} from '../db/schema';

const uuid = z.uuid();

const MSG = {
  taxYearNotFound: 'שנת המס לא נמצאה',
  noCalculation: 'עדיין לא בוצע חישוב לשנת מס זו',
  invalidCalculateBody:
    'גוף הבקשה אינו תקין — יש לשלוח taxpayer עם gender (male/female), ' +
    'ואופציונלית isIsraeliResident ו-additionalCreditPoints (כפולה של 0.25, לא שלילית)',
  invalidStatusBody:
    'סטטוס לא תקין — הערכים המותרים: draft, in_review, ready_to_file, filed, amended',
} as const;

const HEBREW_STATUS: Record<TaxYearStatus, string> = {
  draft: 'טיוטה',
  in_review: 'בבדיקה',
  ready_to_file: 'מוכן להגשה',
  filed: 'הוגש',
  amended: 'מתוקן',
};

/**
 * Year status flow (design spec §5 / Plan 5 contract):
 * draft→in_review→ready_to_file→filed→amended, with backward steps for
 * rework. Enforced server-side; the UI only offers the legal next steps.
 */
const LEGAL_TRANSITIONS: Record<TaxYearStatus, readonly TaxYearStatus[]> = {
  draft: ['in_review'],
  in_review: ['draft', 'ready_to_file'],
  ready_to_file: ['in_review', 'filed'],
  filed: ['amended'],
  amended: ['in_review'],
};

export async function calculationRoutes(
  app: FastifyInstance,
  opts: { deps: ResolvedDeps },
): Promise<void> {
  const { deps } = opts;

  /** Loads the year only if it belongs to the requester — otherwise 404. */
  async function loadTaxYear(rawId: string, req: FastifyRequest) {
    const parsed = uuid.safeParse(rawId);
    if (!parsed.success) return undefined;
    const [row] = await deps.db
      .select()
      .from(taxYears)
      .where(and(eq(taxYears.id, parsed.data), eq(taxYears.userId, requireUserId(req))));
    return row;
  }

  /** Latest confirmed_data payload per document of the year (append-only table). */
  async function latestConfirmedByDocument(
    taxYearId: string,
  ): Promise<ConfirmedDocumentInput[]> {
    const rows = await deps.db
      .select({
        documentId: documents.id,
        kind: documents.kind,
        payload: confirmedData.payload,
      })
      .from(confirmedData)
      .innerJoin(documents, eq(confirmedData.documentId, documents.id))
      .where(eq(documents.taxYearId, taxYearId))
      .orderBy(desc(confirmedData.confirmedAt));
    const latest = new Map<string, ConfirmedDocumentInput>();
    for (const row of rows) {
      if (!latest.has(row.documentId)) {
        latest.set(row.documentId, { kind: row.kind, payload: row.payload });
      }
    }
    return [...latest.values()];
  }

  /** Carry-forward IN: open capital-loss rows from earlier years of this
   *  user (phase-1 semantics — consumedByYear stays unused, see the plan). */
  async function openLossCarryforwardInAgorot(taxYear: {
    userId: string;
    year: number;
  }): Promise<number> {
    const openLosses = await deps.db
      .select()
      .from(lossCarryforward)
      .where(
        and(
          eq(lossCarryforward.userId, taxYear.userId),
          eq(lossCarryforward.kind, 'capital'),
          lt(lossCarryforward.fromYear, taxYear.year),
          isNull(lossCarryforward.consumedByYear),
        ),
      );
    return openLosses.reduce((sum, row) => sum + row.amountAgorot, 0);
  }

  app.post('/tax-years/:id/calculate', async (req, reply) => {
    const taxYear = await loadTaxYear((req.params as { id: string }).id, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    const parsed = CalculateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: MSG.invalidCalculateBody });
    }

    const lossCarryforwardInAgorot = await openLossCarryforwardInAgorot(taxYear);

    const confirmed = await latestConfirmedByDocument(taxYear.id);
    const { input, excludedDonations } = mapConfirmedData({
      year: taxYear.year,
      taxpayer: parsed.data.taxpayer,
      documents: confirmed,
      lossCarryforwardInAgorot,
    });

    let result: TaxReturnResult;
    try {
      result = calculate(input);
    } catch (err) {
      if (err instanceof TaxEngineError) {
        // The engine fails loudly with a precise (English) reason; keep it
        // for the audit trail but lead with Hebrew.
        return reply.code(400).send({ message: `שגיאה בחישוב: ${err.message}` });
      }
      throw err;
    }

    const row = await deps.db.transaction(async (tx) => {
      // Append-only snapshot: recalculations add rows, never overwrite.
      const [inserted] = await tx
        .insert(calculations)
        .values({
          taxYearId: taxYear.id,
          engineVersion: ENGINE_VERSION,
          input,
          result,
        })
        .returning();

      // The carry-forward table mirrors the LATEST calculation per year:
      // replace this year's row(s) rather than accumulating.
      await tx
        .delete(lossCarryforward)
        .where(
          and(
            eq(lossCarryforward.userId, taxYear.userId),
            eq(lossCarryforward.fromYear, taxYear.year),
          ),
        );
      if (result.lossCarryforwardOutAgorot > 0) {
        // Upsert (not plain insert): a concurrent recalculation of the same
        // year may have deleted-nothing then inserted first, so collide onto
        // the unique (userId, fromYear, kind) row instead of duplicating it.
        await tx
          .insert(lossCarryforward)
          .values({
            userId: taxYear.userId,
            fromYear: taxYear.year,
            amountAgorot: result.lossCarryforwardOutAgorot,
            kind: 'capital',
          })
          .onConflictDoUpdate({
            target: [
              lossCarryforward.userId,
              lossCarryforward.fromYear,
              lossCarryforward.kind,
            ],
            set: {
              amountAgorot: result.lossCarryforwardOutAgorot,
              consumedByYear: null,
            },
          });
      }
      return inserted;
    });

    return reply.send({ ...row, metadata: { excludedDonations } });
  });

  /**
   * The data panel's projection (plan 2026-07-16-confirmed-data-panel.md):
   * the SAME mapConfirmedData the calculate route uses — so the panel shows
   * exactly what the next calculation will consume — returning ONLY the
   * document-derived fields. The stub taxpayer exists solely to satisfy the
   * mapper's signature and never leaves this handler.
   */
  app.get('/tax-years/:id/confirmed-data', async (req, reply) => {
    const taxYear = await loadTaxYear((req.params as { id: string }).id, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    const lossCarryforwardInAgorot = await openLossCarryforwardInAgorot(taxYear);
    const confirmed = await latestConfirmedByDocument(taxYear.id);
    const { input, excludedDonations } = mapConfirmedData({
      year: taxYear.year,
      taxpayer: { gender: 'male', isIsraeliResident: true, additionalCreditPoints: 0 },
      documents: confirmed,
      lossCarryforwardInAgorot,
    });
    return {
      salaries: input.salaries,
      donations: input.donations,
      excludedDonations,
      capital: input.capital,
      // 15% non-linked deposit interest summed from the year's 867-ד' appendices
      // (Form 1301 field 078 / withholding 043); absent when no 867 carried it.
      nonLinkedInterest: input.nonLinkedInterest,
    };
  });

  app.get('/tax-years/:id/calculation', async (req, reply) => {
    const taxYear = await loadTaxYear((req.params as { id: string }).id, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    const [latest] = await deps.db
      .select()
      .from(calculations)
      .where(eq(calculations.taxYearId, taxYear.id))
      .orderBy(desc(calculations.createdAt))
      .limit(1);
    if (!latest) return reply.code(404).send({ message: MSG.noCalculation });

    // Stale when any confirmed_data row of the year's documents is newer
    // than the snapshot (a document was re-confirmed after calculating), OR
    // when confirmed data was REMOVED after it (per-document deletion bumps
    // data_revised_at — deleted rows can't be seen by the timestamp join,
    // they only make the year look LESS recently confirmed).
    const [newerConfirmation] = await deps.db
      .select({ id: confirmedData.id })
      .from(confirmedData)
      .innerJoin(documents, eq(confirmedData.documentId, documents.id))
      .where(
        and(
          eq(documents.taxYearId, taxYear.id),
          gt(confirmedData.confirmedAt, latest.createdAt),
        ),
      )
      .limit(1);
    const staleByDeletion =
      taxYear.dataRevisedAt !== null && taxYear.dataRevisedAt > latest.createdAt;

    return reply.send({ ...latest, stale: Boolean(newerConfirmation) || staleByDeletion });
  });

  app.patch('/tax-years/:id/status', async (req, reply) => {
    const taxYear = await loadTaxYear((req.params as { id: string }).id, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    const parsed = TaxYearStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: MSG.invalidStatusBody });
    }

    const current = taxYear.status;
    const target = parsed.data.status;
    if (!LEGAL_TRANSITIONS[current].includes(target)) {
      return reply.code(400).send({
        message:
          `לא ניתן לעבור מסטטוס "${HEBREW_STATUS[current]}" (${current}) ` +
          `לסטטוס "${HEBREW_STATUS[target]}" (${target})`,
      });
    }

    // filedAt records the (first/last) filing moment; transitions away from
    // `filed` deliberately keep it as history.
    const [updated] = await deps.db
      .update(taxYears)
      .set(target === 'filed' ? { status: target, filedAt: new Date() } : { status: target })
      .where(eq(taxYears.id, taxYear.id))
      .returning();
    return reply.send(updated);
  });
}
