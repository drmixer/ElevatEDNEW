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

type ModuleProfile = {
  standards: Set<string>;
  baseline: {
    id: number;
    questionCount: number;
    attemptCount: number;
    completionRate: number;
    averageScore: number | null;
  } | null;
};

const formatStandardKey = (key: string): string => {
  const [framework, code] = key.split(':');
  if (code) {
    const trimmedFramework = framework?.trim();
    const trimmedCode = code.trim();
    return trimmedFramework && trimmedFramework.length > 0
      ? `${trimmedCode} (${trimmedFramework})`
      : trimmedCode;
  }
  return key.trim();
};

const describeStandards = (standards: Set<string>): string => {
  if (standards.size === 0) {
    return '';
  }
  const list = Array.from(standards);
  const descriptors = list.slice(0, 2).map(formatStandardKey);
  if (list.length > 2) {
    descriptors.push(`+${list.length - 2} more`);
  }
  return descriptors.join(', ');
};

const extractPurpose = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const purpose = record.purpose;
  if (typeof purpose === 'string' && purpose.trim().length > 0) {
    return purpose.trim();
  }
  const kind = record.kind;
  if (typeof kind === 'string' && kind.trim().length > 0) {
    return kind.trim();
  }
  return null;
};

const fetchModuleProfiles = async (
  supabase: SupabaseClient,
  moduleIds: number[],
): Promise<Map<number, ModuleProfile>> => {
  const uniqueModuleIds = Array.from(new Set(moduleIds)).filter((id) => Number.isFinite(id));
  const profiles = new Map<number, ModuleProfile>();
  uniqueModuleIds.forEach((id) =>
    profiles.set(id, {
      standards: new Set<string>(),
      baseline: null,
    }),
  );

  if (uniqueModuleIds.length === 0) {
    return profiles;
  }

  const { data: moduleStandardsData, error: moduleStandardsError } = await supabase
    .from('module_standards')
    .select('module_id, standard_id')
    .in('module_id', uniqueModuleIds);

  if (moduleStandardsError) {
    throw new Error(`Failed to load module standards: ${moduleStandardsError.message}`);
  }

  const standardIds = Array.from(
    new Set((moduleStandardsData ?? []).map((row) => row.standard_id as number)),
  );

  const standardLookup = new Map<number, string>();
  if (standardIds.length > 0) {
    const { data: standardsData, error: standardsError } = await supabase
      .from('standards')
      .select('id, framework, code')
      .in('id', standardIds);

    if (standardsError) {
      throw new Error(`Failed to load standards metadata: ${standardsError.message}`);
    }

    for (const standard of standardsData ?? []) {
      const id = standard.id as number;
      const framework = (standard.framework as string | null)?.trim() ?? '';
      const code = (standard.code as string | null)?.trim() ?? '';
      if (code.length === 0) continue;
      standardLookup.set(id, framework.length > 0 ? `${framework}:${code}` : code);
    }
  }

  for (const row of moduleStandardsData ?? []) {
    const moduleId = row.module_id as number;
    const key = standardLookup.get(row.standard_id as number);
    if (!key) continue;
    const profile = profiles.get(moduleId);
    if (!profile) continue;
    profile.standards.add(key);
  }

  const { data: assessmentsData, error: assessmentsError } = await supabase
    .from('assessments')
    .select('id, module_id, metadata')
    .in('module_id', uniqueModuleIds);

  if (assessmentsError) {
    throw new Error(`Failed to load assessments: ${assessmentsError.message}`);
  }

  const baselineAssessments = (assessmentsData ?? []).filter((row) => {
    const purpose = extractPurpose(row.metadata);
    return purpose ? purpose.toLowerCase() === 'baseline' : false;
  });

  if (baselineAssessments.length === 0) {
    return profiles;
  }

  const assessmentIds = baselineAssessments.map((row) => row.id as number);

  const { data: sectionsData, error: sectionsError } = await supabase
    .from('assessment_sections')
    .select('id, assessment_id')
    .in('assessment_id', assessmentIds);

  if (sectionsError) {
    throw new Error(`Failed to load assessment sections: ${sectionsError.message}`);
  }

  const sections = sectionsData ?? [];
  const sectionToAssessment = new Map<number, number>();
  const sectionIds: number[] = [];
  for (const section of sections) {
    const sectionId = section.id as number;
    sectionIds.push(sectionId);
    sectionToAssessment.set(sectionId, section.assessment_id as number);
  }

  const questionCountByAssessment = new Map<number, number>();
  if (sectionIds.length > 0) {
    const { data: questionRows, error: questionError } = await supabase
      .from('assessment_questions')
      .select('section_id')
      .in('section_id', sectionIds);

    if (questionError) {
      throw new Error(`Failed to load assessment question counts: ${questionError.message}`);
    }

    for (const row of questionRows ?? []) {
      const sectionId = row.section_id as number;
      const assessmentId = sectionToAssessment.get(sectionId);
      if (!assessmentId) continue;
      questionCountByAssessment.set(
        assessmentId,
        (questionCountByAssessment.get(assessmentId) ?? 0) + 1,
      );
    }
  }

  const { data: attemptsData, error: attemptsError } = await supabase
    .from('student_assessment_attempts')
    .select('assessment_id, status, total_score, mastery_pct')
    .in('assessment_id', assessmentIds);

  if (attemptsError) {
    throw new Error(`Failed to load assessment attempts: ${attemptsError.message}`);
  }

  const attemptStats = new Map<
    number,
    { attempts: number; completed: number; scoreTotal: number; scoreCount: number }
  >();

  for (const row of attemptsData ?? []) {
    const assessmentId = row.assessment_id as number;
    const stats =
      attemptStats.get(assessmentId) ??
      { attempts: 0, completed: 0, scoreTotal: 0, scoreCount: 0 };
    stats.attempts += 1;
    if ((row.status as string) === 'completed') {
      stats.completed += 1;
    }
    const score =
      row.mastery_pct != null
        ? Number(row.mastery_pct)
        : row.total_score != null
          ? Number(row.total_score)
          : null;
    if (score != null && Number.isFinite(score)) {
      stats.scoreTotal += score;
      stats.scoreCount += 1;
    }
    attemptStats.set(assessmentId, stats);
  }

  for (const assessment of baselineAssessments) {
    const moduleId = assessment.module_id as number;
    const profile = profiles.get(moduleId);
    if (!profile) continue;
    const stats =
      attemptStats.get(assessment.id as number) ??
      { attempts: 0, completed: 0, scoreTotal: 0, scoreCount: 0 };
    const completionRate = stats.attempts > 0 ? stats.completed / stats.attempts : 0;
    const averageScore =
      stats.scoreCount > 0 ? Math.round((stats.scoreTotal / stats.scoreCount) * 10) / 10 : null;
    profile.baseline = {
      id: assessment.id as number,
      questionCount: questionCountByAssessment.get(assessment.id as number) ?? 0,
      attemptCount: stats.attempts,
      completionRate,
      averageScore,
    };
  }

  return profiles;
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
  profiles: Map<number, ModuleProfile>,
): { score: number; reason: string } => {
  let score = 0;
  const reasons: string[] = [];
  const pushReason = (message: string) => {
    if (!message) return;
    if (!reasons.includes(message)) {
      reasons.push(message);
    }
  };

  const currentGrade = gradeOrder(current.grade_band);
  const candidateGrade = gradeOrder(candidate.grade_band);
  const gradeDiff = candidateGrade - currentGrade;

  if (candidate.strand && current.strand && candidate.strand === current.strand) {
    score += 2.5;
    pushReason(`Deepen ${current.strand}`);
  } else if (candidate.subject === current.subject) {
    score += 1.5;
    pushReason(`Stay in ${candidate.subject}`);
  }

  if (Math.abs(gradeDiff) <= 1) {
    score += 0.5;
  } else {
    score -= Math.abs(gradeDiff) * 0.2;
  }

  const currentProfile = profiles.get(current.id);
  const candidateProfile = profiles.get(candidate.id);
  const currentStandards = currentProfile?.standards ?? new Set<string>();
  const candidateStandards = candidateProfile?.standards ?? new Set<string>();

  const sharedStandards = new Set<string>();
  candidateStandards.forEach((entry) => {
    if (currentStandards.has(entry)) {
      sharedStandards.add(entry);
    }
  });

  const newStandards = new Set<string>();
  candidateStandards.forEach((entry) => {
    if (!currentStandards.has(entry)) {
      newStandards.add(entry);
    }
  });

  if (sharedStandards.size > 0) {
    score += 1.5;
    pushReason(`Reinforce ${describeStandards(sharedStandards)}`);
  } else if (candidateStandards.size > 0) {
    pushReason(`Cover ${describeStandards(candidateStandards)}`);
  }

  if (lastScore != null && Number.isFinite(lastScore)) {
    if (lastScore < 70) {
      if (sharedStandards.size > 0) {
        score += 2;
        pushReason('Target standards tied to recent gaps');
      } else {
        score += 0.5;
      }
      if (gradeDiff > 1) {
        score -= 1;
      }
    } else if (lastScore >= 90) {
      if (newStandards.size > 0) {
        score += 2;
        pushReason(`Stretch into ${describeStandards(newStandards)}`);
      } else {
        score += 0.5;
      }
      if (gradeDiff < -1) {
        score -= 0.5;
      }
    } else {
      if (candidateStandards.size > 0) {
        pushReason('Balance practice with assessed standards');
        score += 0.5;
      }
    }
  }

  const baseline = candidateProfile?.baseline;
  if (baseline) {
    score += 1;
    if (baseline.attemptCount === 0) {
      pushReason('Calibrate with a quick baseline quiz');
    } else if (baseline.averageScore != null) {
      const avg = Math.round(baseline.averageScore);
      pushReason(`Baseline avg ${avg}% to benchmark progress`);
    } else {
      pushReason('Baseline quiz available');
    }
  } else {
    score -= 0.3;
  }

  const reason = reasons.length > 0 ? reasons.join(' · ') : 'Explore related learning';
  return { score, reason };
};

const toRecommendation = (
  candidate: ModuleRecord,
  reason: string,
  fallback: boolean,
): Recommendation => {
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
  profiles: Map<number, ModuleProfile>,
  limit = 3,
): Array<Recommendation & { score: number }> => {
  const scored = candidates.map((candidate) => {
    const { score, reason } = computeScore(current, candidate, lastScore, profiles);
    return {
      candidate,
      score,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.filter((entry) => entry.score > -2).slice(0, limit);

  return top.map((entry) => ({
    ...toRecommendation(entry.candidate, entry.reason, false),
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
  const profiles = await fetchModuleProfiles(supabase, [current.id, ...candidates.map((c) => c.id)]);
  const top = computeRecommendations(current, candidates, lastScore, profiles);

  if (top.length >= 3) {
    return {
      recommendations: top.slice(0, 3).map((entry) => {
        const { score, ...recommendation } = entry;
        void score;
        return recommendation;
      }),
    };
  }

  const fallbackNeeded = 3 - top.length;
  const fallbackModules = await fetchFallbacks(
    supabase,
    current.subject,
    [current.id, ...top.map((entry) => entry.id)],
    fallbackNeeded,
  );

  const missingProfileIds = fallbackModules
    .map((module) => module.id)
    .filter((id) => !profiles.has(id));

  if (missingProfileIds.length > 0) {
    const fallbackProfiles = await fetchModuleProfiles(supabase, missingProfileIds);
    fallbackProfiles.forEach((value, key) => profiles.set(key, value));
  }

  const fallbackRecommendations = fallbackModules.map((module) => {
    const { reason } = computeScore(current, module, lastScore, profiles);
    return toRecommendation(module, reason, true);
  });

  return {
    recommendations: [
      ...top.map((entry) => {
        const { score, ...recommendation } = entry;
        void score;
        return recommendation;
      }),
      ...fallbackRecommendations,
    ].slice(0, 3),
  };
};
