const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const TIMEOUT_MS = 15_000;

/** Thrown with a message that is safe to show to readers. */
export class SourceError extends Error {}

async function get(url: string, opts: { ua?: string; revalidate?: number } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': opts.ua ?? BROWSER_UA, Accept: '*/*' },
      signal: ctrl.signal,
      next: { revalidate: opts.revalidate ?? 300 },
    });
    if (!res.ok) throw new SourceError(`The source answered ${res.status}. Try again in a moment.`);
    return res;
  } catch (e) {
    if (e instanceof SourceError) throw e;
    throw new SourceError("Couldn't reach the source. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
}

export const getText = async (url: string, opts?: { ua?: string; revalidate?: number }) => (await get(url, opts)).text();
export const getJson = async <T>(url: string, opts?: { ua?: string; revalidate?: number }) =>
  (await get(url, opts)).json() as Promise<T>;

export const qs = (params: (readonly [string, string | number])[]) =>
  params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const decodeHtml = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
