// Integration test for /api/v1 against a locally running server, with a MOCK Neon Auth JWKS.
//
//   1. npm run build
//   2. NEON_AUTH_BASE_URL=http://localhost:4100/auth npx next start -p 3060   (other env from .env.local)
//   3. npx tsx --env-file=.env.local scripts/e2e.mts
//
// It inserts two throwaway rows in neon_auth."user" (the sync tables reference it) and deletes them at the end.
import { createServer } from 'node:http';
import { neon } from '@neondatabase/serverless';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const API = process.env.API ?? 'http://localhost:3060';
const sql = neon(process.env.DATABASE_URL!);

const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), alg: 'EdDSA', kid: 'e2e' };
const jwks = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ keys: [jwk] }));
}).listen(4100);

let failed = 0;
const ok = (name: string, cond: unknown, extra?: unknown) => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + JSON.stringify(extra)}`);
};

async function mkUser(label: string) {
  const email = `e2e-${label}-${Date.now()}@example.invalid`;
  const rows = await sql.query(
    `insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values (gen_random_uuid(), 'e2e', $1, true, now(), now()) returning id`,
    [email],
  );
  const id = rows[0].id as string;
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'e2e' })
    .setSubject(id)
    .setIssuer('http://localhost:4100')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  return { id, email, token };
}

const call = async (method: string, path: string, token?: string | null, body?: unknown) => {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
};

const series = { key: 'hentai20:x', source: 'hentai20', id: 'x', title: 'X', category: 'interesting' };
const bm = { id: 'b1', seriesKey: 'hentai20:x', chapterId: 'c1', chapterName: 'Ch 1', page: 3, note: 'hi', ts: 1000, updatedAt: 2000 };

const A = await mkUser('a');
const B = await mkUser('b');
try {
  // auth required
  let r = await call('GET', '/api/v1/me/sync');
  ok('no token -> 401 unauthorized', r.status === 401 && r.json.error.code === 'unauthorized' && r.json.error.requestId, r);
  r = await call('GET', '/api/v1/me/sync', 'not.a.jwt');
  ok('bad token -> 401', r.status === 401, r);

  // sync
  r = await call('GET', '/api/v1/me/sync', A.token);
  ok('empty sync', r.status === 200 && r.json.favorites.length === 0 && r.json.bookmarks.length === 0, r);
  r = await call('POST', '/api/v1/me/sync', A.token, {
    favorites: { put: [{ kind: 'favorite', seriesKey: series.key, series }], remove: [] },
    bookmarks: { put: [bm], remove: [] },
  });
  ok('sync write 204', r.status === 204, r);
  r = await call('GET', '/api/v1/me/sync', A.token);
  ok('sync read back', r.json.favorites[0]?.series.title === 'X' && r.json.bookmarks[0]?.updatedAt === 2000 && r.json.bookmarks[0]?.ts === 1000, r.json);
  r = await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [{ ...bm, note: 'changed', updatedAt: 3000 }], remove: [] } });
  r = await call('GET', '/api/v1/me/sync', A.token);
  ok('bookmark update keeps given timestamps', r.json.bookmarks[0].note === 'changed' && r.json.bookmarks[0].updatedAt === 3000, r.json);
  r = await call('GET', '/api/v1/me/sync', B.token);
  ok("user B can't see user A's rows", r.json.favorites.length === 0 && r.json.bookmarks.length === 0, r.json);
  r = await call('POST', '/api/v1/me/sync', B.token, { bookmarks: { put: [], remove: ['b1'] } });
  r = await call('GET', '/api/v1/me/sync', A.token);
  ok("user B can't delete user A's bookmark", r.json.bookmarks.length === 1, r.json);
  r = await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [{ ...bm, extra: 1 }], remove: [] } });
  ok('unknown field rejected', r.status === 400 && r.json.error.code === 'invalid_input', r);
  r = await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [{ ...bm, page: 0 }], remove: [] } });
  ok('page must be > 0', r.status === 400, r);
  r = await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [{ ...bm, note: 'x'.repeat(201) }], remove: [] } });
  ok('note <= 200 chars', r.status === 400, r);
  r = await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [], remove: Array.from({ length: 501 }, (_, i) => 'i' + i) } });
  ok('batch > 500 rejected', r.status === 400, r);
  r = await call('POST', '/api/v1/me/sync', A.token, { favorites: { put: [{ kind: 'favorite', seriesKey: 'other', series }], remove: [] } });
  ok('seriesKey must match series.key', r.status === 400, r);
  r = await call('POST', '/api/v1/me/sync', A.token, {
    favorites: { put: [], remove: [{ kind: 'favorite', seriesKey: series.key }] },
    bookmarks: { put: [], remove: ['b1'] },
  });
  r = await call('GET', '/api/v1/me/sync', A.token);
  ok('removals work', r.json.favorites.length === 0 && r.json.bookmarks.length === 0, r.json);

  // user recommendations
  const rec = { source: 'mangadex', seriesId: 'abc', title: 'Adult-free', category: 'manga', tier: 'good', note: 'nice' };
  r = await call('POST', '/api/v1/me/recommendations', A.token, rec);
  ok('create recommendation 201', r.status === 201 && r.json.id && r.json.seriesId === 'abc' && !('userId' in r.json) && !('user_id' in r.json), r);
  const recId = r.json.id as string;
  r = await call('POST', '/api/v1/me/recommendations', A.token, { ...rec, tier: 'all-time' });
  ok('same title again updates (200)', r.status === 200 && r.json.tier === 'all-time' && r.json.id === recId, r);
  r = await call('POST', '/api/v1/me/recommendations', A.token, { ...rec, seriesId: 'adult1', category: 'interesting', title: 'Adult' });
  r = await call('POST', '/api/v1/me/recommendations', A.token, { ...rec, tier: 'nope' });
  ok('bad tier rejected', r.status === 400, r);
  r = await call('GET', '/api/v1/me/recommendations', A.token);
  ok('list own', r.json.items.length === 2, r.json);
  r = await call('GET', '/api/v1/me/recommendations', B.token);
  ok("B doesn't see A's", r.json.items.length === 0, r.json);

  // community
  const mine = (j: { items: { seriesId: string }[] }) => j.items.filter((i) => ['abc', 'adult1'].includes(i.seriesId)).map((i) => i.seriesId);
  r = await call('GET', '/api/v1/recommendations/community?limit=50');
  ok('community hides interesting by default', r.status === 200 && mine(r.json).join() === 'abc', r.json);
  ok('community has no user info', !JSON.stringify(r.json).match(/user_?id|email/i), r.json);
  r = await call('GET', '/api/v1/recommendations/community?limit=50&adult=1');
  ok('community adult=1 includes interesting', mine(r.json).sort().join() === 'abc,adult1', r.json);
  r = await call('GET', '/api/v1/recommendations/community?limit=1&adult=1');
  ok('pagination gives nextCursor', r.json.items.length === 1 && typeof r.json.nextCursor === 'string', r.json);
  const r2 = await call('GET', `/api/v1/recommendations/community?limit=1&adult=1&cursor=${r.json.nextCursor}`);
  ok('next page differs', r2.status === 200 && r2.json.items[0]?.id !== r.json.items[0].id, r2.json);
  r = await call('GET', '/api/v1/recommendations/community?limit=999');
  ok('limit max 50', r.status === 400, r);
  r = await call('GET', '/api/v1/recommendations/community?tier=wrong');
  ok('bad filter rejected', r.status === 400, r);

  // delete own only
  r = await call('DELETE', `/api/v1/me/recommendations/${recId}`, B.token);
  ok("B can't delete A's recommendation (404)", r.status === 404, r);
  r = await call('DELETE', `/api/v1/me/recommendations/${recId}`, A.token);
  ok('A deletes own (204)', r.status === 204, r);
  r = await call('DELETE', `/api/v1/me/recommendations/not-a-uuid`, A.token);
  ok('bad id -> 404', r.status === 404, r);

  // community: votes, sorting, filters
  const recBody = { source: 'mangadex', seriesId: 'e2e-vote-1', title: 'E2E Votable', category: 'manga', tier: 'good', note: 'x' };
  r = await call('POST', '/api/v1/me/recommendations', B.token, recBody);
  const voteId = r.json.id as string;
  r = await call('PUT', `/api/v1/community/recommendations/${voteId}/vote`, B.token);
  ok("can't vote for your own recommendation (403)", r.status === 403, r);
  r = await call('PUT', `/api/v1/community/recommendations/${voteId}/vote`, A.token);
  ok('vote counts', r.status === 200 && r.json.votes === 1 && r.json.voted === true, r);
  r = await call('PUT', `/api/v1/community/recommendations/${voteId}/vote`, A.token);
  ok('voting twice is the same as once', r.json.votes === 1, r);
  r = await call('GET', '/api/v1/recommendations/community?sort=popular&limit=5', A.token);
  ok('popular lists it first with voted=true', r.json.items[0]?.id === voteId && r.json.items[0].votes === 1 && r.json.items[0].voted === true, r.json);
  r = await call('GET', '/api/v1/recommendations/community?sort=popular&limit=5');
  ok('anonymous sees votes but voted=false', r.json.items[0]?.votes === 1 && r.json.items[0].voted === false, r.json);
  r = await call('GET', '/api/v1/recommendations/community?sort=week&q=votable');
  ok('week sort + title search', r.json.items.length === 1 && r.json.items[0].id === voteId, r.json);
  r = await call('GET', '/api/v1/recommendations/community?q=%25');
  ok('% in search is literal, not a wildcard', r.json.items.length === 0, r.json);
  r = await call('GET', '/api/v1/recommendations/community?sort=nonsense');
  ok('bad sort -> 400', r.status === 400, r);
  r = await call('DELETE', `/api/v1/community/recommendations/${voteId}/vote`, A.token);
  ok('unvote', r.json.votes === 0 && r.json.voted === false, r);
  r = await call('PUT', `/api/v1/community/recommendations/not-a-uuid/vote`, A.token);
  ok('vote on bad id -> 404', r.status === 404, r);
  r = await call('PUT', `/api/v1/community/recommendations/${voteId}/vote`);
  ok('vote needs sign-in', r.status === 401, r);
  await call('DELETE', `/api/v1/me/recommendations/${voteId}`, B.token);

  // community bookmarks: submit -> hidden until approved
  const cb = { source: 'mangadex', seriesId: 'e2e-series', seriesTitle: 'E2E Series', chapterId: 'e2e-ch-1', chapterName: 'Ch. 1', page: 4, note: 'great panel' };
  r = await call('POST', '/api/v1/community/bookmarks', A.token, cb);
  ok('submit bookmark -> pending (201)', r.status === 201 && r.json.status === 'pending', r);
  const cbId = r.json.id as string;
  r = await call('POST', '/api/v1/community/bookmarks', A.token, cb);
  ok('duplicate submission -> 409', r.status === 409, r);
  r = await call('POST', '/api/v1/community/bookmarks', null, cb);
  ok('submit needs sign-in', r.status === 401, r);
  r = await call('POST', '/api/v1/community/bookmarks', A.token, { ...cb, source: 'external', page: 5 });
  ok('external source not allowed', r.status === 400, r);
  r = await call('GET', '/api/v1/community/bookmarks?source=mangadex&seriesId=e2e-series');
  ok('pending bookmark is not public', r.status === 200 && r.json.items.length === 0, r.json);
  r = await call('GET', '/api/v1/me/community-bookmarks', A.token);
  ok('owner sees pending submission', r.json.items[0]?.status === 'pending', r.json);
  r = await call('GET', '/api/v1/me/community-bookmarks', B.token);
  ok("other users don't see it", r.json.items.length === 0, r.json);
  await sql.query(`update community_bookmarks set status='approved' where id=$1`, [cbId]);
  r = await call('GET', '/api/v1/community/bookmarks?source=mangadex&seriesId=e2e-series');
  ok('approved bookmark is public, without user info', r.json.items.length === 1 && r.json.items[0].page === 4 && !('userId' in r.json.items[0]) && !('user_id' in r.json.items[0]), r.json);
  r = await call('DELETE', `/api/v1/me/community-bookmarks/${cbId}`, B.token);
  ok("B can't withdraw A's suggestion (404)", r.status === 404, r);
  r = await call('DELETE', `/api/v1/me/community-bookmarks/${cbId}`, A.token);
  ok('A withdraws own (204)', r.status === 204, r);

  // account deletion removes everything
  await call('POST', '/api/v1/me/sync', A.token, { bookmarks: { put: [bm], remove: [] } });
  r = await call('DELETE', '/api/v1/me', A.token);
  ok('DELETE /me 204', r.status === 204, r);
  const left = await sql.query(
    `select (select count(*) from bookmarks where user_id=$1)::int b, (select count(*) from user_recommendations where user_id=$1)::int r, (select count(*) from community_bookmarks where user_id=$1)::int cb,
            (select count(*) from neon_auth."user" where id=$1)::int u`,
    [A.id],
  );
  ok('account and all rows gone', left[0].b === 0 && left[0].r === 0 && left[0].cb === 0 && left[0].u === 0, left[0]);

  // other endpoints
  r = await call('GET', '/recommendations.json');
  ok('recommendations.json has ETag + cache', r.status === 200 && r.headers.get('etag') && /s-maxage=300/.test(r.headers.get('cache-control') ?? ''), [...r.headers]);
  const et = r.headers.get('etag')!;
  const cond = await fetch(API + '/recommendations.json', { headers: { 'If-None-Match': et } });
  ok('If-None-Match -> 304', cond.status === 304, cond.status);
  r = await call('POST', '/api/v1/auth/forgot', null, { email: 'nobody@example.invalid' });
  ok('forgot always 204', r.status === 204, r);
  r = await call('POST', '/api/v1/auth/signup', null, { email: 'bad', password: 'x' });
  ok('signup validates input', r.status === 400 && r.json.error.code === 'invalid_input', r);
  r = await call('POST', '/api/v1/auth/signin', null, { email: 'a@b.co', password: 'x', extra: 1 });
  ok('signin rejects unknown fields', r.status === 400, r);

  // rate limit: 10/min for auth endpoints (per IP)
  let limited = 0;
  for (let i = 0; i < 14; i++) if ((await call('POST', '/api/v1/auth/refresh', null, { refreshToken: 'x' })).status === 429) limited++;
  ok('auth rate limit kicks in (429)', limited >= 1, limited);
} finally {
  await sql.query('delete from neon_auth."user" where id = any($1::uuid[])', [[A.id, B.id]]);
  jwks.close();
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}
