import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

import {
  CATEGORIES,
  SOURCES,
  TIERS,
  type AuthorBookmark,
  type Category,
  type Rec,
  type SourceId,
  type SourcesMap,
  type Tier,
} from './shared';

export { CATEGORIES, SOURCES, TIERS };
export type { AuthorBookmark, Category, Rec, SourceId, SourcesMap, Tier };

export const DEFAULT_SOURCES: SourcesMap = {
  manga: [{ source: 'mangadex', name: 'MangaDex' }],
  manhwa: [{ source: 'webtoons', name: 'WEBTOON' }],
  interesting: [{ source: 'hentai20', name: 'Hentai20' }],
  novel: [],
};

let client: NeonQueryFunction<false, false> | null = null;
/** Created on first use so a missing DATABASE_URL only fails the queries, not the import. */
export const db = () => (client ??= neon(process.env.DATABASE_URL!));

let ready: Promise<void> | null = null;
export function ensureSchema() {
  ready ??= (async () => {
    await db().query(`create table if not exists recommendations (
      id serial primary key,
      source text not null,
      series_id text not null,
      title text not null,
      cover text,
      category text not null,
      tier text not null,
      note text,
      url text,
      bookmarks jsonb not null default '[]',
      position int not null default 0,
      updated_at timestamptz not null default now(),
      unique (source, series_id)
    )`);
    await db().query(`create table if not exists app_meta (key text primary key, value jsonb not null)`);

    // User data. user_id points at Neon Auth's user table, so deleting the account deletes everything below.
    await db().query(`create table if not exists favorites (
      user_id uuid not null references neon_auth."user"(id) on delete cascade,
      kind text not null check (kind in ('favorite','wishlist')),
      series_key text not null,
      series jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, kind, series_key)
    )`);
    await db().query(`create table if not exists bookmarks (
      user_id uuid not null references neon_auth."user"(id) on delete cascade,
      id text not null,
      series_key text not null,
      chapter_id text not null,
      chapter_name text not null,
      page int not null check (page > 0),
      note text not null default '' check (char_length(note) <= 200),
      created_at bigint not null,
      updated_at bigint not null,
      primary key (user_id, id)
    )`);
    await db().query(`create index if not exists bookmarks_user_series on bookmarks (user_id, series_key)`);
    await db().query(`create table if not exists user_recommendations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references neon_auth."user"(id) on delete cascade,
      source text not null check (source in ('mangadex','webtoons','hentai20','novelfull','novelbin','external')),
      series_id text not null,
      title text not null,
      cover text,
      url text,
      category text not null check (category in ('manga','manhwa','interesting','novel')),
      tier text not null check (tier in ('all-time','interesting','good','trial')),
      note text check (char_length(note) <= 500),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, source, series_id)
    )`);
    await db().query(
      `create index if not exists user_recs_public on user_recommendations (created_at desc, id desc)`,
    );
    await db().query(
      `create table if not exists recommendation_votes (
      user_id uuid not null references neon_auth."user"(id) on delete cascade,
      recommendation_id uuid not null references user_recommendations(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, recommendation_id)
    )`,
    );
    await db().query(
      `create index if not exists votes_by_rec on recommendation_votes (recommendation_id, created_at)`,
    );
    // Bookmarks suggested by readers. Only approved ones are ever shown to other people.
    await db().query(`create table if not exists community_bookmarks (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references neon_auth."user"(id) on delete cascade,
      source text not null check (source in ('mangadex','webtoons','hentai20','novelfull','novelbin')),
      series_id text not null,
      series_title text not null,
      chapter_id text not null,
      chapter_name text not null,
      page int not null check (page > 0),
      note text check (char_length(note) <= 300),
      status text not null default 'pending' check (status in ('pending','approved','rejected')),
      reject_reason text,
      created_at timestamptz not null default now(),
      reviewed_at timestamptz,
      reviewed_by text,
      unique (user_id, source, series_id, chapter_id, page)
    )`);
    await db().query(
      `create index if not exists community_bm_approved on community_bookmarks (source, series_id) where status = 'approved'`,
    );
    await db().query(`create index if not exists community_bm_status on community_bookmarks (status, created_at)`);
    // Tables made before novels were supported still list the old sources; widen their checks once.
    for (const [table, list] of [
      ['user_recommendations', `'mangadex','webtoons','hentai20','novelfull','novelbin','external'`],
      ['community_bookmarks', `'mangadex','webtoons','hentai20','novelfull','novelbin'`],
    ] as const) {
      await db().query(`do $$ declare c text; begin
        select conname into c from pg_constraint
          where conrelid = '${table}'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%hentai20%'
            and pg_get_constraintdef(oid) not like '%novelbin%';
        if c is not null then
          execute format('alter table ${table} drop constraint %I', c);
          execute 'alter table ${table} add constraint ${table}_source_check check (source in (${list.replace(/'/g, "''")}))';
        end if;
      end $$`);
    }
    await db().query(`create table if not exists rate_limits (
      key text not null, bucket bigint not null, n int not null default 0, primary key (key, bucket)
    )`);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

type Row = {
  id: number;
  source: SourceId;
  series_id: string;
  title: string;
  cover: string | null;
  category: Category;
  tier: Tier;
  note: string | null;
  url: string | null;
  bookmarks: AuthorBookmark[];
};

const toRec = (r: Row): Rec => ({
  id: r.id,
  source: r.source,
  seriesId: r.series_id,
  title: r.title,
  cover: r.cover ?? undefined,
  category: r.category,
  tier: r.tier,
  note: r.note ?? undefined,
  url: r.url ?? undefined,
  bookmarks: r.bookmarks ?? [],
});

export async function listRecs(): Promise<Rec[]> {
  await ensureSchema();
  const rows = (await db().query('select * from recommendations order by position, id')) as Row[];
  return rows.map(toRec);
}

export async function getSources(): Promise<SourcesMap> {
  await ensureSchema();
  const rows = await db().query(`select value from app_meta where key = 'sources'`);
  return (rows[0]?.value as SourcesMap | undefined) ?? DEFAULT_SOURCES;
}

export async function setSources(v: SourcesMap) {
  await ensureSchema();
  await db().query(
    `insert into app_meta (key, value) values ('sources', $1::jsonb) on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(v)],
  );
}

export async function lastUpdated(): Promise<string> {
  await ensureSchema();
  const rows = await db().query(`select to_char(coalesce(max(updated_at), now()), 'YYYY-MM-DD') as d from recommendations`);
  return rows[0].d as string;
}

const clean = (s?: string) => {
  const t = s?.trim();
  return t ? t : null;
};

export async function saveRec(r: Rec): Promise<void> {
  await ensureSchema();
  const bookmarks = JSON.stringify(r.bookmarks ?? []);
  const args = [r.source, r.seriesId.trim(), r.title.trim(), clean(r.cover), r.category, r.tier, clean(r.note), clean(r.url), bookmarks];
  if (r.id) {
    await db().query(
      `update recommendations set source=$1, series_id=$2, title=$3, cover=$4, category=$5, tier=$6, note=$7, url=$8,
       bookmarks=$9::jsonb, updated_at=now() where id=$10`,
      [...args, r.id],
    );
  } else {
    await db().query(
      `insert into recommendations (source, series_id, title, cover, category, tier, note, url, bookmarks, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, (select coalesce(max(position),0)+1 from recommendations))`,
      args,
    );
  }
}

export async function setTier(id: number, tier: Tier) {
  await ensureSchema();
  await db().query('update recommendations set tier=$1, updated_at=now() where id=$2', [tier, id]);
}

export async function deleteRec(id: number) {
  await ensureSchema();
  await db().query('delete from recommendations where id=$1', [id]);
}

/** Replaces everything with the given list (order is kept). */
export async function replaceAll(recs: Rec[], sources?: SourcesMap) {
  await ensureSchema();
  await db().transaction([
    db().query('delete from recommendations'),
    ...recs.map((r, i) =>
      db().query(
        `insert into recommendations (source, series_id, title, cover, category, tier, note, url, bookmarks, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         on conflict (source, series_id) do nothing`,
        [r.source, r.seriesId, r.title, clean(r.cover), r.category, r.tier, clean(r.note), clean(r.url), JSON.stringify(r.bookmarks ?? []), i + 1],
      ),
    ),
  ]);
  if (sources) await setSources(sources);
}

/** The exact shape the mobile app reads. */
export async function buildExport() {
  const [recs, sources, updated] = await Promise.all([listRecs(), getSources(), lastUpdated()]);
  return {
    version: 1,
    updated,
    sources,
    recommendations: recs.map((r) => ({
      source: r.source,
      id: r.seriesId,
      title: r.title,
      ...(r.cover ? { cover: r.cover } : {}),
      ...(r.url ? { url: r.url } : {}),
      category: r.category,
      tier: r.tier,
      ...(r.note ? { note: r.note } : {}),
      ...(r.bookmarks.length ? { bookmarks: r.bookmarks } : {}),
    })),
  };
}

export function validateRec(r: Record<string, unknown>): Rec | null {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const source = str(r.source) as SourceId;
  const category = str(r.category) as Category;
  const tier = str(r.tier) as Tier;
  const seriesId = str(r.seriesId)?.trim();
  const title = str(r.title)?.trim();
  if (!SOURCES.includes(source) || !CATEGORIES.includes(category) || !TIERS.includes(tier) || !seriesId || !title) return null;
  const bookmarks = (Array.isArray(r.bookmarks) ? r.bookmarks : [])
    .map((b: Record<string, unknown>) => ({
      chapterId: str(b.chapterId)?.trim() ?? '',
      ...(str(b.chapterName)?.trim() ? { chapterName: str(b.chapterName)!.trim() } : {}),
      ...(typeof b.page === 'number' && b.page > 0 ? { page: Math.floor(b.page) } : {}),
      ...(str(b.note)?.trim() ? { note: str(b.note)!.trim() } : {}),
    }))
    .filter((b: AuthorBookmark) => b.chapterId);
  return {
    id: typeof r.id === 'number' ? r.id : undefined,
    source,
    seriesId,
    title,
    category,
    tier,
    bookmarks,
    cover: str(r.cover),
    note: str(r.note),
    url: str(r.url),
  };
}

/** Parses and validates a recommendations file (the same format the app reads). */
export function parseImport(text: string): { recs: Rec[]; sources?: SourcesMap } {
  const j = JSON.parse(text);
  if (!j || !Array.isArray(j.recommendations)) throw new Error('Not a recommendations file');
  const recs: Rec[] = j.recommendations.map((r: Record<string, unknown>, i: number) => {
    const rec = validateRec({ ...r, seriesId: r.id, id: undefined, bookmarks: r.bookmarks ?? [] });
    if (!rec) throw new Error(`Entry ${i + 1} is invalid`);
    return rec;
  });
  return { recs, sources: j.sources };
}
