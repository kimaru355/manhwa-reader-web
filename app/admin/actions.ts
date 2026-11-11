'use server';

import { requireAdmin } from '@/lib/admin';
import { deleteRec, parseImport, replaceAll, saveRec, setTier, TIERS, validateRec, type Rec, type Tier } from '@/lib/db';

type Result = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<void>): Promise<Result> {
  try {
    await requireAdmin();
    await fn();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong';
    return { ok: false, error: /duplicate key/i.test(msg) ? 'That source + id already exists.' : msg };
  }
}

export async function saveRecommendation(rec: Rec): Promise<Result> {
  return guard(async () => {
    const v = validateRec(rec as unknown as Record<string, unknown>);
    if (!v) throw new Error('Check the required fields (source, id, title, category, tier).');
    await saveRec(v);
  });
}

export async function changeTier(id: number, tier: Tier): Promise<Result> {
  return guard(async () => {
    if (!TIERS.includes(tier)) throw new Error('Bad tier');
    await setTier(id, tier);
  });
}

export async function removeRecommendation(id: number): Promise<Result> {
  return guard(() => deleteRec(id));
}

export async function importJson(text: string): Promise<Result> {
  return guard(async () => {
    const { recs, sources } = parseImport(text);
    await replaceAll(recs, sources);
  });
}
