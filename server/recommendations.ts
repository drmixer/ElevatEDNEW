import type { SupabaseClient } from '@supabase/supabase-js';

type ModuleRecord = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  grade_band: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
  open_track: boolean;
  metadata: Record<string, unknown> | null;
  visibility: string;
};

export type Recommendation = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  grade_band: string;
  summary: string | null;
  open_track: boolean;
  reason: string;
  fallback: boolean;
};

const gradeOrder = (grade: string): number => {
  const trimmed = grade.trim().toLowerCase();
  if (trimmed === 'pre-k' || trimmed === 'prek') return -1;
  if (trimmed === 'k' || trimmed === 'kindergarten') return 0;

  const matches = trimmed.match(/\d+/g);
  if (matches && matches.length > 0) {
    const numbers = matches.map((value) => Number.parseInt(value, 10));
    const avg = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    return Number.isFinite(avg) ? avg : 0;
  }
  // Default high-school bucket for unspecified ranges like "HS".
  if (/hs|high/.test(trimmed)) return 10;
  return 0;
};

const computeScore = (
  current: ModuleRecord,
  candidate: ModuleRecord,
  lastScore: number | null,
): { score: number; reason: string } => {
  let score = 0;
  let reason = 'Explore related learning';

  const currentGrade = gradeOrder(current.grade_band);
  const candidateGrade = gradeOrder(candidate.grade_band);
  const gradeDiff = candidateGrade - currentGrade;

  if (candidate.strand && current.strand && candidate.strand === current.strand) {
    score += 3;
    reason = `Deepen ${current.strand} focus`;
  } else if (candidate.subject === current.subject) {
    score += 1;
    reason = `Continue in ${candidate.subject}`;
  }

  if (lastScore != null && Number.isFinite(lastScore)) {
    if (lastScore < 70) {
      if (gradeDiff <= 0) {
        score += 3;
        reason = `Reinforce foundations via ${candidate.topic ?? candidate.title}`;
      } else {
        score -= 2;
      }
    } else if (lastScore >= 90) {
      if (gradeDiff >= 0) {
        score += 3;
        reason = `Advance challenge with ${candidate.topic ?? candidate.title}`;
      } else {
        score -= 1;
      }
    } else {
      // mid-range score prefers lateral moves.
      if (Math.abs(gradeDiff) <= 1) {
        score += 1;
        reason = `Stay on pace with ${candidate.topic ?? candidate.title}`;
      }
    }
  } else if (Math.abs(gradeDiff) <= 1) {
    score += 1;
  }

  // Gently prefer close grade matches.
  score -= Math.abs(gradeDiff) * 0.2;

  return { score, reason };
};

const toRecommendation = (
  current: ModuleRecord,
  candidate: ModuleRecord,
  lastScore: number | null,
  fallback: boolean,
): Recommendation => {
  const { reason } = computeScore(current, candidate, lastScore);
  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title ?? candidate.topic ?? candidate.slug,
    subject: candidate.subject,
    strand: candidate.strand,
    topic: candidate.topic,
    grade_band: candidate.grade_band,
    summary: candidate.summary,
    open_track: candidate.open_track,
    reason: fallback ? `Subject fallback · ${reason}` : reason,
    fallback,
  };
};

export const fetchModuleById = async (
  supabase: SupabaseClient,
  moduleId: number,
): Promise<ModuleRecord | null> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, summary, grade_band, subject, strand, topic, subtopic, open_track, metadata, visibility')
    .eq('id', moduleId)
    .single();

  if (error) {
    throw new Error(`Failed to load module ${moduleId}: ${error.message}`);
  }

  if (!data || data.visibility !== 'public') {
    return null;
  }

  return data as ModuleRecord;
};

const fetchCandidates = async (
  supabase: SupabaseClient,
  current: ModuleRecord,
): Promise<ModuleRecord[]> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, summary, grade_band, subject, strand, topic, subtopic, open_track, metadata, visibility')
    .eq('subject', current.subject)
    .eq('visibility', 'public')
    .neq('id', current.id);

  if (error) {
    throw new Error(`Failed to fetch candidate modules: ${error.message}`);
  }

  return (data ?? []) as ModuleRecord[];
};

export const computeRecommendations = (
  current: ModuleRecord,
  candidates: ModuleRecord[],
  lastScore: number | null,
  limit = 3,
): Array<Recommendation & { score: number }> => {
  const scored = candidates.map((candidate) => {
    const { score, reason } = computeScore(current, candidate, lastScore);
    return {
      candidate,
      score,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.filter((entry) => entry.score > -2).slice(0, limit);

  return top.map((entry) => ({
    ...toRecommendation(current, entry.candidate, lastScore, false),
    score: entry.score,
  }));
};

const fetchFallbacks = async (
  supabase: SupabaseClient,
  subject: string,
  excludeIds: number[],
  limit = 3,
): Promise<ModuleRecord[]> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, summary, grade_band, subject, strand, topic, subtopic, open_track, metadata, visibility')
    .eq('subject', subject)
    .eq('visibility', 'public')
    .not('id', 'in', `(${excludeIds.join(',') || '0'})`)
    .order('grade_band', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch fallback modules: ${error.message}`);
  }

  return (data ?? []) as ModuleRecord[];
};

export const getRecommendations = async (
  supabase: SupabaseClient,
  moduleId: number,
  lastScore: number | null,
): Promise<{ recommendations: Recommendation[] }> => {
  const current = await fetchModuleById(supabase, moduleId);
  if (!current) {
    return { recommendations: [] };
  }

  const candidates = await fetchCandidates(supabase, current);
  const top = computeRecommendations(current, candidates, lastScore);

  if (top.length >= 3) {
    return {
      recommendations: top.slice(0, 3).map((entry) => ({
        ...entry,
        fallback: false,
        reason: entry.reason,
      })),
    };
  }

  const fallbackNeeded = 3 - top.length;
  const fallbackModules = await fetchFallbacks(
    supabase,
    current.subject,
    [current.id, ...top.map((entry) => entry.id)],
    fallbackNeeded,
  );

  const fallbackRecommendations = fallbackModules.map((module) =>
    toRecommendation(current, module, lastScore, true),
  );

  return {
    recommendations: [
      ...top.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        subject: entry.subject,
        strand: entry.strand,
        topic: entry.topic,
        grade_band: entry.grade_band,
        summary: entry.summary,
        open_track: entry.open_track,
        reason: entry.reason,
        fallback: false,
      })),
      ...fallbackRecommendations,
    ].slice(0, 3),
  };
};
