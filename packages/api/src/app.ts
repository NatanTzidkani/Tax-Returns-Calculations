import Anthropic from '@anthropic-ai/sdk';
import multipart from '@fastify/multipart';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { registerSession } from './auth/session';
import {
  createGoogleTokenVerifier,
  type GoogleTokenVerifier,
} from './auth/verify-google-token';
import { getDb } from './db/client';
import type * as schema from './db/schema';
import type { ExtractionClient } from './extraction/extractor';
import { authRoutes } from './routes/auth';
import { calculationRoutes } from './routes/calculations';
import { documentRoutes } from './routes/documents';
import { taxYearRoutes } from './routes/tax-years';
import type { Storage } from './storage/index';
import { LocalDiskStorage } from './storage/local-disk';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type Db = NodePgDatabase<typeof schema>;

/** Injectable seams — tests pass all four; the server passes none. */
export interface AppDeps {
  db?: Db;
  storage?: Storage;
  anthropic?: ExtractionClient;
  googleVerifier?: GoogleTokenVerifier;
}

export interface ResolvedDeps {
  readonly db: Db;
  readonly storage: Storage;
  readonly anthropic: ExtractionClient;
  readonly googleVerifier: GoogleTokenVerifier;
}

/** Generic Hebrew messages for errors thrown outside route handlers. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'בקשה שגויה',
  404: 'הנתיב לא נמצא',
  413: 'הקובץ גדול מדי — המגבלה היא 15MB',
  415: 'סוג תוכן לא נתמך',
  500: 'שגיאה פנימית בשרת',
};

/** Routes reachable without a session — Docker healthchecks and sign-in itself. */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set(['GET /health', 'POST /auth/google']);

const AUTH_REQUIRED_MESSAGE = 'יש להתחבר כדי לגשת למשאב זה';

export function buildApp(deps: AppDeps = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  // Defaults resolve lazily so buildApp() works without env vars
  // (DATABASE_URL / ANTHROPIC_API_KEY / GOOGLE_CLIENT_ID) until a route
  // actually needs them.
  let storage = deps.storage;
  let anthropic = deps.anthropic;
  let googleVerifier = deps.googleVerifier;
  const resolved: ResolvedDeps = {
    get db() {
      return deps.db ?? getDb();
    },
    get storage() {
      storage ??= new LocalDiskStorage(process.env.STORAGE_PATH ?? './data/documents');
      return storage;
    },
    get anthropic() {
      anthropic ??= new Anthropic();
      return anthropic;
    },
    get googleVerifier() {
      googleVerifier ??= createGoogleTokenVerifier();
      return googleVerifier;
    },
  };

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const status =
      typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) app.log.error(err);
    reply
      .code(status)
      .send({ message: STATUS_MESSAGES[status] ?? 'שגיאה בעיבוד הבקשה' });
  });
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ message: STATUS_MESSAGES[404] });
  });

  // Registered at the root, before any route, so the session decorator and
  // the auth gate below apply to every route in the app — including ones
  // registered later via child plugins (taxYearRoutes/documentRoutes).
  registerSession(app);

  // Global auth gate: everything requires a session except /health (Docker
  // healthchecks) and POST /auth/google (sign-in itself, pre-session by
  // definition). A single root-level hook is simpler and harder to
  // accidentally bypass than opting every route-group plugin in individually.
  app.addHook('preHandler', async (req, reply) => {
    const key = `${req.method} ${req.url.split('?')[0]}`;
    if (PUBLIC_ROUTES.has(key)) return;
    if (!req.session.get('userId')) {
      reply.code(401).send({ message: AUTH_REQUIRED_MESSAGE });
    }
  });

  app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(authRoutes, { deps: resolved });
  app.register(taxYearRoutes, { deps: resolved });
  app.register(documentRoutes, { deps: resolved });
  app.register(calculationRoutes, { deps: resolved });

  return app;
}
