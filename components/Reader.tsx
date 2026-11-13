'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiFailure, authed, useSession } from '@/lib/web/client/api';
import { addBookmark, removeBookmark, saveRecent, useBookmarks, type Item } from '@/lib/web/client/store';
import { readHref } from '@/lib/web/links';

type Mark = { id?: string; chapterId: string; page?: number; note?: string };

export type ReaderProps = {
  item: Item;
  chapter: { id: string; name: string };
  prev: string | null;
  next: string | null;
  /** Image addresses in reading order. */
  pages: string[];
  startPage: number;
  author: Mark[];
  community: Mark[];
};

/** One page. Shows a tall placeholder until it loads so the browser doesn't fetch every page at once. */
function PageImage({ src, index, onSeen }: { src: string; index: number; onSeen: (i: number) => void }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) onSeen(index);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, onSeen]);

  const url = attempt ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src;
  return (
    <div ref={ref} id={`pg-${index + 1}`} className={`pg ${state === 'loaded' ? 'loaded' : ''}`}>
      {state !== 'failed' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Page ${index + 1}`}
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      ) : (
        <div
          className="retry"
          onClick={(e) => {
            e.stopPropagation();
            setState('loading');
            setAttempt((n) => n + 1);
          }}
        >
          Couldn&apos;t load page {index + 1}. Tap to retry.
        </div>
      )}
    </div>
  );
}

export function Reader({ item, chapter, prev, next, pages, startPage, author, community }: ReaderProps) {
  const session = useSession();
  const allMarks = useBookmarks();
  const [page, setPage] = useState(startPage);
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = allMarks.filter((b) => b.seriesKey === item.key && b.chapterId === chapter.id);
  const here = useMemo(() => [...author, ...community].filter((m) => m.chapterId === chapter.id), [author, community, chapter.id]);

  const onSeen = useCallback((i: number) => setPage(i + 1), []);

  // Jump to where the reader left off (or the bookmark they followed). Earlier pages are still loading, so try again once.
  useEffect(() => {
    if (startPage <= 1) return;
    const go = () => document.getElementById(`pg-${startPage}`)?.scrollIntoView();
    go();
    const t = setTimeout(go, 700);
    return () => clearTimeout(t);
  }, [startPage]);

  useEffect(() => {
    const t = setTimeout(
      () => saveRecent({ series: item, chapterId: chapter.id, chapterName: chapter.name, page, total: pages.length }),
      600,
    );
    return () => clearTimeout(t);
  }, [item, chapter.id, chapter.name, page, pages.length]);

  const saveMine = () => {
    addBookmark({ seriesKey: item.key, chapterId: chapter.id, chapterName: chapter.name, page, note: note.trim() });
    setMessage({ ok: true, text: `Bookmarked page ${page}.` });
    setNote('');
  };

  const suggest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await authed('/community/bookmarks', {
        method: 'POST',
        body: {
          source: item.source,
          seriesId: item.id,
          seriesTitle: item.title,
          chapterId: chapter.id,
          chapterName: chapter.name,
          page,
          note: note.trim() || null,
        },
      });
      setMessage({ ok: true, text: 'Thanks! It will appear for everyone once an admin approves it.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiFailure ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const href = (id: string | null) => (id ? readHref(item, id) : '#');

  return (
    <div className="reader">
      <div className={`rbar top-b ${chrome ? '' : 'hide'}`}>
        <Link href={`/series/${item.source}/${encodeURIComponent(item.id)}?t=${encodeURIComponent(item.title)}&k=${item.category}${item.cover ? `&c=${encodeURIComponent(item.cover)}` : ''}`}>
          ←
        </Link>
        <div className="tt">
          {item.title} · {chapter.name}
        </div>
        <span style={{ color: '#aaa', fontSize: '.85rem' }}>
          {page}/{pages.length}
        </span>
        <button onClick={() => setSheet(true)} aria-label="Bookmarks">
          🔖
        </button>
      </div>

      <div className="strip" onClick={() => setChrome((v) => !v)}>
        {pages.map((src, i) => (
          <PageImage key={src + i} src={src} index={i} onSeen={onSeen} />
        ))}
        <div className="end" onClick={(e) => e.stopPropagation()}>
          <p style={{ color: '#999', marginBottom: 14 }}>End of {chapter.name}</p>
          {next ? (
            <Link className="btn2" href={href(next)}>
              Next chapter →
            </Link>
          ) : (
            <p style={{ color: '#777' }}>This is the latest chapter.</p>
          )}
        </div>
      </div>

      <div className={`rbar bot-b ${chrome ? '' : 'hide'}`}>
        <Link href={href(prev)} className={prev ? '' : 'dis'}>
          ← Previous
        </Link>
        <Link href={href(next)} className={next ? '' : 'dis'}>
          Next →
        </Link>
      </div>

      {sheet ? (
        <div className="sheet" onClick={() => setSheet(false)}>
          <div className="sheet-in" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 10 }}>Bookmark page {page}</h3>
            <input className="field" style={{ width: '100%' }} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. peak fight" />
            <div className="actions" style={{ margin: '10px 0' }}>
              <button className="btn2" onClick={saveMine}>
                Save bookmark
              </button>
              <button
                className="btn2 ghost"
                disabled={busy || !session}
                onClick={suggest}
                title={session ? '' : 'Sign in to suggest a bookmark to everyone'}
              >
                Suggest to community
              </button>
            </div>
            {!session ? (
              <p className="meta">
                <Link href="/account" style={{ color: 'var(--accent)' }}>
                  Sign in
                </Link>{' '}
                to suggest bookmarks to everyone.
              </p>
            ) : null}
            {message ? <div className={message.ok ? 'ok' : 'err'}>{message.text}</div> : null}

            {here.length || mine.length ? <h3 style={{ margin: '14px 0 4px' }}>In this chapter</h3> : null}
            {here.map((m, i) => (
              <div className="mark" key={`h${i}`}>
                <span className="by">{author.includes(m) ? 'Author' : 'Community'}</span>
                <div className="grow">
                  <a
                    href={`#pg-${m.page ?? 1}`}
                    onClick={() => setSheet(false)}
                  >
                    Page {m.page ?? 1}
                  </a>
                  {m.note ? <div className="note">{m.note}</div> : null}
                </div>
              </div>
            ))}
            {mine.map((b) => (
              <div className="mark" key={b.id}>
                <span className="by">Yours</span>
                <div className="grow">
                  <a href={`#pg-${b.page}`} onClick={() => setSheet(false)}>
                    Page {b.page}
                  </a>
                  {b.note ? <div className="note">{b.note}</div> : null}
                </div>
                <button onClick={() => removeBookmark(b.id)}>Remove</button>
              </div>
            ))}
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button className="btn2 ghost" onClick={() => setSheet(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
