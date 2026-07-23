import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from './supabase/server';
import type { OrgRole } from '@bambu/db';

const ORG_COOKIE = 'bambu_org';

export interface Membership {
  organizationId: string;
  role: OrgRole;
  organizationName: string;
  currency: string;
  timezone: string;
}

/** Usuário autenticado ou redireciona para /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { user, supabase };
}

/** Lista as organizações do usuário logado (via RLS). */
export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_members')
    .select('role, organization_id, organizations(name, currency, timezone)')
    .order('created_at', { ascending: true });

  return (data ?? []).map((m) => {
    const org = m.organizations as unknown as {
      name: string;
      currency: string;
      timezone: string;
    } | null;
    return {
      organizationId: m.organization_id,
      role: m.role,
      organizationName: org?.name ?? 'Organização',
      currency: org?.currency ?? 'BRL',
      timezone: org?.timezone ?? 'America/Sao_Paulo',
    };
  });
}

/**
 * Resolve a organização atual (cookie ou primeira). Redireciona para
 * onboarding se o usuário não tiver nenhuma organização.
 */
export async function requireCurrentOrg(): Promise<{ user: { id: string }; org: Membership }> {
  const { user } = await requireUser();
  const memberships = await listMemberships();
  if (memberships.length === 0) redirect('/onboarding');

  const cookieStore = await cookies();
  const selected = cookieStore.get(ORG_COOKIE)?.value;
  const org = memberships.find((m) => m.organizationId === selected) ?? memberships[0]!;
  return { user: { id: user.id }, org };
}

export function canWrite(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'operator';
}

export function isAdmin(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin';
}

export const ORG_COOKIE_NAME = ORG_COOKIE;
