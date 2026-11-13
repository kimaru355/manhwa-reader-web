import Link from 'next/link';

import { SiteHeader } from '@/components/SiteHeader';
import './site.css';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <SiteHeader />
      <main className="main">{children}</main>
      <footer>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.85rem' }}>
          Read online here. <Link href="/get-app" style={{ color: 'var(--accent)' }}>Get the Android app</Link> to download chapters and
          read offline. · <Link href="/privacy">Privacy</Link>
          <br />
          Not affiliated with any manhwa publisher or source.
        </div>
      </footer>
    </div>
  );
}
