import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (login !== 'admin01' || !password) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.ADMIN01_EMAIL;
  if (!url || !key || !email) {
    return NextResponse.json({ error: 'CONFIGURATION_ERROR' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach((value) => response.cookies.set(value.name, value.value, value.options)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error
    ? NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
    : response;
}
