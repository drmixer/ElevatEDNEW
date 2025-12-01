import supabase from '../lib/supabaseClient';

type TutorReportReason = 'incorrect' | 'confusing' | 'unsafe' | 'off_topic' | 'other';

export async function submitTutorAnswerReport({
  answer,
  reason,
  notes,
  messageId,
  conversationId,
  lessonId,
  subject,
}: {
  answer: string;
  reason: TutorReportReason;
  notes?: string;
  messageId?: string;
  conversationId: string;
  lessonId?: string | number | null;
  subject?: string | null;
}) {
  const { error } = await supabase.from('tutor_answer_reports').insert({
    answer,
    reason,
    notes: notes?.trim() || null,
    message_id: messageId ?? null,
    conversation_id: conversationId,
    metadata: {
      lessonId: lessonId ?? null,
      subject: subject ?? null,
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Unable to send report.');
  }
}

export type { TutorReportReason };
