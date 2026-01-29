import type { SupabaseClient } from '@supabase/supabase-js';
import { findTutorAvatar } from '../shared/avatarManifests.js';

export type StudentPreferences = {
  student_id: string;
  avatar_id: string | null;
  tutor_persona_id: string | null;
  opt_in_ai: boolean;
  goal_focus: string | null;
  theme: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CatalogAvatar = {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
};

export type TutorPersona = {
  id: string;
  name: string;
  tone: string | null;
  constraints: string | null;
  prompt_snippet: string | null;
  sample_replies?: string[] | null;
  metadata: Record<string, unknown> | null;
};

export const listAvatars = async (
  supabase: SupabaseClient,
  options?: { category?: string },
): Promise<CatalogAvatar[]> => {
  let query = supabase
    .from('avatars')
    .select('id, name, image_url, category, is_default, metadata')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load avatars: ${error.message}`);
  }

  return (data ?? []) as CatalogAvatar[];
};

export const listTutorPersonas = async (supabase: SupabaseClient): Promise<TutorPersona[]> => {
  const { data, error } = await supabase
    .from('tutor_personas')
    .select('id, name, tone, constraints, prompt_snippet, sample_replies, metadata')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to load tutor personas: ${error.message}`);
  }

  return (data ?? []) as TutorPersona[];
};

export const getStudentPreferences = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentPreferences> => {
  const { data, error } = await supabase
    .from('student_preferences')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load student preferences: ${error.message}`);
  }

  if (data) {
    return data as StudentPreferences;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('student_preferences')
    .insert({ student_id: studentId, avatar_id: 'avatar-starter' })
    .select('*')
    .maybeSingle();

  if (insertError) {
    throw new Error(`Unable to create default preferences: ${insertError.message}`);
  }

  return inserted as StudentPreferences;
};

export const updateStudentPreferences = async (
  supabase: SupabaseClient,
  studentId: string,
  updates: Partial<Omit<StudentPreferences, 'student_id'>>,
): Promise<StudentPreferences> => {
  if (updates.avatar_id) {
    const { data: avatarExists, error: avatarError } = await supabase
      .from('avatars')
      .select('id, category')
      .eq('id', updates.avatar_id)
      .maybeSingle();
    if (avatarError) {
      throw new Error(`Unable to validate avatar: ${avatarError.message}`);
    }
    const avatarCategory = (avatarExists?.category as string | null | undefined) ?? null;
    if (!avatarExists || avatarCategory !== 'student') {
      throw new Error('Avatar not found or not available for students.');
    }
  }

  if (updates.tutor_persona_id) {
    // First check if it's a valid tutor avatar from the manifest
    const manifestAvatar = findTutorAvatar(updates.tutor_persona_id);
    if (!manifestAvatar) {
      // Fall back to database lookup for custom personas
      const { data: personaExists, error: personaError } = await supabase
        .from('tutor_personas')
        .select('id')
        .eq('id', updates.tutor_persona_id)
        .maybeSingle();
      if (personaError) {
        throw new Error(`Unable to validate tutor persona: ${personaError.message}`);
      }
      if (!personaExists) {
        throw new Error('Tutor persona not found.');
      }
    }
  }

  const { data, error } = await supabase
    .from('student_preferences')
    .upsert({ ...updates, student_id: studentId })
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to save student preferences: ${error.message}`);
  }

  // Keep legacy profile columns in sync for compatibility.
  const profileUpdate: Record<string, unknown> = {};
  if (updates.avatar_id) {
    profileUpdate.avatar_id = updates.avatar_id;
    profileUpdate.student_avatar_id = updates.avatar_id;
  }
  if (updates.tutor_persona_id) {
    profileUpdate.tutor_persona_id = updates.tutor_persona_id;
  }
  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await supabase
      .from('student_profiles')
      .update(profileUpdate)
      .eq('id', studentId);
    if (profileError) {
      throw new Error(`Unable to sync profile fields: ${profileError.message}`);
    }
  }

  return data as StudentPreferences;
};

export const buildTutorContext = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{
  preferences: StudentPreferences;
  persona: TutorPersona | null;
  avatar: CatalogAvatar | null;
  xp: { total: number; streakDays: number };
  recentEvents: Array<{ event_type: string; points_awarded: number; created_at: string }>;
}> => {
  const preferences = await getStudentPreferences(supabase, studentId);

  const [persona, avatar, xpRow, recentEvents] = await Promise.all([
    preferences.tutor_persona_id
      ? supabase
        .from('tutor_personas')
        .select('id, name, tone, constraints, prompt_snippet, sample_replies, metadata')
        .eq('id', preferences.tutor_persona_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    preferences.avatar_id
      ? supabase
        .from('avatars')
        .select('id, name, image_url, category, is_default, metadata')
        .eq('id', preferences.avatar_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('xp_ledger')
      .select('xp_total, streak_days')
      .eq('student_id', studentId)
      .maybeSingle(),
    supabase
      .from('student_events')
      .select('event_type, points_awarded, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (persona.error) {
    throw new Error(`Unable to load tutor persona: ${persona.error.message}`);
  }
  if (avatar.error) {
    throw new Error(`Unable to load avatar: ${avatar.error.message}`);
  }
  if (xpRow.error) {
    throw new Error(`Unable to load XP snapshot: ${xpRow.error.message}`);
  }
  if (recentEvents.error) {
    throw new Error(`Unable to load recent events: ${recentEvents.error.message}`);
  }

  return {
    preferences,
    persona: (persona.data as TutorPersona | null) ?? null,
    avatar: (avatar.data as CatalogAvatar | null) ?? null,
    xp: {
      total: (xpRow.data?.xp_total as number | null | undefined) ?? 0,
      streakDays: (xpRow.data?.streak_days as number | null | undefined) ?? 0,
    },
    recentEvents: (recentEvents.data as Array<{ event_type: string; points_awarded: number; created_at: string }> | null) ?? [],
  };
};
