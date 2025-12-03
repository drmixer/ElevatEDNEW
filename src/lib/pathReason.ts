import type { StudentPathEntry } from '../services/onboardingService';

export const humanizeStandard = (code?: string | null): string | null => {
  if (!code) return null;
  const trimmed = code.toString().trim();
  if (!trimmed.length) return null;
  const withoutFramework = trimmed.includes(':') ? trimmed.split(':').pop() ?? trimmed : trimmed;
  const cleaned = withoutFramework.replace(/[_\.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned.length) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const describePathEntryReason = (entry: StudentPathEntry): string => {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const reason =
    typeof meta.reason === 'string'
      ? meta.reason.toLowerCase()
      : entry.type === 'lesson' && meta.source === 'placement'
        ? 'placement'
        : entry.type;
  const standard =
    humanizeStandard((meta.standard_code as string | undefined) ?? (entry.target_standard_codes?.[0] ?? null)) ??
    humanizeStandard(
      Array.isArray(meta.last_standards) && typeof meta.last_standards[0] === 'string'
        ? (meta.last_standards[0] as string)
        : null,
    );

  if (reason === 'placement') {
    return standard ? `From your placement – covers ${standard}.` : 'From your placement to kick off your path.';
  }
  if (reason === 'remediation' || reason === 'review') {
    return standard ? `Review on ${standard} based on recent misses.` : 'Review based on recent practice.';
  }
  if (reason === 'stretch') {
    return standard
      ? `Stretch practice in ${standard} because you've been doing well.`
      : "Stretch practice because you've been doing well.";
  }
  if (reason === 'baseline') {
    return 'Baseline card to keep you warmed up.';
  }
  return standard ? `Covers ${standard} from your adaptive path.` : 'Next step from your adaptive path.';
};
