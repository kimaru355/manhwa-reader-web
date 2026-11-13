import type { Category, SourceId } from '@/lib/shared';

export type Series = {
  key: string;
  source: SourceId;
  id: string;
  title: string;
  cover?: string;
  category: Category;
};

export type Chapter = { id: string; name: string; url?: string };
export type Page<T> = { items: T[]; hasMore: boolean };

export type Source = {
  id: 'mangadex' | 'webtoons' | 'hentai20' | 'novelbin';
  name: string;
  /** Novels are read as text; everything else is images. */
  kind: 'images' | 'text';
  /** Whether covers and pages must go through our image proxy (the host checks the Referer). */
  proxyImages: boolean;
  browse: (opts: { page: number; query?: string }) => Promise<Page<Series>>;
  chapters: (series: Pick<Series, 'id'>) => Promise<Chapter[]>;
  pages: (series: Pick<Series, 'id'>, chapter: Chapter) => Promise<string[]>;
  text?: (series: Pick<Series, 'id'>, chapter: Chapter) => Promise<string[]>;
};
