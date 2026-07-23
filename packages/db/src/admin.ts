/**
 * Cliente admin (service_role) — BYPASSA RLS. Uso EXCLUSIVO server-side
 * (Route Handlers, Server Actions, worker). NUNCA importar em código de
 * browser: a service_role key jamais pode chegar ao bundle do cliente.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

export type AdminClient = SupabaseClient<Database>;

let cached: AdminClient | null = null;

export function createAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'createAdminClient requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (server-side).',
    );
  }
  if (cached) return cached;
  cached = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
