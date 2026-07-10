import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ResolvedDeps } from '../app';
import { users } from '../db/schema';

const GoogleSignInBody = z.object({
  credential: z.string().min(1),
});

const MSG = {
  invalidBody: 'בקשת התחברות לא תקינה — חסר אסימון התחברות (credential)',
  invalidToken: 'אסימון ההתחברות אינו תקין או שפג תוקפו',
  notOwner: 'ההתחברות אינה מורשית עבור חשבון Google זה',
  noSession: 'יש להתחבר כדי להמשיך',
} as const;

export async function authRoutes(
  app: FastifyInstance,
  opts: { deps: ResolvedDeps },
): Promise<void> {
  const { deps } = opts;

  app.post('/auth/google', async (req, reply) => {
    const parsed = GoogleSignInBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: MSG.invalidBody });
    }

    const info = await deps.googleVerifier.verifyIdToken(parsed.data.credential);
    if (!info) {
      return reply.code(401).send({ message: MSG.invalidToken });
    }

    const ownerEmail = process.env.OWNER_GOOGLE_EMAIL;
    const isOwner =
      info.emailVerified &&
      !!ownerEmail &&
      info.email.toLowerCase() === ownerEmail.toLowerCase();
    if (!isOwner) {
      return reply.code(403).send({ message: MSG.notOwner });
    }

    // Same upsert-by-email pattern the old defaultUserId() used.
    await deps.db.insert(users).values({ email: info.email }).onConflictDoNothing();
    const [user] = await deps.db.select().from(users).where(eq(users.email, info.email));
    if (!user) throw new Error(`user ${info.email} missing after upsert`);

    req.session.set('userId', user.id);
    return reply.code(200).send({ id: user.id, email: user.email });
  });

  app.get('/auth/me', async (req, reply) => {
    const userId = req.session.get('userId');
    if (!userId) return reply.code(401).send({ message: MSG.noSession });

    const [user] = await deps.db.select().from(users).where(eq(users.id, userId));
    if (!user) return reply.code(401).send({ message: MSG.noSession });

    return reply.send({ id: user.id, email: user.email });
  });

  app.post('/auth/logout', async (req, reply) => {
    req.session.delete();
    return reply.code(204).send();
  });
}
