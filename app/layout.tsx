import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manhwa Reader - Read manhwa, manga and novels on Android',
  description: 'Browse, read online, download and bookmark manhwa and manga on your Android phone. Free.',
};

export const viewport: Viewport = { themeColor: '#0d0b12' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
