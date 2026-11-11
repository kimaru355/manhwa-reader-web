import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin';
import { listRecs } from '@/lib/db';
import { signOut } from './login/actions';
import Editor from './Editor';
import './admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recommendations admin', robots: { index: false } };

export default async function AdminPage() {
  const email = await getAdmin();
  if (!email) redirect('/admin/login');
  const recs = await listRecs();

  return (
    <main className="adm-wrap">
      <header className="adm-top">
        <div>
          <h1>Recommendations</h1>
          <p className="adm-muted">{email}</p>
        </div>
        <form action={signOut}>
          <button className="btn ghost">Sign out</button>
        </form>
      </header>
      <Editor initial={recs} />
    </main>
  );
}
