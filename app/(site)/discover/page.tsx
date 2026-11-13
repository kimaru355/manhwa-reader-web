import Link from 'next/link';

import { AdultGate } from '@/components/AdultGate';
import { Cards, Empty } from '@/components/Cards';
import { adultState } from '@/lib/web/adult';
import { SourceError } from '@/lib/web/http';
import { getSource, SECTION_SOURCE, type Section } from '@/lib/web';
import type { Series } from '@/lib/web/types';

export const dynamic = 'force-dynamic';

const SECTIONS: [Section, string][] = [
  ['manga', 'Manga'],
  ['manhwa', 'Manhwa'],
  ['novel', 'Novels'],
  ['interesting', '18+'],
];

export default async function Discover({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const adult = await adultState();
  const sections = SECTIONS.filter(([s]) => s !== 'interesting' || adult !== 'off');
  const section = (sections.find(([s]) => s === sp.s)?.[0] ?? 'manga') as Section;
  const q = (sp.q ?? '').trim().slice(0, 100);
  const page = Math.max(0, Math.min(Number(sp.page) || 0, 200));
  const source = getSource(SECTION_SOURCE[section])!;

  let items: Series[] = [];
  let hasMore = false;
  let error: string | null = null;
  if (!(section === 'interesting' && adult === 'gate')) {
    try {
      const res = await source.browse({ page, query: q });
      items = res.items;
      hasMore = res.hasMore;
    } catch (e) {
      error = e instanceof SourceError ? e.message : "Couldn't load titles. Try again in a moment.";
    }
  }

  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ s: section });
    if (q) p.set('q', q);
    for (const [k, v] of Object.entries(over)) p.set(k, String(v));
    return `/discover?${p}`;
  };

  return (
    <>
      <h1 className="page-title">Discover</h1>
      <div className="chips">
        {sections.map(([s, label]) => (
          <Link key={s} className={`chip ${section === s ? 'on' : ''}`} href={`/discover?s=${s}`}>
            {label}
          </Link>
        ))}
      </div>
      <form className="search" action="/discover">
        <input type="hidden" name="s" value={section} />
        <input name="q" defaultValue={q} placeholder={`Search ${source.name}`} autoComplete="off" />
        <button className="btn2" type="submit">
          Search
        </button>
      </form>
      <div className="meta">Titles from {source.name}</div>

      {section === 'interesting' && adult === 'gate' ? (
        <AdultGate />
      ) : error ? (
        <div className="err">
          {error} <Link href={href({ page })}>Try again</Link>
        </div>
      ) : items.length === 0 ? (
        <Empty title="No matches" />
      ) : (
        <>
          <Cards items={items} />
          <div className="pager">
            {page > 0 ? (
              <Link className="btn2 ghost" href={href({ page: page - 1 })}>
                ← Previous
              </Link>
            ) : null}
            {hasMore ? (
              <Link className="btn2 ghost" href={href({ page: page + 1 })}>
                Next →
              </Link>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
