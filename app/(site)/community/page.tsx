import { CommunityFeed } from '@/components/CommunityFeed';
import { adultEnabled } from '@/lib/web';

export const metadata = { title: 'Community picks - Manhwa Reader' };

export default function CommunityPage() {
  return (
    <>
      <h1 className="page-title">Community picks</h1>
      <CommunityFeed adultEnabled={adultEnabled} />
    </>
  );
}
