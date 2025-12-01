import supabase from '../lib/supabaseClient';
import { StudentReflection } from '../types';

const mapRow = (row: Record<string, unknown>): StudentReflection => ({
  id: String(row.id),
  studentId: String(row.student_id),
  questionId: String(row.question_id),
  responseText: String(row.response_text),
  lessonId: row.lesson_id ? String(row.lesson_id) : undefined,
  subject: row.subject ? String(row.subject) : undefined,
  sentiment: row.sentiment ? String(row.sentiment) : undefined,
  shareWithParent: Boolean(row.share_with_parent),
  createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
});

export const fetchReflections = async (limit = 10): Promise<StudentReflection[]> => {
  const { data, error } = await supabase
    .from('student_reflections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? 'Unable to fetch reflections');
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
};

export const saveReflection = async (
  payload: Omit<StudentReflection, 'id' | 'createdAt' | 'studentId'>,
): Promise<StudentReflection> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message ?? 'Unable to resolve user');
  }
  const studentId = userData.user?.id;
  if (!studentId) {
    throw new Error('You must be signed in to save a reflection');
  }
  const { data, error } = await supabase
    .from('student_reflections')
    .insert({
      student_id: studentId,
      question_id: payload.questionId,
      response_text: payload.responseText,
      lesson_id: payload.lessonId ?? null,
      subject: payload.subject ?? null,
      sentiment: payload.sentiment ?? null,
      share_with_parent: payload.shareWithParent ?? false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message ?? 'Unable to save reflection');
  }

  return mapRow(data as Record<string, unknown>);
};

export const toggleReflectionShare = async (id: string, shareWithParent: boolean): Promise<void> => {
  const { error } = await supabase
    .from('student_reflections')
    .update({ share_with_parent: shareWithParent })
    .eq('id', id);

  if (error) {
    throw new Error(error.message ?? 'Unable to update sharing preference');
  }
};
