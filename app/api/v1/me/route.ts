import { requireUser } from '@/lib/api/auth';
import { noContent, route } from '@/lib/api/http';
import { db, ensureSchema } from '@/lib/db';

/**
 * Deletes the account and everything tied to it. favorites, bookmarks and user_recommendations
 * reference the auth user with ON DELETE CASCADE, and so do the auth sessions and accounts.
 */
export const DELETE = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  await ensureSchema();
  await db().query('delete from neon_auth."user" where id = $1', [user.id]);
  return noContent();
});
