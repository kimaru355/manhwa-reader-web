'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BookmarkRequest, BookmarkStatus } from '@/lib/moderation';
import { approveBookmark, rejectBookmark, removeBookmark, reopenBookmark } from './actions';

type Result = { ok: true } | { ok: false; error: string };

const SITE_URL: Record<string, (id: string) => string> = {
  mangadex: (id) => `https://mangadex.org/title/${id}`,
  webtoons: (id) => `https://www.webtoons.com/en/originals/x/list?title_no=${id}`,
  hentai20: (id) => `https://hentai20.io/manga/${id}/`,
};

export default function Moderation({ items, status }: { items: BookmarkRequest[]; status: BookmarkStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(p: Promise<Result>) {
    start(async () => {
      const r = await p;
      setMsg(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });
  }

  function reject(id: string) {
    const reason = prompt('Reason (optional, the reader sees it):') ?? null;
    if (reason === null) return;
    run(rejectBookmark(id, reason));
  }

  if (!items.length) return <p className="adm-muted">Nothing {status} right now.</p>;

  return (
    <>
      {msg ? <p className="adm-error">{msg}</p> : null}
      <ul className="adm-list">
        {items.map((b) => (
          <li key={b.id} className="adm-row">
            <div className="adm-title">
              <strong>{b.seriesTitle}</strong>
              <span className="adm-muted">
                {b.chapterName} · page {b.page} · {b.source} · {new Date(b.createdAt).toLocaleDateString()}
              </span>
              {b.note ? <span>“{b.note}”</span> : null}
              {b.rejectReason ? <span className="adm-muted">Rejected: {b.rejectReason}</span> : null}
              {b.reviewedBy ? <span className="adm-muted">Reviewed by {b.reviewedBy}</span> : null}
            </div>
            <a className="adm-link" href={SITE_URL[b.source]?.(b.seriesId)} target="_blank" rel="noreferrer">
              Open title
            </a>
            {status === 'pending' ? (
              <>
                <button className="btn primary" disabled={pending} onClick={() => run(approveBookmark(b.id))}>
                  Approve
                </button>
                <button className="btn danger" disabled={pending} onClick={() => reject(b.id)}>
                  Reject
                </button>
              </>
            ) : (
              <>
                <button className="btn ghost" disabled={pending} onClick={() => run(reopenBookmark(b.id))}>
                  Back to pending
                </button>
                <button
                  className="btn danger"
                  disabled={pending}
                  onClick={() => confirm('Delete this request permanently?') && run(removeBookmark(b.id))}
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
