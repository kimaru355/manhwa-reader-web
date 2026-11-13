const HOSTS: { suffix: string; referer: string }[] = [
  { suffix: 'pstatic.net', referer: 'https://www.webtoons.com/' },
  { suffix: 'webtoons.com', referer: 'https://www.webtoons.com/' },
  { suffix: 'hentai20.io', referer: 'https://hentai20.io/' },
  { suffix: 'hentai1.io', referer: 'https://hentai20.io/' },
];

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

/**
 * Fetches an image from a source that rejects requests without its own Referer and passes it on.
 * Only the hosts listed above are allowed, and only images are returned, so this can't be used as an open proxy.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('u');
  let target: URL;
  try {
    target = new URL(raw ?? '');
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const rule = HOSTS.find((h) => target.hostname === h.suffix || target.hostname.endsWith(`.${h.suffix}`));
  if (target.protocol !== 'https:' || !rule) return new Response('Not allowed', { status: 403 });

  const upstream = await fetch(target, {
    headers: { 'User-Agent': UA, Referer: rule.referer, Accept: 'image/avif,image/webp,image/*,*/*' },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response('Upstream error', { status: 502 });
  const type = upstream.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return new Response('Not an image', { status: 415 });

  return new Response(upstream.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable' },
  });
}
