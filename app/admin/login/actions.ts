'use server';

import { redirect } from 'next/navigation';
import { isAllowedEmail } from '@/lib/admin';
import { auth } from '@/lib/auth/server';

type State = { error: string } | null;

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim();
  if (!isAllowedEmail(email)) return { error: 'This email is not allowed to edit.' };
  const { error } = await auth.signIn.email({ email, password: String(formData.get('password') ?? '') });
  if (error) return { error: error.message || 'Could not sign in.' };
  redirect('/admin');
}

/** Sign-up is only possible for emails on the ADMIN_EMAILS list. */
export async function signUp(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim();
  if (!isAllowedEmail(email)) return { error: 'This email is not allowed to edit.' };
  const { error } = await auth.signUp.email({
    email,
    name: String(formData.get('name') ?? '') || email,
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: error.message || 'Could not create the account.' };
  redirect('/admin');
}

export async function signOut() {
  await auth.signOut();
  redirect('/admin/login');
}
