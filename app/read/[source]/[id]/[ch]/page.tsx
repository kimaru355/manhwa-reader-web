import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdultGate } from '@/components/AdultGate';
import { NovelReader } from '@/components/NovelReader';
import { Reader } from '@/components/Reader';
import { adultState } from '@/lib/web/adult';
import { authorMarks, communityMarks, imgUrl } from '@/lib/web/data';
import { SourceError } from '@/lib/web/http';
import { getSource } from '@/lib/web';

export const dynamic = 'force-dynamic';

export default async function Read({
  params,
  searchParams,
}: {
  params: Promise<{ source: string; id: string; ch: string }>;
  searchParams: Promise<{ t?: string; c?: string; k?: string; p?: string }>;
}) {
  const [{ source: sourceId, id: rawId, ch: rawCh }, sp] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(rawId);
  const chapterId = decodeURIComponent(rawCh);
  const source = getSource(sourceId);
  if (!source) notFound();

  if (source.id === 'hentai20') {
    const adult = await adultState();
    if (adult === 'off') notFound();
    if (adult === 'gate') return <AdultGate />;
  }

  const title = sp.t?.slice(0, 200) || id;
  const item = { key: `${source.id}:${id}`, source: source.id, id, title, cover: sp.c, category: sp.k || 'manga' };
  const back = `/series/${source.id}/${encodeURIComponent(id)}?t=${encodeURIComponent(title)}&k=${item.category}${sp.c ? `&c=${encodeURIComponent(sp.c)}` : ''}`;

  const fail = (message: string) => (
    <div className="main">
      <div className="err">{message}</div>
      <Link className="btn2 ghost" href={back}>
        ← Back to chapters
      </Link>
    </div>
  );

  try {
    const chapters = await source.chapters({ id });
    const index = chapters.findIndex((c) => c.id === chapterId);
    if (index < 0) return fail("That chapter isn't available any more.");
    const chapter = chapters[index];
    const prev = chapters[index - 1]?.id ?? null;
    const next = chapters[index + 1]?.id ?? null;

    if (source.kind === 'text') {
      const paragraphs = await source.text!({ id }, chapter);
      return <NovelReader item={item} chapter={{ id: chapter.id, name: chapter.name }} prev={prev} next={next} paragraphs={paragraphs} />;
    }

    const [urls, author, community] = await Promise.all([
      source.pages({ id }, chapter),
      authorMarks(source.id, id),
      communityMarks(source.id, id),
    ]);
    const pages = urls.map((u) => imgUrl(u, source.proxyImages)!);
    const startPage = Math.min(Math.max(Number(sp.p) || 1, 1), pages.length);
    return (
      <Reader
        item={item}
        chapter={{ id: chapter.id, name: chapter.name }}
        prev={prev}
        next={next}
        pages={pages}
        startPage={startPage}
        author={author}
        community={community}
      />
    );
  } catch (e) {
    return fail(e instanceof SourceError ? e.message : "Couldn't open this chapter. Try again in a moment.");
  }
}
