import { requireUser } from '@/lib/api/auth';
import { E, json, route } from '@/lib/api/http';
import { db, ensureSchema } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function check(id: string, userId: string) {
  if (!UUID.test(id)) throw E.notFound();
  await ensureSchema();
  const rows = await db().query('select user_id from user_recommendations where id = $1', [id]);
  if (!rows.length) throw E.notFound();
  if (rows[0].user_id === userId) throw E.forbidden("You can't vote for your own recommendation.");
}

const count = async (id: string) =>
  Number((await db().query('select count(*)::int as n from recommendation_votes where recommendation_id = $1', [id]))[0].n);

/** Upvote. Idempotent: voting twice is the same as once. */
export const PUT = route<{ id: string }>(async ({ req, rate, params }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  await check(params.id, user.id);
  await db().query('insert into recommendation_votes (user_id, recommendation_id) values ($1, $2) on conflict do nothing', [
    user.id,
    params.id,
  ]);
  return json({ votes: await count(params.id), voted: true });
});

/** Takes the vote back. */
export const DELETE = route<{ id: string }>(async ({ req, rate, params }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  await check(params.id, user.id);
  await db().query('delete from recommendation_votes where user_id = $1 and recommendation_id = $2', [user.id, params.id]);
  return json({ votes: await count(params.id), voted: false });
});
