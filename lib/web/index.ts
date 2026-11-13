import type { SourceId } from '@/lib/shared';
import { hentai20 } from './hentai20';
import { mangadex } from './mangadex';
import { novelbin } from './novelbin';
import type { Source } from './types';
import { webtoons } from './webtoons';

const ALL: Record<Source['id'], Source> = { mangadex, webtoons, hentai20, novelbin };

export const getSource = (id: string): Source | undefined => (id in ALL ? ALL[id as Source['id']] : undefined);
export const isSourceId = (id: string): id is SourceId => id in ALL || id === 'external';

/** The adult source is only offered when the operator switches it on. */
export const adultEnabled = process.env.WEB_ADULT === '1';

export type Section = 'manga' | 'manhwa' | 'novel' | 'interesting';
export const SECTION_SOURCE: Record<Section, Source['id']> = {
  manga: 'mangadex',
  manhwa: 'webtoons',
  novel: 'novelbin',
  interesting: 'hentai20',
};

export type { Source };
