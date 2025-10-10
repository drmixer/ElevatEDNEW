export const ALLOWED_LICENSES = new Map<string, string>([
  ['cc by', 'CC BY'],
  ['cc by-sa', 'CC BY-SA'],
  ['cc0', 'CC0'],
  ['public domain', 'Public Domain'],
]);

export function normalizeLicense(rawLicense: string): string {
  const normalized = rawLicense.trim().toLowerCase();
  const resolved = ALLOWED_LICENSES.get(normalized);
  if (resolved) {
    return resolved;
  }

  // Handle common punctuation variants such as CC-BY or CC BY.
  const compact = normalized.replace(/[\s_-]+/g, ' ');
  const fallback = ALLOWED_LICENSES.get(compact);
  if (fallback) {
    return fallback;
  }

  return rawLicense.trim();
}

export function assertLicenseAllowed(rawLicense: string): string {
  const license = normalizeLicense(rawLicense);
  const key = license.trim().toLowerCase();
  if (!ALLOWED_LICENSES.has(key)) {
    throw new Error(
      `Unsupported license "${rawLicense}". Allowed licenses: ${Array.from(ALLOWED_LICENSES.values()).join(', ')}.`,
    );
  }
  return ALLOWED_LICENSES.get(key)!;
}

export function isAllowedLicense(rawLicense: string): boolean {
  const key = rawLicense.trim().toLowerCase();
  if (ALLOWED_LICENSES.has(key)) {
    return true;
  }
  const compact = key.replace(/[\s_-]+/g, ' ');
  return ALLOWED_LICENSES.has(compact);
}
