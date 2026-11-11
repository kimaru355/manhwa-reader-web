import { requireUser } from '@/lib/api/auth';
import { body, E, json, query, route } from '@/lib/api/http';
import { dailyCap } from '@/lib/api/ratelimit';
import { communityBookmarkBody, communityBookmarksQuery } from '@/lib/api/schemas';
import { db, ensureSchema } from '@/lib/db';

const DAILY_CAP = 20;

type Row = { id: string; chapter_id: string; chapter_name: string; page: number; note: string | null; created_at: string | Date };

/** Approved community bookmarks for one title. Nothing about who suggested them is exposed. */
export const GET = route(
  async ({ req }) => {
    const q = query(req, communityBookmarksQuery);
    await ensureSchema();
    const rows = (await db().query(
      `select id, chapter_id, chapter_name, page, note, created_at from community_bookmarks
       where status = 'approved' and source = $1 and series_id = $2 order by created_at`,
      [q.source, q.seriesId],
    )) as Row[];
    return json(
      {
        items: rows.map((r) => ({
          id: r.id,
          chapterId: r.chapter_id,
          chapterName: r.chapter_name,
          page: r.page,
          note: r.note,
          createdAt: new Date(r.created_at).toISOString(),
        })),
      },
      200,
      { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    );
  },
  { rate: 'read' },
);

/** Suggests a bookmark. It stays hidden (pending) until an admin approves it. */
export const POST = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('write', user.id);
  const b = await body(req, communityBookmarkBody);
  await ensureSchema();

  const existing = await db().query(
    `select status from community_bookmarks where user_id = $1 and source = $2 and series_id = $3 and chapter_id = $4 and page = $5`,
    [user.id, b.source, b.seriesId, b.chapterId, b.page],
  );
  if (existing.length) {
    throw E.conflict(
      existing[0].status === 'rejected' ? 'That bookmark was reviewed and not accepted.' : 'You already suggested this bookmark.',
    );
  }
  await dailyCap('community_bookmarks', user.id, DAILY_CAP);

  const rows = await db().query(
    `insert into community_bookmarks (user_id, source, series_id, series_title, chapter_id, chapter_name, page, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, status`,
    [user.id, b.source, b.seriesId, b.seriesTitle.trim(), b.chapterId, b.chapterName.trim(), b.page, b.note?.trim() || null],
  );
  return json({ id: rows[0].id, status: rows[0].status }, 201);
});
