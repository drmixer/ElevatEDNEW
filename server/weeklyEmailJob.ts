import process from 'node:process';

import { createServiceRoleClient } from '../scripts/utils/supabase.js';

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

const weekStartIso = (): string => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

const buildEmailBody = (parentName: string, report: ParentWeeklyReportRow): string => {
  const highlightLines = (report.highlights ?? []).map((item) => `• ${item}`).join('\n');
  const recommendationLines = (report.recommendations ?? []).map((item) => `• ${item}`).join('\n');
  const weekLabel = new Date(report.week_start).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

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
    return {
      to: email,
      subject: `Your ElevatED Weekly Snapshot (${new Date(report.week_start).toLocaleDateString()})`,
      body: buildEmailBody(name, report),
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
