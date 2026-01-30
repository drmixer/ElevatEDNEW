export type LessonSectionVisual = {
  alt: string;
  svg: string;
};

const parseGrade = (gradeBand: string | null | undefined): number | null => {
  const match = (gradeBand ?? '').toString().match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

const normalizeSubject = (subject: string | null | undefined): string =>
  (subject ?? '').toString().trim().toLowerCase();

const encodeSvgDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const rectSvg = (widthLabel: string, heightLabel: string): LessonSectionVisual => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Rectangle with side lengths labeled">
  <rect x="140" y="50" width="240" height="120" rx="14" fill="#EEF2FF" stroke="#4F46E5" stroke-width="4"/>

  <!-- width label -->
  <line x1="140" y1="185" x2="380" y2="185" stroke="#334155" stroke-width="2"/>
  <line x1="140" y1="178" x2="140" y2="192" stroke="#334155" stroke-width="2"/>
  <line x1="380" y1="178" x2="380" y2="192" stroke="#334155" stroke-width="2"/>
  <text x="260" y="208" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${widthLabel}</text>

  <!-- height label -->
  <line x1="115" y1="50" x2="115" y2="170" stroke="#334155" stroke-width="2"/>
  <line x1="108" y1="50" x2="122" y2="50" stroke="#334155" stroke-width="2"/>
  <line x1="108" y1="170" x2="122" y2="170" stroke="#334155" stroke-width="2"/>
  <text x="92" y="113" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A" transform="rotate(-90 92 113)">${heightLabel}</text>

  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: add all the sides</text>
</svg>`;

  return { alt: 'Rectangle with side lengths labeled', svg: encodeSvgDataUrl(svg) };
};

const squareSvg = (sideLabel: string): LessonSectionVisual => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Square with side length labeled">
  <rect x="200" y="50" width="120" height="120" rx="14" fill="#ECFDF5" stroke="#059669" stroke-width="4"/>

  <!-- side label -->
  <line x1="200" y1="185" x2="320" y2="185" stroke="#334155" stroke-width="2"/>
  <line x1="200" y1="178" x2="200" y2="192" stroke="#334155" stroke-width="2"/>
  <line x1="320" y1="178" x2="320" y2="192" stroke="#334155" stroke-width="2"/>
  <text x="260" y="208" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${sideLabel}</text>

  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: add all the sides</text>
</svg>`;

  return { alt: 'Square with side length labeled', svg: encodeSvgDataUrl(svg) };
};

const extractPerimeterDimensions = (
  sectionContent: string,
): { shape: 'rectangle' | 'square'; a: number; b: number | null; unit: string } | null => {
  const text = (sectionContent ?? '').toString();

  // Rectangle: "... 4 feet tall and 2 feet wide ..."
  const rectWords = text.match(/(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)\s*(?:tall|high|long).{0,40}?(\d+)\s*\2\s*(?:wide|across)/i);
  if (rectWords) {
    const a = Number.parseInt(rectWords[1] ?? '', 10);
    const unit = (rectWords[2] ?? 'units').toLowerCase();
    const b = Number.parseInt(rectWords[3] ?? '', 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return { shape: 'rectangle', a, b, unit };
    }
  }

  // Rectangle equation: "Perimeter = 4 + 2 + 4 + 2 = ..."
  const rectEq = text.match(/perimeter\s*=\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*=/i);
  if (rectEq) {
    const n1 = Number.parseInt(rectEq[1] ?? '', 10);
    const n2 = Number.parseInt(rectEq[2] ?? '', 10);
    const n3 = Number.parseInt(rectEq[3] ?? '', 10);
    const n4 = Number.parseInt(rectEq[4] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(n1) && Number.isFinite(n2) && n1 === n3 && n2 === n4 && n1 > 0 && n2 > 0) {
      return { shape: 'rectangle', a: n1, b: n2, unit };
    }
  }

  // Square: "each side ... 3 feet"
  const squareSide = text.match(/each\s+side.*?(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
  if (squareSide) {
    const a = Number.parseInt(squareSide[1] ?? '', 10);
    const unit = (squareSide[2] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && a > 0) {
      return { shape: 'square', a, b: null, unit };
    }
  }

  // Square equation: "Perimeter = 3 + 3 + 3 + 3 = ..."
  const squareEq = text.match(/perimeter\s*=\s*(\d+)\s*\+\s*\1\s*\+\s*\1\s*\+\s*\1\s*=/i);
  if (squareEq) {
    const a = Number.parseInt(squareEq[1] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && a > 0) {
      return { shape: 'square', a, b: null, unit };
    }
  }

  return null;
};

export const getSectionVisual = (input: {
  lessonTitle?: string | null;
  subject?: string | null;
  gradeBand?: string | null;
  sectionTitle?: string | null;
  sectionContent: string;
}): LessonSectionVisual | null => {
  const subject = normalizeSubject(input.subject);
  const grade = parseGrade(input.gradeBand);
  const title = (input.lessonTitle ?? '').toString().toLowerCase();

  if (!subject.includes('math') || grade == null || grade > 5) {
    return null;
  }

  // Pilot: perimeter visuals.
  if (title.includes('perimeter') || (input.sectionTitle ?? '').toString().toLowerCase().includes('perimeter')) {
    const dims = extractPerimeterDimensions(input.sectionContent);
    if (!dims) return null;

    const unitLabel =
      dims.unit === 'foot' || dims.unit === 'feet' || dims.unit === 'ft'
        ? 'ft'
        : dims.unit === 'inch' || dims.unit === 'inches' || dims.unit === 'in'
          ? 'in'
          : dims.unit;

    if (dims.shape === 'square') {
      return squareSvg(`${dims.a} ${unitLabel}`);
    }

    return rectSvg(`${dims.b ?? dims.a} ${unitLabel}`, `${dims.a} ${unitLabel}`);
  }

  return null;
};

