import { cookies } from 'next/headers';

import { adultEnabled } from '@/lib/web';

/** 'off' = this site doesn't offer 18+ at all; 'gate' = ask first; 'ok' = confirmed in this browser. */
export async function adultState(): Promise<'off' | 'gate' | 'ok'> {
  if (!adultEnabled) return 'off';
  return (await cookies()).get('adult')?.value === '1' ? 'ok' : 'gate';
}
