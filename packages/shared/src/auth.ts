import { z } from 'zod';

/** What `/auth/me` and `/auth/google` return — the single owner's identity. */
export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
