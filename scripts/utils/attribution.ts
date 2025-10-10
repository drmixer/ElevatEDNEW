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
