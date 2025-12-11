import supabase from '../lib/supabaseClient';

type PlanOptOut = {
  id: string;
  student_id: string;
  lesson_id: string;
  week_start: string;
  type: 'mix_in' | 'elective';
};

export const listPlanOptOuts = async (
  studentId: string,
  weekStart: string,
): Promise<{ mixIns: Set<string>; electives: Set<string> }> => {
  const { data, error } = await supabase
    .from('plan_opt_outs')
    .select('lesson_id, type')
    .eq('student_id', studentId)
    .eq('week_start', weekStart);
  if (error) {
    console.warn('[plan_opt_outs] list failed', error);
    return { mixIns: new Set(), electives: new Set() };
  }
  const mixIns = new Set<string>();
  const electives = new Set<string>();
  (data as PlanOptOut[]).forEach((row) => {
    if (row.type === 'mix_in') {
      mixIns.add(row.lesson_id);
    } else if (row.type === 'elective') {
      electives.add(row.lesson_id);
    }
  });
  return { mixIns, electives };
};

export const upsertPlanOptOut = async (
  studentId: string,
  lessonId: string,
  weekStart: string,
  type: PlanOptOut['type'],
): Promise<void> => {
  const { error } = await supabase.from('plan_opt_outs').insert({
    student_id: studentId,
    lesson_id: lessonId,
    week_start: weekStart,
    type,
  });
  if (error) {
    console.warn('[plan_opt_outs] insert failed', error);
  }
};
