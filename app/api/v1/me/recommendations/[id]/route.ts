import { requireUser } from '@/lib/api/auth';
import { E, noContent, route } from '@/lib/api/http';
import { db, ensureSchema } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Own recommendations only. */
export const DELETE = route<{ id: string }>(async ({ req, rate, params }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  if (!UUID.test(params.id)) throw E.notFound();
  await ensureSchema();
  const rows = await db().query('delete from user_recommendations where id = $1 and user_id = $2 returning id', [params.id, user.id]);
  if (!rows.length) throw E.notFound();
  return noContent();
});
