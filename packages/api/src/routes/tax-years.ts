import { desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ResolvedDeps } from '../app';
import { requireUserId } from '../auth/session';
import { calculations, taxYears } from '../db/schema';

const CreateTaxYearBody = z.object({
  year: z.number().int().min(2000).max(2100),
});

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

  app.get('/tax-years', async () => {
    const years = await deps.db.select().from(taxYears).orderBy(desc(taxYears.year));

    // Latest calculation per year → dashboard refund estimate (Plan 5).
    const latest = await deps.db
      .selectDistinctOn([calculations.taxYearId], {
        taxYearId: calculations.taxYearId,
        result: calculations.result,
      })
      .from(calculations)
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
}
