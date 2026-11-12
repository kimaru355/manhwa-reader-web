import { optionalUser } from '@/lib/api/auth';
import { E, json, query, route } from '@/lib/api/http';
import { publicRec, type RecRow } from '@/lib/api/recs';
import { communityQuery } from '@/lib/api/schemas';
import { db, ensureSchema } from '@/lib/db';

type Cursor = { r: number; t: string; id: string };

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString());
    if (typeof c.r === 'number' && typeof c.t === 'string' && typeof c.id === 'string' && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {
    /* fall through */
  }
  throw E.invalid('Bad cursor.');
}

/** Escapes LIKE wildcards so a search for "100%" matches the text, not everything. */
const likeOf = (text: string) => '%' + text.toLowerCase().replace(/[\\%_]/g, (c) => '\\' + c) + '%';

/**
 * Public community feed. `sort` is latest (newest first), popular (most votes ever) or week (most votes in
 * the last 7 days); ties fall back to newest. Optional filters: category, tier, source, q (title search).
 * Only the fields in `publicRec` are exposed. The adult "interesting" category is left out unless the request
 * says ?adult=1 (the app sends it only when the reader picks that filter). With a valid token each item also
 * says whether this reader has voted.
 */
export const GET = route(
  async ({ req }) => {
    const q = query(req, communityQuery);
    const user = await optionalUser(req);
    await ensureSchema();

    const args: unknown[] = [];
    const arg = (v: unknown) => {
      args.push(v);
      return `$${args.length}`;
    };

    const rank = q.sort === 'popular' ? 'coalesce(v.total, 0)' : q.sort === 'week' ? 'coalesce(v.week, 0)' : '0::int';
    const votedSql = user
      ? `exists (select 1 from recommendation_votes mv where mv.recommendation_id = r.id and mv.user_id = ${arg(user.id)}::uuid)`
      : 'false';

    const where: string[] = [];
    if (q.category) where.push(`r.category = ${arg(q.category)}`);
    if (q.tier) where.push(`r.tier = ${arg(q.tier)}`);
    if (q.source) where.push(`r.source = ${arg(q.source)}`);
    if (q.adult !== '1') where.push(`r.category <> 'interesting'`);
    if (q.q) where.push(`lower(r.title) like ${arg(likeOf(q.q))} escape '\\'`);
    if (q.cursor) {
      const c = decode(q.cursor);
      where.push(`(${rank}, r.created_at, r.id) < (${arg(c.r)}::int, ${arg(c.t)}::timestamptz, ${arg(c.id)}::uuid)`);
    }
    const limit = arg(q.limit + 1);

    const rows = (await db().query(
      `with v as (
         select recommendation_id as rid, count(*)::int as total,
                count(*) filter (where created_at > now() - interval '7 days')::int as week
         from recommendation_votes group by recommendation_id
       )
       select r.id, r.source, r.series_id, r.title, r.cover, r.url, r.category, r.tier, r.note, r.created_at,
              coalesce(v.total, 0) as votes, ${rank} as rank, ${votedSql} as voted
       from user_recommendations r left join v on v.rid = r.id
       ${where.length ? 'where ' + where.join(' and ') : ''}
       order by ${rank} desc, r.created_at desc, r.id desc
       limit ${limit}`,
      args,
    )) as (RecRow & { rank: number })[];

    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return json(
      {
        items: page.map(publicRec),
        nextCursor:
          rows.length > q.limit && last
            ? encode({ r: Number(last.rank), t: new Date(last.created_at).toISOString(), id: last.id })
            : null,
      },
      200,
      {
        'Cache-Control': user ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=120',
        Vary: 'Authorization',
      },
    );
  },
  { rate: 'read' },
);
