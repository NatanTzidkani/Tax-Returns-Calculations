import { TaxpayerProfileSchema } from '@taxreturns/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ResolvedDeps } from '../app';
import { requireUserId } from '../auth/session';
import { taxpayerProfiles } from '../db/schema';

const MSG = {
  noProfile: 'טרם נשמר פרופיל נישום',
  invalidProfileBody:
    'פרופיל הנישום אינו תקין — ילדים נשמרים לפי שנת לידה (yearOfBirth) בלבד, ' +
    'ללא שדות שנתיים (נקודות נוספות, ריבית, דגלי טופס 116ד)',
} as const;

/**
 * The taxpayer-profile PRE-FILL store (plan
 * docs/superpowers/plans/2026-07-14-taxpayer-profile.md). One row per user;
 * the ONLY consumer is the web worksheet form's pre-fill. The architectural
 * rule: these routes never touch `calculations`, and the calculate route
 * never reads this table — a stored profile must never enter the money path
 * without the reviewer resubmitting it through the form.
 */
export async function profileRoutes(
  app: FastifyInstance,
  opts: { deps: ResolvedDeps },
): Promise<void> {
  const { deps } = opts;

  app.get('/profile', async (req, reply) => {
    const [row] = await deps.db
      .select()
      .from(taxpayerProfiles)
      .where(eq(taxpayerProfiles.userId, requireUserId(req)));
    if (!row) {
      return reply.code(404).send({ message: MSG.noProfile });
    }
    return { payload: row.payload, updatedAt: row.updatedAt.toISOString() };
  });

  app.put('/profile', async (req, reply) => {
    const parsed = TaxpayerProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: MSG.invalidProfileBody });
    }
    // Upsert on the unique user_id (the loss_carryforward concurrency
    // pattern): a double-submit converges to one row.
    const [row] = await deps.db
      .insert(taxpayerProfiles)
      .values({
        userId: requireUserId(req),
        payload: parsed.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: taxpayerProfiles.userId,
        set: { payload: parsed.data, updatedAt: new Date() },
      })
      .returning();
    return { payload: row!.payload, updatedAt: row!.updatedAt.toISOString() };
  });
}
