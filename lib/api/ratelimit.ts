import { db, ensureSchema } from '@/lib/db';
import { E } from './http';

export type RateKind = 'auth' | 'write' | 'read';

const LIMITS: Record<RateKind, number> = { auth: 10, write: 60, read: 300 };
const WINDOW_MS = 60_000;

// Reads are limited in memory (best effort per instance, cheap). Auth and writes are counted in the
// database so the limit holds across serverless instances.
const mem = new Map<string, { n: number; reset: number }>();

export async function checkRate(kind: RateKind, key: string): Promise<void> {
  const max = LIMITS[kind];
  const now = Date.now();

  if (kind === 'read') {
    const k = `${kind}:${key}`;
    const e = mem.get(k);
    if (!e || e.reset < now) {
      mem.set(k, { n: 1, reset: now + WINDOW_MS });
      if (mem.size > 5000) for (const [mk, v] of mem) if (v.reset < now) mem.delete(mk);
      return;
    }
    if (++e.n > max) throw E.limited();
    return;
  }

  await ensureSchema();
  const bucket = Math.floor(now / WINDOW_MS);
  const rows = await db().query(
    `insert into rate_limits (key, bucket, n) values ($1, $2, 1)
     on conflict (key, bucket) do update set n = rate_limits.n + 1 returning n`,
    [`${kind}:${key}`, bucket],
  );
  if (Math.random() < 0.01) await db().query('delete from rate_limits where bucket < $1', [bucket - 10]);
  if (Number(rows[0].n) > max) throw E.limited();
}

/** Per-day cap for things users create (recommendations, bookmark suggestions). */
export async function dailyCap(
  table: 'user_recommendations' | 'community_bookmarks',
  userId: string,
  max: number,
): Promise<void> {
  const rows = await db().query(
    `select count(*)::int as c from ${table} where user_id = $1 and created_at > now() - interval '1 day'`,
    [userId],
  );
  if (Number(rows[0].c) >= max) throw E.limited('You have reached today\'s limit. Try again tomorrow.');
}
