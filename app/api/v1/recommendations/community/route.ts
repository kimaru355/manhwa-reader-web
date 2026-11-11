import { E, json, query, route } from '@/lib/api/http';
import { publicRec, type RecRow } from '@/lib/api/recs';
import { communityQuery } from '@/lib/api/schemas';
import { db, ensureSchema } from '@/lib/db';

type Cursor = { t: string; id: string };

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString());
    if (typeof c.t === 'string' && typeof c.id === 'string' && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {
    /* fall through */
  }
  throw E.invalid('Bad cursor.');
}

/**
 * Public, newest first. Exposes only the fields in `publicRec`. The adult "interesting" category is
 * left out unless the request says ?adult=1 (the app sends it only from the Interesting tab).
 */
export const GET = route(
  async ({ req }) => {
    const q = query(req, communityQuery);
    await ensureSchema();

    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace('?', `$${args.length}`));
    };
    if (q.category) add('category = ?', q.category);
    if (q.tier) add('tier = ?', q.tier);
    if (q.source) add('source = ?', q.source);
    if (q.adult !== '1') where.push(`category <> 'interesting'`);
    if (q.cursor) {
      const c = decode(q.cursor);
      args.push(c.t, c.id);
      where.push(`(created_at, id) < ($${args.length - 1}::timestamptz, $${args.length}::uuid)`);
    }
    args.push(q.limit + 1);
    const rows = (await db().query(
      `select id, source, series_id, title, cover, url, category, tier, note, created_at
       from user_recommendations ${where.length ? 'where ' + where.join(' and ') : ''}
       order by created_at desc, id desc limit $${args.length}`,
      args,
    )) as RecRow[];

    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return json(
      {
        items: page.map(publicRec),
        nextCursor: rows.length > q.limit && last ? encode({ t: new Date(last.created_at).toISOString(), id: last.id }) : null,
      },
      200,
      { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    );
  },
  { rate: 'read' },
);
