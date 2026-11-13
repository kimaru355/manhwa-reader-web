import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdultGate } from '@/components/AdultGate';
import { Cover } from '@/components/Cards';
import { SeriesView } from '@/components/SeriesView';
import { adultState } from '@/lib/web/adult';
import { authorMarks, communityMarks } from '@/lib/web/data';
import { SourceError } from '@/lib/web/http';
import { getSource } from '@/lib/web';
import type { Chapter } from '@/lib/web/types';

export const dynamic = 'force-dynamic';

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ source: string; id: string }>;
  searchParams: Promise<{ t?: string; c?: string; k?: string }>;
}) {
  const [{ source: sourceId, id: rawId }, sp] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(rawId);
  const source = getSource(sourceId);
  if (!source) notFound();

  if (source.id === 'hentai20') {
    const adult = await adultState();
    if (adult === 'off') notFound();
    if (adult === 'gate') return <AdultGate />;
  }

  const title = sp.t?.slice(0, 200) || id;
  const category = sp.k || (source.kind === 'text' ? 'novel' : 'manga');
  const item = { key: `${source.id}:${id}`, source: source.id, id, title, cover: sp.c, category };

  let chapters: Chapter[] = [];
  let error: string | null = null;
  try {
    chapters = await source.chapters({ id });
  } catch (e) {
    error = e instanceof SourceError ? e.message : "Couldn't load the chapters. Try again in a moment.";
  }
  const [author, community] = await Promise.all([authorMarks(source.id, id), communityMarks(source.id, id)]);

  return (
    <>
      <div className="hero-s">
        <Cover src={sp.c} source={source.id} />
        <div>
          <h1>{title}</h1>
          <div className="meta">
            {source.name} · {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      {error ? (
        <div className="err">
          {error}{' '}
          <Link href={`/series/${source.id}/${encodeURIComponent(id)}?${new URLSearchParams(sp as Record<string, string>)}`}>Try again</Link>
        </div>
      ) : null}
      {!error && chapters.length === 0 ? (
        <div className="panel">
          No chapters can be read here for this title. It may be licensed, or only available on the publisher&apos;s own site.
        </div>
      ) : null}
      <SeriesView
        item={item}
        chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
        author={author}
        community={community}
        kind={source.kind}
      />
    </>
  );
}
