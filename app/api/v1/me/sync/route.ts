import { requireUser } from '@/lib/api/auth';
import { body, json, noContent, route } from '@/lib/api/http';
import { syncBody } from '@/lib/api/schemas';
import { db, ensureSchema } from '@/lib/db';

type FavRow = { kind: 'favorite' | 'wishlist'; series_key: string; series: unknown };
type BmRow = {
  id: string;
  series_key: string;
  chapter_id: string;
  chapter_name: string;
  page: number;
  note: string;
  created_at: string;
  updated_at: string;
};

/** Everything the signed-in user has stored. */
export const GET = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('read', user.id);
  await ensureSchema();
  const [favs, bms] = (await Promise.all([
    db().query('select kind, series_key, series from favorites where user_id = $1', [user.id]),
    db().query('select * from bookmarks where user_id = $1 order by created_at', [user.id]),
  ])) as unknown as [FavRow[], BmRow[]];
  return json(
    {
      favorites: favs.map((f) => ({ kind: f.kind, seriesKey: f.series_key, series: f.series })),
      bookmarks: bms.map((b) => ({
        id: b.id,
        seriesKey: b.series_key,
        chapterId: b.chapter_id,
        chapterName: b.chapter_name,
        page: b.page,
        note: b.note,
        ts: Number(b.created_at),
        updatedAt: Number(b.updated_at),
      })),
    },
    200,
    { 'Cache-Control': 'private, no-store' },
  );
});

/**
 * Applies a batch of puts and removes in one transaction. The app does the merge; the server only
 * validates and stores what it is given (bookmark timestamps are stored as sent).
 */
export const POST = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  const b = await body(req, syncBody);
  await ensureSchema();

  const q: ReturnType<ReturnType<typeof db>['query']>[] = [];
  const sql = db();
  for (const f of b.favorites?.remove ?? []) {
    q.push(sql.query('delete from favorites where user_id = $1 and kind = $2 and series_key = $3', [user.id, f.kind, f.seriesKey]));
  }
  for (const f of b.favorites?.put ?? []) {
    q.push(
      sql.query(
        `insert into favorites (user_id, kind, series_key, series) values ($1, $2, $3, $4::jsonb)
         on conflict (user_id, kind, series_key) do update set series = excluded.series, updated_at = now()`,
        [user.id, f.kind, f.seriesKey, JSON.stringify(f.series)],
      ),
    );
  }
  for (const id of b.bookmarks?.remove ?? []) {
    q.push(sql.query('delete from bookmarks where user_id = $1 and id = $2', [user.id, id]));
  }
  for (const m of b.bookmarks?.put ?? []) {
    q.push(
      sql.query(
        `insert into bookmarks (user_id, id, series_key, chapter_id, chapter_name, page, note, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (user_id, id) do update set series_key = excluded.series_key, chapter_id = excluded.chapter_id,
           chapter_name = excluded.chapter_name, page = excluded.page, note = excluded.note,
           created_at = excluded.created_at, updated_at = excluded.updated_at`,
        [user.id, m.id, m.seriesKey, m.chapterId, m.chapterName, m.page, m.note, m.ts, m.updatedAt ?? m.ts],
      ),
    );
  }
  if (q.length) await sql.transaction(q as never);
  return noContent();
});
