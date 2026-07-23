import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bambu/db';

/**
 * Cliente Supabase server-side com a sessão do usuário (respeita RLS).
 * Usado em Server Components, Route Handlers e Server Actions.
 *
 * O cast para SupabaseClient<Database> normaliza os genéricos (o @supabase/ssr
 * e o supabase-js divergem na ordem dos type params das versões atuais).
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado de um Server Component: ignorar (middleware renova a sessão).
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
