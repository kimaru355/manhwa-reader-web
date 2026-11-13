import Link from 'next/link';

import { imgUrl, seriesHref } from '@/lib/web/data';
import { getSource } from '@/lib/web';
import type { Series } from '@/lib/web/types';

export type CardData = Pick<Series, 'source' | 'id' | 'title' | 'cover' | 'category'> & { note?: string; external?: string };

export function Cover({ src, source }: { src?: string; source: string }) {
  const url = imgUrl(src, getSource(source)?.proxyImages ?? false);
  return (
    <div className="cv">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
    </div>
  );
}

export function Cards({ items }: { items: CardData[] }) {
  return (
    <div className="cards">
      {items.map((s) => {
        const body = (
          <>
            <Cover src={s.cover} source={s.source} />
            <div className="ti">{s.title}</div>
            {s.note ? <div className="nt">{s.note}</div> : null}
          </>
        );
        return s.source === 'external' ? (
          s.external ? (
            <a key={`${s.source}:${s.id}`} className="card" href={s.external} target="_blank" rel="noopener noreferrer">
              {body}
            </a>
          ) : null
        ) : (
          <Link key={`${s.source}:${s.id}`} className="card" href={seriesHref(s)}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}
