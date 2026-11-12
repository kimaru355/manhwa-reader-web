import { z } from 'zod';
import { CATEGORIES, SOURCES, TIERS } from '@/lib/shared';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);

export const signUpBody = z.strictObject({ email, password });
export const signInBody = z.strictObject({ email, password: z.string().min(1).max(128) });
export const refreshBody = z.strictObject({ refreshToken: z.string().min(1).max(4000) });
export const signOutBody = z.strictObject({ refreshToken: z.string().min(1).max(4000).optional() });
export const forgotBody = z.strictObject({ email });
export const resetBody = z.strictObject({ token: z.string().min(1).max(500), password });

export const source = z.enum(SOURCES);
export const category = z.enum(CATEGORIES);
export const tier = z.enum(TIERS);

const url = z.string().max(2000);

/** The app's `Series` (what favorites and the wishlist store). */
export const series = z.strictObject({
  key: z.string().min(1).max(300),
  source,
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  cover: url.optional(),
  category,
  url: url.optional(),
});

const kind = z.enum(['favorite', 'wishlist']);

export const bookmark = z.strictObject({
  id: z.string().min(1).max(64),
  seriesKey: z.string().min(1).max(300),
  chapterId: z.string().min(1).max(300),
  chapterName: z.string().max(300),
  page: z.number().int().positive(),
  note: z.string().max(200),
  ts: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().optional(),
});

export const MAX_BATCH = 500;

export const syncBody = z
  .strictObject({
    favorites: z
      .strictObject({
        put: z.array(z.strictObject({ kind, seriesKey: z.string().min(1).max(300), series })).default([]),
        remove: z.array(z.strictObject({ kind, seriesKey: z.string().min(1).max(300) })).default([]),
      })
      .optional(),
    bookmarks: z
      .strictObject({
        put: z.array(bookmark).default([]),
        remove: z.array(z.string().min(1).max(64)).default([]),
      })
      .optional(),
  })
  .refine(
    (b) =>
      (b.favorites?.put.length ?? 0) +
        (b.favorites?.remove.length ?? 0) +
        (b.bookmarks?.put.length ?? 0) +
        (b.bookmarks?.remove.length ?? 0) <=
      MAX_BATCH,
    { message: 'batch too large' },
  )
  .refine((b) => (b.favorites?.put ?? []).every((f) => f.seriesKey === f.series.key), { message: 'seriesKey mismatch' });

export const recBody = z.strictObject({
  source,
  seriesId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  cover: url.nullish(),
  url: url.nullish(),
  category,
  tier,
  note: z.string().max(500).nullish(),
});

export const SORTS = ['latest', 'popular', 'week'] as const;

export const communityQuery = z.object({
  sort: z.enum(SORTS).default('latest'),
  q: z.string().trim().min(1).max(100).optional(),
  category: category.optional(),
  tier: tier.optional(),
  source: source.optional(),
  adult: z.enum(['1']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

/** A reader suggesting a bookmark for everyone. Reviewed before it is shown. */
export const communityBookmarkBody = z.strictObject({
  source: z.enum(['mangadex', 'webtoons', 'hentai20', 'novelfull']),
  seriesId: z.string().min(1).max(200),
  seriesTitle: z.string().min(1).max(300),
  chapterId: z.string().min(1).max(300),
  chapterName: z.string().min(1).max(300),
  page: z.number().int().positive().max(10000),
  note: z.string().max(300).nullish(),
});

export const communityBookmarksQuery = z.object({
  source: z.enum(['mangadex', 'webtoons', 'hentai20', 'novelfull']),
  seriesId: z.string().min(1).max(200),
});
