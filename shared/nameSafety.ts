const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
};

const FORBIDDEN_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dumbass',
  'douche',
  'crap',
  'kill',
  'murder',
  'suicide',
  'sex',
  'sexy',
  'porn',
  'nsfw',
  'drug',
  'weed',
  'vape',
  'boob',
  'butt',
  'damn',
];

const RESERVED_NAMES = ['admin', 'moderator', 'support', 'teacher', 'system', 'null', 'undefined'];

const stripAccents = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const normalizeForChecks = (value: string): string => {
  const lower = stripAccents(value).toLowerCase();
  const replaced = lower
    .split('')
    .map((char) => LEET_MAP[char] ?? char)
    .join('');
  return replaced.replace(/[^a-z0-9\s'-]/g, ' ');
};

const hasProhibitedToken = (normalized: string): boolean => {
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.some((token) => FORBIDDEN_WORDS.includes(token) || RESERVED_NAMES.includes(token));
};

export type NameValidationResult =
  | { ok: true; value: string; normalized: string }
  | { ok: false; reason: 'too_short' | 'too_long' | 'invalid_chars' | 'unsafe' };

export const normalizeTutorName = (input: string): string => input.replace(/\s+/g, ' ').trim();

export const validateTutorName = (raw: string): NameValidationResult => {
  const cleaned = normalizeTutorName(raw);
  if (!cleaned.length) {
    return { ok: false, reason: 'too_short' };
  }

  if (cleaned.length < 2) {
    return { ok: false, reason: 'too_short' };
  }

  if (cleaned.length > 24) {
    return { ok: false, reason: 'too_long' };
  }

  if (/[^a-zA-Z0-9\s'-]/.test(cleaned)) {
    return { ok: false, reason: 'invalid_chars' };
  }

  const normalized = normalizeForChecks(cleaned);

  if (/(.)\1{3,}/.test(normalized.replace(/\s+/g, ''))) {
    return { ok: false, reason: 'invalid_chars' };
  }

  if (hasProhibitedToken(normalized)) {
    return { ok: false, reason: 'unsafe' };
  }

  return { ok: true, value: cleaned, normalized };
};

export const tutorNameErrorMessage = (result: Extract<NameValidationResult, { ok: false }>): string => {
  switch (result.reason) {
    case 'too_short':
      return 'Pick a name with at least 2 characters.';
    case 'too_long':
      return 'Tutor names should be under 24 characters.';
    case 'invalid_chars':
      return 'Use letters, numbers, spaces, hyphens, or apostrophes only.';
    case 'unsafe':
      return 'That name is not classroom-friendly. Try another.';
    default:
      return 'Please choose a different tutor name.';
  }
};
