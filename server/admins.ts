import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminSummary = {
  id: string;
  email: string;
  name: string;
  title: string;
  permissions: string[];
  createdAt: string | null;
};

type AdminProfileRow = {
  title?: string | null;
  permissions?: unknown;
  created_at?: string | null;
};

type ProfileRow = {
  id?: string;
  email?: string;
  full_name?: string | null;
  role?: string | null;
  admin_profiles?: AdminProfileRow | AdminProfileRow[] | null;
};

export const normalizePermissionList = (value: unknown): string[] => {
  const rawList: string[] = [];

  if (Array.isArray(value)) {
    rawList.push(
      ...value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0),
    );
  } else if (typeof value === 'string' && value.trim().length > 0) {
    rawList.push(
      ...value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    );
  }

  return Array.from(new Set(rawList)).slice(0, 25);
};

const normalizeAdminProfile = (
  input: ProfileRow['admin_profiles'],
): { title: string; permissions: string[]; createdAt: string | null } => {
  const profile = Array.isArray(input) ? input[0] ?? null : input;
  if (!profile || typeof profile !== 'object') {
    return { title: 'Platform Admin', permissions: [], createdAt: null };
  }

  const title =
    typeof (profile as AdminProfileRow).title === 'string' && (profile as AdminProfileRow).title?.trim().length
      ? (profile as AdminProfileRow).title ?? 'Platform Admin'
      : 'Platform Admin';

  return {
    title,
    permissions: normalizePermissionList((profile as AdminProfileRow).permissions),
    createdAt: typeof (profile as AdminProfileRow).created_at === 'string'
      ? (profile as AdminProfileRow).created_at ?? null
      : null,
  };
};

export const mapAdminRow = (row: ProfileRow): AdminSummary => {
  const id = row.id ?? '';
  const email = row.email ?? '';

  if (!id || !email) {
    throw new Error('Invalid admin profile row received.');
  }

  const adminProfile = normalizeAdminProfile(row.admin_profiles);
  const name =
    typeof row.full_name === 'string' && row.full_name.trim().length > 0
      ? row.full_name
      : email;

  return {
    id,
    email,
    name,
    title: adminProfile.title,
    permissions: adminProfile.permissions,
    createdAt: adminProfile.createdAt,
  };
};

export const listAdmins = async (client: SupabaseClient): Promise<AdminSummary[]> => {
  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, admin_profiles(title, permissions, created_at)')
    .eq('role', 'admin')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list admins: ${error.message}`);
  }

  return (data ?? []).map((row) => mapAdminRow(row as ProfileRow));
};

export const promoteUserToAdmin = async (
  client: SupabaseClient,
  identifier: { email?: string; userId?: string },
  options: { title?: string; permissions?: string[] } = {},
): Promise<AdminSummary> => {
  const email = identifier.email?.trim().toLowerCase();
  const userId = identifier.userId?.trim();

  if (!email && !userId) {
    throw new Error('Provide an email or user id to promote.');
  }

  let query = client
    .from('profiles')
    .select('id, email, full_name, role, admin_profiles(title, permissions, created_at)')
    .limit(1);

  if (userId) {
    query = query.eq('id', userId);
  } else if (email) {
    query = query.eq('email', email);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to look up profile: ${error.message}`);
  }

  if (!data) {
    throw new Error('No profile found for the supplied identifier.');
  }

  const profile = data as ProfileRow;
  if (!profile.id) {
    throw new Error('Profile is missing an id.');
  }

  const adminProfile = normalizeAdminProfile(profile.admin_profiles);
  const permissions = normalizePermissionList(options.permissions ?? adminProfile.permissions);
  const title = options.title?.trim().length ? options.title.trim() : adminProfile.title;

  const { error: roleError } = await client
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', profile.id);

  if (roleError) {
    throw new Error(`Failed to update user role: ${roleError.message}`);
  }

  const { error: upsertError } = await client
    .from('admin_profiles')
    .upsert({
      id: profile.id,
      title,
      permissions: permissions.length ? permissions : ['dashboard:view'],
    });

  if (upsertError) {
    throw new Error(`Failed to upsert admin profile: ${upsertError.message}`);
  }

  const { data: refreshed, error: refreshError } = await client
    .from('profiles')
    .select('id, email, full_name, role, admin_profiles(title, permissions, created_at)')
    .eq('id', profile.id)
    .single();

  if (refreshError) {
    throw new Error(`Failed to load promoted admin: ${refreshError.message}`);
  }

  return mapAdminRow(refreshed as ProfileRow);
};

export const demoteAdmin = async (
  client: SupabaseClient,
  userId: string,
  targetRole: 'parent' | 'student' = 'parent',
): Promise<{ id: string; role: 'parent' | 'student'; remainingAdmins: number | null }> => {
  const id = userId?.trim();
  if (!id) {
    throw new Error('User id is required to demote an admin.');
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load profile for demotion: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error('Profile not found for the supplied id.');
  }

  if ((profile as ProfileRow).role !== 'admin') {
    throw new Error('Profile is not currently an admin.');
  }

  const { count } = await client
    .from('admin_profiles')
    .select('id', { head: true, count: 'exact' });

  if (count !== null && count <= 1) {
    throw new Error('Cannot demote the only admin account.');
  }

  const { error: deleteError } = await client.from('admin_profiles').delete().eq('id', id);
  if (deleteError) {
    throw new Error(`Failed to remove admin profile: ${deleteError.message}`);
  }

  const { error: roleError } = await client
    .from('profiles')
    .update({ role: targetRole })
    .eq('id', id);

  if (roleError) {
    throw new Error(`Failed to update user role: ${roleError.message}`);
  }

  return {
    id,
    role: targetRole,
    remainingAdmins: count !== null ? Math.max(count - 1, 0) : null,
  };
};
