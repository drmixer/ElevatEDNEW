import { z } from 'zod';
import { type SupabaseClient } from '@supabase/supabase-js';
import { requireStudentOrGuardian, type AuthenticatedUser } from './auth.js';
import { HttpError } from './httpError.js';

const optOutSchema = z.object({
  studentId: z.string().uuid(),
  lessonId: z.string().min(1),
  weekStart: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  type: z.enum(['mix_in', 'elective']),
});

export const upsertPlanOptOut = async (
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  supabase: SupabaseClient,
  actor: AuthenticatedUser,
) => {
  const body = await readValidatedJson<z.infer<typeof optOutSchema>>(req);
  const parsed = optOutSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid payload', 'invalid_payload');
  }
  const { studentId, lessonId, weekStart, type } = parsed.data;
  const allowed = await requireStudentOrGuardian(supabase, actor, studentId);
  if (!allowed) {
    throw new HttpError(403, 'Forbidden', 'forbidden');
  }
  const { error } = await supabase.from('plan_opt_outs').insert({
    student_id: studentId,
    lesson_id: lessonId,
    week_start: weekStart,
    type,
  });
  if (error) {
    throw new HttpError(500, error.message, 'db_error');
  }
  sendJson(res, 200, { ok: true }, 'v1');
};

export const listPlanOptOutsApi = async (
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  supabase: SupabaseClient,
  actor: AuthenticatedUser,
) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const studentId = url.searchParams.get('studentId');
  const weekStart = url.searchParams.get('weekStart');
  if (!studentId || !weekStart) {
    throw new HttpError(400, 'Missing studentId or weekStart', 'invalid_payload');
  }
  const allowed = await requireStudentOrGuardian(supabase, actor, studentId);
  if (!allowed) {
    throw new HttpError(403, 'Forbidden', 'forbidden');
  }
  const { data, error } = await supabase
    .from('plan_opt_outs')
    .select('lesson_id, type')
    .eq('student_id', studentId)
    .eq('week_start', weekStart);
  if (error) {
    throw new HttpError(500, error.message, 'db_error');
  }
  sendJson(res, 200, { items: data ?? [] }, 'v1');
};
const sendJson = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readValidatedJson = async <T>(req: import('node:http').IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
};
