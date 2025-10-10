export const ALLOWED_LICENSES = new Map<string, string>([
  ['cc by', 'CC BY'],
  ['cc by-sa', 'CC BY-SA'],
  ['cc by-nc', 'CC BY-NC'],
  ['cc by-nc-sa', 'CC BY-NC-SA'],
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

  const withoutVersion = normalized.replace(/\s*\d+(\.\d+)?$/u, '').trim();
  if (withoutVersion.length > 0) {
    const versionResolved = ALLOWED_LICENSES.get(withoutVersion);
    if (versionResolved) {
      return versionResolved;
    }
    const versionCompact = withoutVersion.replace(/[\s_-]+/g, ' ');
    const compactResolved = ALLOWED_LICENSES.get(versionCompact);
    if (compactResolved) {
      return compactResolved;
    }
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
  if (ALLOWED_LICENSES.has(compact)) {
    return true;
  }
  const withoutVersion = key.replace(/\s*\d+(\.\d+)?$/u, '').trim();
  if (withoutVersion.length > 0) {
    if (ALLOWED_LICENSES.has(withoutVersion)) {
      return true;
    }
    const versionCompact = withoutVersion.replace(/[\s_-]+/g, ' ');
    if (ALLOWED_LICENSES.has(versionCompact)) {
      return true;
    }
  }
  return false;
}
