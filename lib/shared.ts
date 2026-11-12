export const CATEGORIES = ['manga', 'manhwa', 'interesting', 'novel'] as const;
export const SOURCES = ['mangadex', 'webtoons', 'hentai20', 'novelfull', 'external'] as const;
export const TIERS = ['all-time', 'good', 'interesting', 'trial'] as const;

export type Category = (typeof CATEGORIES)[number];
export type SourceId = (typeof SOURCES)[number];
export type Tier = (typeof TIERS)[number];

export type AuthorBookmark = { chapterId: string; chapterName?: string; page?: number; note?: string };

export type Rec = {
  id?: number;
  source: SourceId;
  seriesId: string;
  title: string;
  cover?: string;
  category: Category;
  tier: Tier;
  note?: string;
  url?: string;
  bookmarks: AuthorBookmark[];
};

export type SourcesMap = Partial<Record<Category, { source: SourceId; name?: string }[]>>;
