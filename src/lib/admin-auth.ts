import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function requireAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) redirect('/admin/login?error=config');
  const store = await cookies();
  const client = createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: role } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!role) redirect('/admin/login?error=forbidden');
  return { client, user };
}

export async function requireAdminService() {
  const { user } = await requireAdmin();
  const client = getSupabaseAdmin();
  if (!client) redirect('/admin/login?error=config');
  return { client, user };
}
