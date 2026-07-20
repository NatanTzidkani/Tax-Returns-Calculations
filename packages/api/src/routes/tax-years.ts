import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ResolvedDeps } from '../app';
import { requireUserId } from '../auth/session';
import { calculations, documents, lossCarryforward, taxYears } from '../db/schema';
import { deleteBlobsBestEffort, deleteDocumentRows } from '../documents/cascade';

const CreateTaxYearBody = z.object({
  year: z.number().int().min(2000).max(2100),
});

const uuid = z.uuid();

const MSG = {
  taxYearNotFound: 'שנת המס לא נמצאה',
} as const;

/** Postgres unique_violation, possibly wrapped by DrizzleQueryError. */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e instanceof Error; e = e.cause as Error) {
    if ((e as { code?: unknown }).code === '23505') return true;
    if (!(e.cause instanceof Error)) break;
  }
  return false;
}

export async function taxYearRoutes(
  app: FastifyInstance,
  opts: { deps: ResolvedDeps },
): Promise<void> {
  const { deps } = opts;

  app.post('/tax-years', async (req, reply) => {
    const parsed = CreateTaxYearBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ message: 'שנת מס לא תקינה — יש לשלוח מספר שנה שלם, למשל 2025' });
    }
    const currentYear = new Date().getUTCFullYear();
    if (parsed.data.year > currentYear) {
      return reply.code(400).send({
        message: `לא ניתן להוסיף שנת מס עתידית — השנה הנוכחית היא ${currentYear}`,
      });
    }

    const userId = requireUserId(req);
    try {
      const [row] = await deps.db
        .insert(taxYears)
        .values({ userId, year: parsed.data.year })
        .returning();
      return reply.code(201).send(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply
          .code(409)
          .send({ message: `שנת המס ${parsed.data.year} כבר קיימת` });
      }
      throw err;
    }
  });

  app.get('/tax-years', async (req) => {
    const userId = requireUserId(req);
    // Scoped to the requester — never leak another user's years (e.g. stray
    // rows from the pre-Google single-default-user era).
    const years = await deps.db
      .select()
      .from(taxYears)
      .where(eq(taxYears.userId, userId))
      .orderBy(desc(taxYears.year));

    // Latest calculation per year → dashboard refund estimate (Plan 5).
    // Joined to the requester's OWN years: without the scope this would pull
    // every user's calculations into memory (the map lookup below would still
    // filter the output, but the query must not fetch foreign rows at all).
    const latest = await deps.db
      .selectDistinctOn([calculations.taxYearId], {
        taxYearId: calculations.taxYearId,
        result: calculations.result,
      })
      .from(calculations)
      .innerJoin(taxYears, eq(calculations.taxYearId, taxYears.id))
      .where(eq(taxYears.userId, userId))
      .orderBy(calculations.taxYearId, desc(calculations.createdAt));
    const refundByYear = new Map(
      latest.map((row) => [
        row.taxYearId,
        (row.result as { refundAgorot?: number }).refundAgorot ?? null,
      ]),
    );

    return years.map((year) => ({
      ...year,
      refundEstimateAgorot: refundByYear.get(year.id) ?? null,
    }));
  });

  app.delete('/tax-years/:id', async (req, reply) => {
    // Non-UUID ids 404 (never a 500) — mirrors the calculations.ts guard.
    const parsed = uuid.safeParse((req.params as { id: string }).id);
    if (!parsed.success) {
      return reply.code(404).send({ message: MSG.taxYearNotFound });
    }
    const userId = requireUserId(req);
    const [taxYear] = await deps.db
      .select()
      .from(taxYears)
      .where(and(eq(taxYears.id, parsed.data), eq(taxYears.userId, userId)));
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    // Storage keys are collected before the DB rows disappear; the blobs are
    // deleted after the transaction commits (filesystem writes can't join it).
    const docRows = await deps.db
      .select({ id: documents.id, storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.taxYearId, taxYear.id));
    const documentIds = docRows.map((d) => d.id);

    // Cascade in FK-safe order: leaf children first, the tax_years row last.
    // The document-child slice (extracted → confirmed → documents) is shared
    // with DELETE /documents/:id — see documents/cascade.ts.
    await deps.db.transaction(async (tx) => {
      await tx.delete(calculations).where(eq(calculations.taxYearId, taxYear.id));
      await tx
        .delete(lossCarryforward)
        .where(
          and(
            eq(lossCarryforward.userId, taxYear.userId),
            eq(lossCarryforward.fromYear, taxYear.year),
          ),
        );
      await deleteDocumentRows(tx, documentIds);
      await tx.delete(taxYears).where(eq(taxYears.id, taxYear.id));
    });

    await deleteBlobsBestEffort(
      deps.storage,
      docRows.map((d) => d.storageKey),
    );

    return reply.code(204).send();
  });
}
