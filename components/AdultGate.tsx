'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

/** Shown before any 18+ page. Saying yes sets a cookie so the server can show the content. */
export function AdultGate() {
  const router = useRouter();
  return (
    <div className="gate">
      <h1>18+ content</h1>
      <p>This section contains material for adults only. Confirm that you are 18 or older to continue.</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          className="btn2"
          onClick={() => {
            document.cookie = 'adult=1; path=/; max-age=31536000; samesite=lax';
            router.refresh();
          }}
        >
          I am 18 or older
        </button>
        <Link className="btn2 ghost" href="/">
          Leave
        </Link>
      </div>
    </div>
  );
}
