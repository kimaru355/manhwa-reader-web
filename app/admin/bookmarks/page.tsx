import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin';
import { bookmarkCounts, listBookmarkRequests, type BookmarkStatus } from '@/lib/moderation';
import { signOut } from '../login/actions';
import Moderation from './Moderation';
import '../admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bookmark requests', robots: { index: false } };

const STATUSES: BookmarkStatus[] = ['pending', 'approved', 'rejected'];

export default async function BookmarkRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const email = await getAdmin();
  if (!email) redirect('/admin/login');
  const { status: raw } = await searchParams;
  const status = STATUSES.includes(raw as BookmarkStatus) ? (raw as BookmarkStatus) : 'pending';
  const [items, counts] = await Promise.all([listBookmarkRequests(status), bookmarkCounts()]);

  return (
    <main className="adm-wrap">
      <header className="adm-top">
        <div>
          <h1>Bookmark requests</h1>
          <p className="adm-muted">
            {email} · <Link href="/admin">Recommendations</Link>
          </p>
        </div>
        <form action={signOut}>
          <button className="btn ghost">Sign out</button>
        </form>
      </header>
      <nav className="adm-bar">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/bookmarks?status=${s}`} className={`btn ${s === status ? 'primary' : 'ghost'}`}>
            {s} ({counts[s]})
          </Link>
        ))}
      </nav>
      <Moderation items={items} status={status} />
    </main>
  );
}
