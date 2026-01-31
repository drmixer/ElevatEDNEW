export type LessonSectionVisual = {
  alt: string;
  svg: string;
};

export type LessonPracticeVisual = LessonSectionVisual;

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

const computeRectSize = (widthUnits: number, heightUnits: number) => {
  const safeW = Math.max(1, Math.min(999, widthUnits));
  const safeH = Math.max(1, Math.min(999, heightUnits));
  const ratio = safeW / safeH;

  const maxDim = 260;
  const minDim = 140;

  if (ratio >= 1) {
    const width = maxDim;
    const height = Math.max(minDim, Math.round(maxDim / ratio));
    return { width, height };
  }

  const height = maxDim;
  const width = Math.max(minDim, Math.round(maxDim * ratio));
  return { width, height };
};

const rectSvg = (widthLabel: string, heightLabel: string, widthUnits: number, heightUnits: number): LessonSectionVisual => {
  const { width, height } = computeRectSize(widthUnits, heightUnits);
  const x = Math.round((520 - width) / 2);
  const y = Math.round((220 - height) / 2);
  const rx = 14;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Rectangle with side lengths labeled">
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="#EEF2FF" stroke="#4F46E5" stroke-width="4"/>

  <!-- width label -->
  <line x1="${x}" y1="${y + height + 15}" x2="${x + width}" y2="${y + height + 15}" stroke="#334155" stroke-width="2"/>
  <line x1="${x}" y1="${y + height + 8}" x2="${x}" y2="${y + height + 22}" stroke="#334155" stroke-width="2"/>
  <line x1="${x + width}" y1="${y + height + 8}" x2="${x + width}" y2="${y + height + 22}" stroke="#334155" stroke-width="2"/>
  <text x="${x + Math.round(width / 2)}" y="${Math.min(214, y + height + 38)}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${widthLabel}</text>

  <!-- height label -->
  <line x1="${x - 25}" y1="${y}" x2="${x - 25}" y2="${y + height}" stroke="#334155" stroke-width="2"/>
  <line x1="${x - 32}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="#334155" stroke-width="2"/>
  <line x1="${x - 32}" y1="${y + height}" x2="${x - 18}" y2="${y + height}" stroke="#334155" stroke-width="2"/>
  <text x="${x - 48}" y="${y + Math.round(height / 2)}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A" transform="rotate(-90 ${x - 48} ${y + Math.round(height / 2)})">${heightLabel}</text>

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

const triangleSvg = (
  sideA: string,
  sideB: string,
  sideC: string,
  aUnits: number,
  bUnits: number,
  cUnits: number,
): LessonSectionVisual => {
  const safeA = Math.max(1, Math.min(999, aUnits));
  const safeB = Math.max(1, Math.min(999, bUnits));
  const safeC = Math.max(1, Math.min(999, cUnits));

  // Ensure triangle inequality (otherwise fall back to a simple 3-4-5 style triangle).
  const a = safeA;
  const b = safeB;
  const c = safeC;
  const valid = a + b > c && a + c > b && b + c > a;

  const aa = valid ? a : 3;
  const bb = valid ? b : 4;
  const cc = valid ? c : 5;

  // Place base CC on the bottom, compute vertex via law of cosines.
  const x = (aa * aa - bb * bb + cc * cc) / (2 * cc);
  const hSq = Math.max(0, aa * aa - x * x);
  const h = Math.sqrt(hSq);

  // Scale to fit the 520x220 canvas.
  const maxBasePx = 280;
  const maxHeightPx = 140;
  const scale = Math.max(0.1, Math.min(maxBasePx / cc, maxHeightPx / (h || 1)));

  const basePx = cc * scale;
  const heightPx = h * scale;
  const xPx = x * scale;

  const baseLeftX = Math.round(260 - basePx / 2);
  const baseRightX = Math.round(260 + basePx / 2);
  const baseY = 170;
  const apexX = Math.round(baseLeftX + xPx);
  const apexY = Math.round(baseY - heightPx);

  const mid = (x1: number, y1: number, x2: number, y2: number) => ({
    x: Math.round((x1 + x2) / 2),
    y: Math.round((y1 + y2) / 2),
  });

  const mLeft = mid(baseLeftX, baseY, apexX, apexY);
  const mRight = mid(baseRightX, baseY, apexX, apexY);
  const mBase = mid(baseLeftX, baseY, baseRightX, baseY);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Triangle with side lengths labeled">
  <polygon points="${baseLeftX},${baseY} ${baseRightX},${baseY} ${apexX},${apexY}" fill="#FFFBEB" stroke="#D97706" stroke-width="4" stroke-linejoin="round"/>

  <text x="${mLeft.x - 14}" y="${mLeft.y}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${sideA}</text>
  <text x="${mRight.x + 14}" y="${mRight.y}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${sideB}</text>
  <text x="${mBase.x}" y="${Math.min(214, mBase.y + 28)}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="16" fill="#0F172A">${sideC}</text>

  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: add all the sides</text>
</svg>`;

  return { alt: 'Triangle with side lengths labeled', svg: encodeSvgDataUrl(svg) };
};

type PerimeterDimensions =
  | { shape: 'rectangle'; a: number; b: number; unit: string }
  | { shape: 'square'; a: number; unit: string }
  | { shape: 'triangle'; a: number; b: number; c: number; unit: string };

const extractPerimeterDimensions = (
  sectionContent: string,
): PerimeterDimensions | null => {
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
      return { shape: 'square', a, unit };
    }
  }

  // Square equation: "Perimeter = 3 + 3 + 3 + 3 = ..."
  const squareEq = text.match(/perimeter\s*=\s*(\d+)\s*\+\s*\1\s*\+\s*\1\s*\+\s*\1\s*=/i);
  if (squareEq) {
    const a = Number.parseInt(squareEq[1] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && a > 0) {
      return { shape: 'square', a, unit };
    }
  }

  // Triangle: "A triangle has sides 2 feet, 3 feet, and 4 feet."
  const triWords = text.match(
    /triangle[^.]*?sides?\s*(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)?[^0-9]+(\d+)\s*(?:\2)?[^0-9]+(\d+)\s*(?:\2)?/i,
  );
  if (triWords) {
    const a = Number.parseInt(triWords[1] ?? '', 10);
    const b = Number.parseInt(triWords[3] ?? '', 10);
    const c = Number.parseInt(triWords[4] ?? '', 10);
    const unit = ((triWords[2] ?? 'units') as string).toLowerCase();
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && a > 0 && b > 0 && c > 0) {
      return { shape: 'triangle', a, b, c, unit };
    }
  }

  // Triangle equation: "Perimeter = 2 + 3 + 4 = ..."
  const triEq = text.match(/perimeter\s*=\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*=/i);
  if (triEq) {
    const a = Number.parseInt(triEq[1] ?? '', 10);
    const b = Number.parseInt(triEq[2] ?? '', 10);
    const c = Number.parseInt(triEq[3] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && a > 0 && b > 0 && c > 0) {
      return { shape: 'triangle', a, b, c, unit };
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

    if (dims.shape === 'triangle') {
      return triangleSvg(
        `${dims.a} ${unitLabel}`,
        `${dims.b} ${unitLabel}`,
        `${dims.c} ${unitLabel}`,
        dims.a,
        dims.b,
        dims.c,
      );
    }

    return rectSvg(`${dims.b} ${unitLabel}`, `${dims.a} ${unitLabel}`, dims.b, dims.a);
  }

  return null;
};

export const getPracticeQuestionVisual = (input: {
  lessonTitle?: string | null;
  subject?: string | null;
  gradeBand?: string | null;
  prompt: string;
}): LessonPracticeVisual | null => {
  const subject = normalizeSubject(input.subject);
  const grade = parseGrade(input.gradeBand);
  const title = (input.lessonTitle ?? '').toString().toLowerCase();

  if (!subject.includes('math') || grade == null || grade > 5) {
    return null;
  }

  if (!title.includes('perimeter')) return null;

  const dims = extractPerimeterDimensions(input.prompt);
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

  if (dims.shape === 'triangle') {
    return triangleSvg(
      `${dims.a} ${unitLabel}`,
      `${dims.b} ${unitLabel}`,
      `${dims.c} ${unitLabel}`,
      dims.a,
      dims.b,
      dims.c,
    );
  }

  return rectSvg(`${dims.b} ${unitLabel}`, `${dims.a} ${unitLabel}`, dims.b, dims.a);
};
