import type {
  ParentChildSnapshot,
  ParentCoachingSuggestion,
  ParentSuggestionQualityIssue,
  Subject,
} from '../types';
import { parentSuggestionLibrary } from '../data/parentSuggestionLibrary';
import { formatSubjectLabel } from './subjects';

const WHY_NOW_PREFIX = /^why now:\s*/i;
const WHY_NOW_SIGNAL_PATTERN =
  /\b(this week|today|right now|currently|recent|recently|checkpoint|quiz|streak|goal|focus|missed|dip|dipped|drop|tracking|before|after|last|yesterday|next lesson)\b/i;
const ACTION_MIN_WORDS = 4;
const WHY_MIN_CHARS = 28;
const WHY_MAX_CHARS = 170;
const WEAK_WHY_PATTERN =
  /\b(builds?|reinforces?|strengthens?|improves?|solidifies?|clarifies?|connects?|boosts?|keeps?|helps?)\b/i;

type WhyNowContext = {
  text: string;
  hasStrongSignal: boolean;
};

const gradeBandFor = (grade: number | null | undefined): 'g3_5' | 'g6_8' | 'any' => {
  if (grade == null) return 'any';
  if (grade <= 5) return 'g3_5';
  if (grade <= 8) return 'g6_8';
  return 'any';
};

const hashSeed = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return Math.abs(hash);
};

const sentenceCase = (value: string): string => value.trim().replace(/\s+/g, ' ');

const withPeriod = (value: string): string => {
  const text = sentenceCase(value);
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const stripWhyNowPrefix = (value: string): string => sentenceCase(value).replace(WHY_NOW_PREFIX, '');

const clampCopy = (value: string): string => {
  const text = withPeriod(value);
  if (text.length <= WHY_MAX_CHARS) return text;
  return `${text.slice(0, WHY_MAX_CHARS - 1).trimEnd()}.`;
};

const asWhyNowCopy = (value: string): string => {
  const body = stripWhyNowPrefix(value);
  return clampCopy(`Why now: ${body}`);
};

const actionWordCount = (value: string): number => sentenceCase(value).split(/\s+/).filter(Boolean).length;

const isWeakAction = (action: string): boolean => actionWordCount(action) < ACTION_MIN_WORDS;

const isWeakWhyNow = (why: string): boolean => {
  const body = stripWhyNowPrefix(why);
  if (!body) return true;
  if (body.length < WHY_MIN_CHARS) return true;
  if (!WHY_NOW_SIGNAL_PATTERN.test(body)) return true;
  if (WEAK_WHY_PATTERN.test(body) && !/\d/.test(body)) return true;
  return false;
};

const fallbackActionBySubject: Partial<Record<Subject, string>> = {
  math: 'Solve one missed problem together and explain each step out loud.',
  english: 'Read one short paragraph together and ask for the main idea plus one detail.',
  science: 'Review one recent science question and explain the evidence behind the answer.',
  social_studies: 'Discuss one cause-and-effect example from recent social studies work.',
  study_skills: 'Set a 5-minute focus timer and complete one task start-to-finish.',
  arts_music: 'Practice one technique from today and briefly explain what improved.',
  financial_literacy: 'Review one money decision scenario and explain the best choice.',
  health_pe: 'Do one quick movement set and connect it to the wellness goal for the week.',
  computer_science: 'Trace one short code snippet line by line and explain what it does.',
};

const fallbackActionFor = (subject: Subject): string =>
  fallbackActionBySubject[subject] ??
  'Use a short check-in to revisit one concept from today and explain it clearly together.';

const deriveWhyNowContext = (
  child: ParentChildSnapshot,
  subject: Subject,
  timeMinutes: number,
): WhyNowContext => {
  const subjectLabel = formatSubjectLabel(subject);
  const studentName = child.name || 'Your learner';
  const masteryEntry = child.masteryBySubject?.find((entry) => entry.subject === subject) ?? null;
  const subjectStatus = child.subjectStatuses?.find((entry) => entry.subject === subject)?.status;
  const lessonsThisWeek = child.lessonsCompletedWeek ?? 0;
  const focusSignals =
    child.focusAreas?.some((area) => area.toLowerCase().includes(subjectLabel.toLowerCase())) ?? false;
  const minutes = Math.max(3, Math.round(timeMinutes || 5));

  if (subjectStatus === 'off_track' || subjectStatus === 'at_risk') {
    return {
      text: `${subjectLabel} is flagged as ${subjectStatus === 'off_track' ? 'off track' : 'at risk'} right now, so this ${minutes}-minute reset gives immediate support before the next lesson.`,
      hasStrongSignal: true,
    };
  }

  if (masteryEntry?.mastery != null) {
    const mastery = Math.round(masteryEntry.mastery);
    if (mastery < 70) {
      return {
        text: `${studentName} is at ${mastery}% mastery in ${subjectLabel}, so this ${minutes}-minute check-in this week helps close the gap before it compounds.`,
        hasStrongSignal: true,
      };
    }
    if (masteryEntry.trend === 'down') {
      return {
        text: `${subjectLabel} momentum dipped recently, and this ${minutes}-minute follow-up this week helps prevent another slide.`,
        hasStrongSignal: true,
      };
    }
    if (lessonsThisWeek < 2) {
      return {
        text: `${studentName} has only completed ${lessonsThisWeek} lesson${lessonsThisWeek === 1 ? '' : 's'} this week, so this quick ${subjectLabel} touchpoint keeps skills active.`,
        hasStrongSignal: true,
      };
    }
    return {
      text: `${studentName} is building consistency in ${subjectLabel} this week, and this short follow-up reinforces the newest skill while it is still fresh.`,
      hasStrongSignal: true,
    };
  }

  if (focusSignals) {
    return {
      text: `${subjectLabel} is a current focus area this week, so this short action gives targeted reinforcement right now.`,
      hasStrongSignal: true,
    };
  }

  if ((child.recentActivity?.length ?? 0) > 0) {
    return {
      text: `A recent learning session just happened, so this ${minutes}-minute follow-up now helps lock in the most recent ${subjectLabel} practice.`,
      hasStrongSignal: true,
    };
  }

  return {
    text: 'Recent learning signals are limited, so this short action keeps momentum this week until stronger why-now data is available.',
    hasStrongSignal: false,
  };
};

export const applyCoachingSuggestionQualityChecks = (
  child: ParentChildSnapshot,
  suggestions: ParentCoachingSuggestion[],
): ParentCoachingSuggestion[] =>
  suggestions.map((suggestion) => {
    const issues: ParentSuggestionQualityIssue[] = [];
    let action = withPeriod(suggestion.action || '');
    let why = sentenceCase(suggestion.why || '');

    if (!action) {
      issues.push('missing_action');
      action = fallbackActionFor(suggestion.subject);
    } else if (isWeakAction(action)) {
      issues.push('weak_action');
      action = fallbackActionFor(suggestion.subject);
    }

    const missingWhy = !why;
    if (missingWhy) {
      issues.push('missing_why_now');
    }
    if (missingWhy || isWeakWhyNow(why)) {
      if (!missingWhy) {
        issues.push('weak_why_now');
      }
      const repairedWhy = deriveWhyNowContext(child, suggestion.subject, suggestion.timeMinutes);
      why = repairedWhy.text;
      if (!repairedWhy.hasStrongSignal) {
        issues.push('missing_context_signal');
      }
    }

    const qualityStatus =
      issues.length === 0
        ? 'ok'
        : issues.includes('missing_context_signal')
        ? 'flagged'
        : 'auto_repaired';

    return {
      ...suggestion,
      action: withPeriod(action),
      why: asWhyNowCopy(why),
      qualityStatus,
      qualityIssues: issues.length ? [...new Set(issues)] : [],
    };
  });

export const summarizeCoachingSuggestionQuality = (suggestions: ParentCoachingSuggestion[]) =>
  suggestions.reduce(
    (acc, suggestion) => {
      acc.total += 1;
      if (suggestion.qualityStatus === 'auto_repaired') acc.autoRepaired += 1;
      if (suggestion.qualityStatus === 'flagged') acc.flagged += 1;
      return acc;
    },
    { total: 0, autoRepaired: 0, flagged: 0 },
  );

const pickSuggestions = (
  subject: Subject,
  gradeBand: 'g3_5' | 'g6_8' | 'any',
  count: number,
  seed: string,
  mastery: number | null | undefined,
): ParentCoachingSuggestion[] => {
  const candidates = parentSuggestionLibrary.filter(
    (entry) => entry.subject === subject && (entry.gradeBand === gradeBand || entry.gradeBand === 'any'),
  );

  const suggestions: ParentCoachingSuggestion[] = [];
  const random = hashSeed(seed);
  for (let i = 0; i < candidates.length && suggestions.length < count; i += 1) {
    const idx = (random + i) % candidates.length;
    const entry = candidates[idx];
    suggestions.push({
      id: entry.id,
      subject: entry.subject,
      action: entry.action,
      timeMinutes: entry.timeMinutes,
      why: entry.whyTemplate({ mastery, concept: null }),
      source: 'library',
    });
  }

  return suggestions;
};

export const buildCoachingSuggestions = (
  child: ParentChildSnapshot,
  opts?: { max?: number; seed?: string; excludeIds?: Set<string> },
): ParentCoachingSuggestion[] => {
  const max = opts?.max ?? 4;
  const seed = opts?.seed ?? new Date().toISOString().slice(0, 10);
  const excludeIds = opts?.excludeIds ?? new Set<string>();
  const gradeBand = gradeBandFor(child.grade);
  const weakestMasteryEntry = child.masteryBySubject?.slice().sort((a, b) => a.mastery - b.mastery)[0];
  const weakestSubject = weakestMasteryEntry?.subject ?? 'math';
  const weakestMastery = weakestMasteryEntry?.mastery ?? null;

  const primary = pickSuggestions(weakestSubject, gradeBand, max, `${child.id}-${seed}`, weakestMastery).filter(
    (item) => !excludeIds.has(item.id),
  );
  if (primary.length >= max) {
    return applyCoachingSuggestionQualityChecks(child, primary.slice(0, max));
  }

  const fallbackSubject: Subject = weakestSubject === 'math' ? 'english' : 'math';
  const secondary = pickSuggestions(
    fallbackSubject,
    gradeBand,
    max - primary.length,
    `${child.id}-${seed}-fallback`,
    weakestMastery,
  ).filter((item) => !excludeIds.has(item.id));

  const combined = [...primary, ...secondary];
  const base =
    combined.length > 0
      ? combined.slice(0, max)
      : [
          {
            id: `fallback-${child.id}`,
            subject: weakestSubject,
            action: 'Ask them to explain one thing they learned today in their own words.',
            timeMinutes: 5,
            why: 'Explaining builds confidence and reveals gaps.',
            source: 'fallback' as const,
          },
        ];
  return applyCoachingSuggestionQualityChecks(child, base);
};
