'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSession } from '@/lib/web/client/api';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/community', label: 'Community' },
  { href: '/library', label: 'Library' },
];

export function SiteHeader() {
  const path = usePathname();
  const session = useSession();
  const on = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" />
          Manhwa Reader
        </Link>
        <nav className="links" style={{ padding: 0, display: undefined }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={on(l.href) ? 'on' : ''}>
              {l.label}
            </Link>
          ))}
          <Link href="/account" className={on('/account') ? 'on' : ''}>
            {session ? 'Account' : 'Sign in'}
          </Link>
        </nav>
        <Link href="/get-app" className="get">
          Get the app
        </Link>
      </div>
    </header>
  );
}
