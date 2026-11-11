import '../admin/admin.css';

export const metadata = { title: 'Privacy policy - Manhwa Reader' };

export default function Privacy() {
  return (
    <main className="adm-wrap" style={{ maxWidth: 720, lineHeight: 1.7 }}>
      <h1>Privacy policy</h1>
      <p className="adm-muted">Manhwa Reader. Last updated 12 November 2026.</p>

      <h2 style={{ marginTop: 28 }}>Using the app without an account</h2>
      <p>You don&apos;t need an account. Without one, your favorites, wishlist, bookmarks, reading history and downloads stay on your phone.</p>

      <h2 style={{ marginTop: 28 }}>If you create an account</h2>
      <p>We store your email address and a password hash (managed by our sign-in provider, Neon), and what you choose to sync: favorites, wishlist, chapter bookmarks with your notes, and any recommendations you share. Reading history and downloaded files are not synced.</p>

      <h2 style={{ marginTop: 28 }}>Shared recommendations</h2>
      <p>Recommendations you share can be shown to other readers. They show the title, cover, your tier and note, but never your email or account.</p>

      <h2 style={{ marginTop: 28 }}>What we don&apos;t do</h2>
      <p>We don&apos;t sell your data, run ads, or track you across other apps or sites.</p>

      <h2 style={{ marginTop: 28 }}>Deleting your account</h2>
      <p>In the app, open the account screen and delete your account. This permanently removes your account and everything synced to it, including shared recommendations.</p>

      <h2 style={{ marginTop: 28 }}>Where data lives</h2>
      <p>Account and sync data is stored in a Neon Postgres database. The website is hosted on Vercel, which keeps standard request logs. We do not log passwords, tokens or the text of your notes.</p>
    </main>
  );
}
