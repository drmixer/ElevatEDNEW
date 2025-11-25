import type { IncomingMessage } from 'node:http';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapAdminRow, type AdminSummary } from './admins.js';

export type AuthenticatedAdmin = AdminSummary;

export const extractBearerToken = (req: IncomingMessage): string | null => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  return match[1].trim();
};

export const resolveAdminFromToken = async (
  supabase: SupabaseClient,
  token: string,
): Promise<AuthenticatedAdmin | null> => {
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  const userId = data.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, admin_profiles(title, permissions, created_at)')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load profile for authentication: ${profileError.message}`);
  }

  if (!profile || (profile as Record<string, unknown>).role !== 'admin') {
    return null;
  }

  return mapAdminRow(profile as Record<string, unknown>);
};
