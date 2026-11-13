'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { saveRecent, type Item } from '@/lib/web/client/store';
import { readHref } from '@/lib/web/links';

const MIN = 14;
const MAX = 30;

export function NovelReader({
  item,
  chapter,
  prev,
  next,
  paragraphs,
}: {
  item: Item;
  chapter: { id: string; name: string };
  prev: string | null;
  next: string | null;
  paragraphs: string[];
}) {
  const [size, setSize] = useState(18);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem('w_novel_size'));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (n >= MIN && n <= MAX) setSize(n);
    } catch {
      // Keep the default size.
    }
  }, []);

  useEffect(() => {
    saveRecent({ series: item, chapterId: chapter.id, chapterName: chapter.name, page: 1, total: 1 });
  }, [item, chapter.id, chapter.name]);

  const resize = (d: number) =>
    setSize((s) => {
      const n = Math.min(MAX, Math.max(MIN, s + d));
      try {
        localStorage.setItem('w_novel_size', String(n));
      } catch {
        // Not kept.
      }
      return n;
    });

  const href = (id: string | null) => (id ? readHref(item, id) : '#');
  const back = `/series/${item.source}/${encodeURIComponent(item.id)}?t=${encodeURIComponent(item.title)}&k=${item.category}${item.cover ? `&c=${encodeURIComponent(item.cover)}` : ''}`;

  return (
    <div className="novel-wrap">
      <div className="rbar top-b">
        <Link href={back}>←</Link>
        <div className="tt">
          {item.title} · {chapter.name}
        </div>
        <button onClick={() => resize(-2)} aria-label="Smaller text">
          A−
        </button>
        <button onClick={() => resize(2)} aria-label="Larger text">
          A+
        </button>
      </div>
      <article className="novel" style={{ fontSize: size, lineHeight: 1.7 }}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="actions" style={{ justifyContent: 'space-between', marginTop: 30 }}>
          <Link className={`btn2 ghost ${prev ? '' : 'dis'}`} href={href(prev)} style={prev ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
            ← Previous
          </Link>
          <Link className="btn2" href={href(next)} style={next ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
            Next →
          </Link>
        </div>
      </article>
    </div>
  );
}
