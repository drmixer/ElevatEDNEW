type AttributionParts = {
  sourceName: string;
  license: string;
  license_url?: string;
  attribution_text?: string;
};

export function composeAttribution(parts: AttributionParts): string {
  const { sourceName, license, license_url: licenseUrl, attribution_text: attributionText } = parts;
  const segments: string[] = [];

  if (attributionText && attributionText.trim().length > 0) {
    segments.push(attributionText.trim());
  } else if (sourceName.trim().length > 0) {
    segments.push(sourceName.trim());
  }

  if (licenseUrl && licenseUrl.trim().length > 0) {
    segments.push(`[${license.trim()}](${licenseUrl.trim()})`);
  } else {
    segments.push(license.trim());
  }

  return segments.join(' · ');
}

export default composeAttribution;

export const splitAttributionBlock = (block: string | null | undefined): string[] => {
  if (!block) {
    return [];
  }
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const buildAttributionBlock = (segments: Iterable<string>): string => {
  const uniqueSegments: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const value = segment.trim();
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    uniqueSegments.push(value);
  }

  return uniqueSegments.join('\n');
};
