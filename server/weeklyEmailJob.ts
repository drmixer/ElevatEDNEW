import process from 'node:process';

import { createServiceRoleClient } from '../scripts/utils/supabase.js';
import { buildCoachingSuggestions } from '../src/lib/parentSuggestions';
import { normalizeSubject } from '../src/lib/subjects';
import type { ParentChildSnapshot } from '../src/types';

type ParentWeeklyReportRow = {
  parent_id: string;
  week_start: string;
  summary: string | null;
  highlights: string[] | null;
  recommendations: string[] | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ParentChildMini = {
  id: string;
  name: string | null;
  grade: number | null;
  masteryBySubject: Array<{ subject: string; mastery: number }>;
};

const fetchChildrenWithMastery = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  parentIds: string[],
): Promise<Map<string, ParentChildMini[]>> => {
  const { data: childRows, error: childError } = await supabase
    .from('parent_dashboard_children')
    .select('parent_id, student_id, first_name, last_name, grade')
    .in('parent_id', parentIds);

  if (childError) {
    throw new Error(`Failed to load children for weekly digest: ${childError.message}`);
  }

  const childIds = Array.from(new Set((childRows ?? []).map((row) => row.student_id)));

  const { data: masteryRows, error: masteryError } = await supabase
    .from('student_mastery')
    .select('student_id, skill_id, mastery_pct');

  if (masteryError) {
    throw new Error(`Failed to load mastery for weekly digest: ${masteryError.message}`);
  }

  const { data: skillRows, error: skillError } = await supabase.from('skills').select('id, subject_id');
  const { data: subjectRows, error: subjectError } = await supabase.from('subjects').select('id, name');

  if (skillError) {
    throw new Error(`Failed to load skills for weekly digest: ${skillError.message}`);
  }
  if (subjectError) {
    throw new Error(`Failed to load subjects for weekly digest: ${subjectError.message}`);
  }

  const skillSubject = new Map<number, number>();
  (skillRows ?? []).forEach((row) => {
    if (row.id != null && row.subject_id != null) {
      skillSubject.set(row.id, row.subject_id);
    }
  });
  const subjectLabels = new Map<number, string>();
  (subjectRows ?? []).forEach((row) => {
    if (row.id != null && typeof row.name === 'string') {
      subjectLabels.set(row.id, row.name);
    }
  });

  const masteryByChild = new Map<string, Map<string, { total: number; count: number }>>();
  (masteryRows ?? []).forEach((row) => {
    if (!childIds.includes(row.student_id)) return;
    const subjectId = skillSubject.get(row.skill_id);
    if (!subjectId) return;
    const key = subjectLabels.get(subjectId);
    if (!key) return;
    const entry = masteryByChild.get(row.student_id) ?? new Map();
    const agg = entry.get(key) ?? { total: 0, count: 0 };
    if (typeof row.mastery_pct === 'number') {
      agg.total += row.mastery_pct;
      agg.count += 1;
    }
    entry.set(key, agg);
    masteryByChild.set(row.student_id, entry);
  });

  const childrenByParent = new Map<string, ParentChildMini[]>();
  (childRows ?? []).forEach((row) => {
    const masteryMap = masteryByChild.get(row.student_id) ?? new Map<string, { total: number; count: number }>();
    const masteryBySubject = Array.from(masteryMap.entries()).map(([subject, agg]) => ({
      subject: subject,
      mastery: agg.count ? Math.round((agg.total / agg.count) * 100) / 100 : 0,
    }));
    const child: ParentChildMini = {
      id: row.student_id,
      name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || null,
      grade: row.grade,
      masteryBySubject,
    };
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(child);
    childrenByParent.set(row.parent_id, list);
  });

  return childrenByParent;
};

const weekStartIso = (): string => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

const buildEmailBody = (
  parentName: string,
  report: ParentWeeklyReportRow,
  coachingNudge?: { action: string; why: string; timeMinutes: number },
): string => {
  const highlightLines = (report.highlights ?? []).map((item) => `• ${item}`).join('\n');
  const recommendationLines = (report.recommendations ?? []).map((item) => `• ${item}`).join('\n');
  const weekLabel = new Date(report.week_start).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  const coachingLines = coachingNudge
    ? [`Nudge of the week (${coachingNudge.timeMinutes} min):`, `• ${coachingNudge.action}`, `Why: ${coachingNudge.why}`]
    : [];

  return [
    `Hi ${parentName || 'there'},`,
    '',
    `Here’s your ElevatED weekly snapshot for the week of ${weekLabel}.`,
    '',
    `Summary:`,
    report.summary ?? 'No summary available yet. Complete a few lessons to unlock insights.',
    '',
    highlightLines ? `Highlights:\n${highlightLines}` : 'Highlights: none to show yet.',
    '',
    recommendationLines ? `Next steps:\n${recommendationLines}` : 'Next steps: add a small goal for each learner.',
    '',
    coachingLines.join('\n'),
    '',
    'Open your dashboard: https://app.elevated.family/parent#weekly-snapshot',
  ].join('\n');
};

export const runWeeklyEmailJob = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const cutoffWeek = weekStartIso();

  const { data: reports, error } = await supabase
    .from('parent_weekly_reports')
    .select('parent_id, week_start, summary, highlights, recommendations')
    .gte('week_start', cutoffWeek)
    .limit(200);

  if (error) {
    throw new Error(`Failed to load weekly reports: ${error.message}`);
  }

  const parentIds = Array.from(new Set((reports ?? []).map((row) => row.parent_id)));
  if (!parentIds.length) {
    console.log('[weekly-email] No weekly reports found for the current week.');
    return;
  }

  const childrenByParent = await fetchChildrenWithMastery(supabase, parentIds);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', parentIds);

  if (profileError) {
    throw new Error(`Failed to load parent profiles: ${profileError.message}`);
  }

  const profileMap = new Map<string, ProfileRow>();
  (profiles ?? []).forEach((row) => profileMap.set(row.id, row as ProfileRow));

  const payloads = (reports as ParentWeeklyReportRow[]).map((report) => {
    const profile = profileMap.get(report.parent_id);
    const name = profile?.full_name ?? 'family';
    const email = profile?.email ?? 'unknown';
    const children = childrenByParent.get(report.parent_id) ?? [];
    const topChild = children[0];
    let coachingNudge: { action: string; why: string; timeMinutes: number } | undefined;
    if (topChild) {
      const mastery = topChild.masteryBySubject.map((entry) => ({
        subject: normalizeSubject(entry.subject) ?? 'math',
        mastery: entry.mastery,
      }));
      const childSnapshot: ParentChildSnapshot = {
        id: topChild.id,
        name: topChild.name ?? 'Learner',
        grade: topChild.grade ?? 5,
        level: 0,
        xp: 0,
        streakDays: 0,
        strengths: [],
        focusAreas: [],
        lessonsCompletedWeek: 0,
        practiceMinutesWeek: 0,
        xpEarnedWeek: 0,
        masteryBySubject: mastery,
        recentActivity: [],
      };
      const suggestion = buildCoachingSuggestions(childSnapshot, { max: 1, seed: report.week_start })[0];
      if (suggestion) {
        coachingNudge = {
          action: suggestion.action,
          why: suggestion.why,
          timeMinutes: suggestion.timeMinutes,
        };
      }
    }
    return {
      to: email,
      subject: `Your ElevatED Weekly Snapshot (${new Date(report.week_start).toLocaleDateString()})`,
      body: buildEmailBody(name, report, coachingNudge),
      parentId: report.parent_id,
      targetUrl: '/parent#weekly-snapshot',
    };
  });

  console.log(`[weekly-email] Prepared ${payloads.length} weekly snapshot emails for delivery.`);
  payloads.slice(0, 5).forEach((payload) => {
    console.log(`[weekly-email] ${payload.to} • ${payload.subject}`);
  });

  // Hook your ESP/worker here. We intentionally only prepare payloads to keep this repo side-effect free.
};

if (require.main === module) {
  runWeeklyEmailJob().catch((err) => {
    console.error('[weekly-email] Job failed', err);
    process.exitCode = 1;
  });
}
