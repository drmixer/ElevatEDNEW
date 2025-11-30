import supabase from '../lib/supabaseClient';

type TutorPersonaPayload = {
  name?: string | null;
  avatarId?: string | null;
};

type TutorPersonaResponse = {
  tutorName?: string | null;
  tutorAvatarId?: string | null;
};

const buildAuthHeaders = async (): Promise<Headers> => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
};

const parseApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) return payload.error;
  } catch {
    // Ignore parsing issues; fall back to default.
  }
  return fallback;
};

export const saveTutorPersona = async (payload: TutorPersonaPayload): Promise<TutorPersonaResponse> => {
  const headers = await buildAuthHeaders();
  const response = await fetch('/api/v1/profile/tutor', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Unable to save tutor preferences.'));
  }

  return (await response.json()) as TutorPersonaResponse;
};

export const saveStudentAvatar = async (avatarId: string): Promise<{ avatarId: string }> => {
  const headers = await buildAuthHeaders();
  const response = await fetch('/api/v1/profile/student-avatar', {
    method: 'POST',
    headers,
    body: JSON.stringify({ avatarId }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Unable to update your avatar.'));
  }

  return (await response.json()) as { avatarId: string };
};
