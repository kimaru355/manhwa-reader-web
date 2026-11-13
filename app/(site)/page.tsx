import Link from 'next/link';

import { AdultGate } from '@/components/AdultGate';
import { Cards, Empty, type CardData } from '@/components/Cards';
import { adultState } from '@/lib/web/adult';
import { getRecs } from '@/lib/web/data';

export const dynamic = 'force-dynamic';

const TIERS: [string, string][] = [
  ['all-time', 'All-time'],
  ['interesting', 'Interesting'],
  ['good', 'Good'],
  ['trial', 'Worth a trial'],
];
const CATS: [string, string][] = [
  ['manga', 'Manga'],
  ['manhwa', 'Manhwa'],
  ['novel', 'Novels'],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string; cat?: string }> }) {
  const sp = await searchParams;
  const adult = await adultState();
  const tab = sp.tab === 'interesting' && adult !== 'off' ? 'interesting' : 'home';
  const cat = tab === 'interesting' ? 'interesting' : (CATS.find(([c]) => c === sp.cat)?.[0] ?? 'manga');

  const recs = tab === 'interesting' && adult === 'gate' ? [] : await getRecs();
  const shown = recs.filter((r) => r.category === cat);

  return (
    <>
      <div className="banner">
        <p>
          <b>Read online for free.</b> Want to download chapters and read offline? The Android app does that.
        </p>
        <Link href="/get-app" className="get">
          Get the app
        </Link>
      </div>

      <div className="chips">
        <Link className={`chip ${tab === 'home' ? 'on' : ''}`} href="/">
          Home
        </Link>
        {adult !== 'off' ? (
          <Link className={`chip ${tab === 'interesting' ? 'on' : ''}`} href="/?tab=interesting">
            Interesting (18+)
          </Link>
        ) : null}
        <Link className="chip" href="/community">
          Community
        </Link>
      </div>
      {tab === 'home' ? (
        <div className="chips">
          {CATS.map(([c, label]) => (
            <Link key={c} className={`chip ${cat === c ? 'on' : ''}`} href={`/?cat=${c}`}>
              {label}
            </Link>
          ))}
        </div>
      ) : null}

      {tab === 'interesting' && adult === 'gate' ? (
        <AdultGate />
      ) : shown.length === 0 ? (
        <Empty title="No recommendations here yet">Browse Discover to find something to read.</Empty>
      ) : (
        TIERS.map(([tier, label]) => {
          const list = shown.filter((r) => r.tier === tier);
          if (!list.length) return null;
          const items: CardData[] = list.map((r) => ({
            source: r.source,
            id: r.id,
            title: r.title,
            cover: r.cover,
            category: r.category,
            note: r.note,
            external: r.url,
          }));
          return (
            <div key={tier}>
              <div className="tier">
                <h2>{label}</h2>
                <span>{list.length}</span>
              </div>
              <Cards items={items} />
            </div>
          );
        })
      )}
    </>
  );
}
