import { requireUser } from '@/lib/api/auth';
import { body, json, route } from '@/lib/api/http';
import { publicRec, type RecRow } from '@/lib/api/recs';
import { dailyCap } from '@/lib/api/ratelimit';
import { recBody } from '@/lib/api/schemas';
import { db, ensureSchema } from '@/lib/db';

const DAILY_CAP = 50;

/** The signed-in user's own recommendations. */
export const GET = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('read', user.id);
  await ensureSchema();
  const rows = (await db().query('select * from user_recommendations where user_id = $1 order by created_at desc', [user.id])) as RecRow[];
  return json({ items: rows.map(publicRec) }, 200, { 'Cache-Control': 'private, no-store' });
});

/** Creates or updates (unique on user + source + series id). */
export const POST = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  const r = await body(req, recBody);
  await ensureSchema();

  const existing = await db().query('select 1 from user_recommendations where user_id = $1 and source = $2 and series_id = $3', [
    user.id,
    r.source,
    r.seriesId,
  ]);
  if (!existing.length) await dailyCap('user_recommendations', user.id, DAILY_CAP);

  const rows = (await db().query(
    `insert into user_recommendations (user_id, source, series_id, title, cover, url, category, tier, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (user_id, source, series_id) do update set title = excluded.title, cover = excluded.cover, url = excluded.url,
       category = excluded.category, tier = excluded.tier, note = excluded.note, updated_at = now()
     returning *`,
    [user.id, r.source, r.seriesId, r.title, r.cover ?? null, r.url ?? null, r.category, r.tier, r.note?.trim() || null],
  )) as RecRow[];
  return json(publicRec(rows[0]), existing.length ? 200 : 201);
});
