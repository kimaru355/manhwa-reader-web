'use server';

import { requireAdmin } from '@/lib/admin';
import { deleteBookmarkRequest, reviewBookmark } from '@/lib/moderation';

type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(id: string, fn: (admin: string) => Promise<void>): Promise<Result> {
  try {
    const admin = await requireAdmin();
    if (!UUID.test(id)) throw new Error('Bad id');
    await fn(admin);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong' };
  }
}

export async function approveBookmark(id: string): Promise<Result> {
  return guard(id, (admin) => reviewBookmark(id, 'approved', admin));
}

export async function rejectBookmark(id: string, reason: string): Promise<Result> {
  return guard(id, (admin) => reviewBookmark(id, 'rejected', admin, reason));
}

/** Puts an approved or rejected request back in the queue. */
export async function reopenBookmark(id: string): Promise<Result> {
  return guard(id, (admin) => reviewBookmark(id, 'pending', admin));
}

export async function removeBookmark(id: string): Promise<Result> {
  return guard(id, () => deleteBookmarkRequest(id));
}
