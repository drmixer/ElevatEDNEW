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
  const maxWidth = 300;
  const maxHeight = 140;
  const minWidth = 80;
  const minHeight = 90;
  const maxScale = Math.min(maxWidth / safeW, maxHeight / safeH);

  let scale = maxScale;
  let width = Math.round(safeW * scale);
  let height = Math.round(safeH * scale);

  if (width < minWidth && height < minHeight) {
    const minScale = Math.max(minWidth / safeW, minHeight / safeH);
    scale = Math.min(maxScale, minScale);
    width = Math.round(safeW * scale);
    height = Math.round(safeH * scale);
  }

  width = Math.max(1, Math.min(maxWidth, width));
  height = Math.max(1, Math.min(maxHeight, height));
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

const genericPerimeterSvg = (shape: 'square' | 'rectangle' | 'triangle'): LessonSectionVisual => {
  if (shape === 'square') {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Perimeter shown on a square">
  <rect x="200" y="55" width="120" height="120" rx="14" fill="#ECFDF5" stroke="#059669" stroke-width="4"/>
  <rect x="200" y="55" width="120" height="120" rx="14" fill="none" stroke="#0F172A" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: go all the way around</text>
</svg>`;
    return { alt: 'Perimeter shown on a square', svg: encodeSvgDataUrl(svg) };
  }

  if (shape === 'triangle') {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Perimeter shown on a triangle">
  <polygon points="180,175 340,175 260,70" fill="#FFFBEB" stroke="#D97706" stroke-width="4" stroke-linejoin="round"/>
  <polygon points="180,175 340,175 260,70" fill="none" stroke="#0F172A" stroke-width="3" stroke-dasharray="8 6" stroke-linejoin="round"/>
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: go all the way around</text>
</svg>`;
    return { alt: 'Perimeter shown on a triangle', svg: encodeSvgDataUrl(svg) };
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Perimeter shown on a rectangle">
  <rect x="170" y="70" width="180" height="100" rx="14" fill="#EEF2FF" stroke="#4F46E5" stroke-width="4"/>
  <rect x="170" y="70" width="180" height="100" rx="14" fill="none" stroke="#0F172A" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Perimeter: go all the way around</text>
</svg>`;
  return { alt: 'Perimeter shown on a rectangle', svg: encodeSvgDataUrl(svg) };
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

const placeValueChartSvg = (value: number): LessonSectionVisual => {
  const safe = Math.max(100, Math.min(999, Math.round(value)));
  const hundreds = Math.floor(safe / 100);
  const tens = Math.floor((safe % 100) / 10);
  const ones = safe % 10;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Place value chart">
  <rect x="70" y="54" width="380" height="118" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <line x1="196" y1="54" x2="196" y2="172" stroke="#CBD5E1" stroke-width="2"/>
  <line x1="322" y1="54" x2="322" y2="172" stroke="#CBD5E1" stroke-width="2"/>
  <text x="133" y="84" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="14" fill="#334155">Hundreds</text>
  <text x="259" y="84" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="14" fill="#334155">Tens</text>
  <text x="385" y="84" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="14" fill="#334155">Ones</text>
  <text x="133" y="135" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="44" font-weight="700" fill="#0F172A">${hundreds}</text>
  <text x="259" y="135" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="44" font-weight="700" fill="#0F172A">${tens}</text>
  <text x="385" y="135" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="44" font-weight="700" fill="#0F172A">${ones}</text>
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Number ${safe} by place value</text>
</svg>`;
  return { alt: 'Place value chart', svg: encodeSvgDataUrl(svg) };
};

const fractionBarSvg = (numerator: number, denominator: number): LessonSectionVisual => {
  const safeDenominator = Math.max(2, Math.min(12, denominator));
  const safeNumerator = Math.max(1, Math.min(safeDenominator - 1, numerator));
  const barWidth = 360;
  const barHeight = 44;
  const startX = 80;
  const startY = 92;
  const partWidth = barWidth / safeDenominator;
  const segments = Array.from({ length: safeDenominator }, (_, index) => {
    const x = Math.round(startX + index * partWidth);
    const width = Math.ceil(partWidth);
    const fill = index < safeNumerator ? '#60A5FA' : '#E2E8F0';
    return `<rect x="${x}" y="${startY}" width="${width}" height="${barHeight}" fill="${fill}" stroke="#475569" stroke-width="1"/>`;
  }).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Fraction bar model">
  ${segments}
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Fraction model: ${safeNumerator}/${safeDenominator}</text>
  <text x="260" y="166" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="15" fill="#334155">Blue parts are shaded; total parts are equal size.</text>
</svg>`;
  return { alt: `Fraction bar model showing ${safeNumerator}/${safeDenominator}`, svg: encodeSvgDataUrl(svg) };
};

const numberLineSvg = (start: number, end: number, highlight: number): LessonSectionVisual => {
  const safeStart = Math.max(0, Math.min(999, start));
  const safeEnd = Math.max(safeStart + 5, Math.min(999, end));
  const span = safeEnd - safeStart;
  const tickCount = Math.min(10, Math.max(5, span));
  const step = Math.max(1, Math.round(span / tickCount));
  const ticks = [];
  for (let value = safeStart; value <= safeEnd; value += step) {
    const ratio = (value - safeStart) / (safeEnd - safeStart);
    const x = Math.round(80 + ratio * 360);
    ticks.push(
      `<line x1="${x}" y1="110" x2="${x}" y2="126" stroke="#475569" stroke-width="2"/>` +
      `<text x="${x}" y="146" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="12" fill="#334155">${value}</text>`,
    );
  }

  const clampedHighlight = Math.max(safeStart, Math.min(safeEnd, highlight));
  const highlightRatio = (clampedHighlight - safeStart) / (safeEnd - safeStart);
  const highlightX = Math.round(80 + highlightRatio * 360);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Number line">
  <line x1="80" y1="118" x2="440" y2="118" stroke="#0F172A" stroke-width="3"/>
  ${ticks.join('')}
  <circle cx="${highlightX}" cy="118" r="8" fill="#2563EB"/>
  <text x="${highlightX}" y="98" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="13" font-weight="700" fill="#1E40AF">${clampedHighlight}</text>
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Number line strategy</text>
</svg>`;
  return { alt: 'Number line with highlighted value', svg: encodeSvgDataUrl(svg) };
};

const multiplicationArraySvg = (rows: number, columns: number): LessonSectionVisual => {
  const safeRows = Math.max(2, Math.min(8, rows));
  const safeColumns = Math.max(2, Math.min(10, columns));
  const cellSize = Math.min(24, Math.floor(220 / Math.max(safeRows, safeColumns)));
  const totalWidth = safeColumns * cellSize;
  const totalHeight = safeRows * cellSize;
  const startX = Math.round((520 - totalWidth) / 2);
  const startY = Math.round((220 - totalHeight) / 2) + 12;
  const cells = [];
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeColumns; col += 1) {
      const x = startX + col * cellSize;
      const y = startY + row * cellSize;
      cells.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#DBEAFE" stroke="#1D4ED8" stroke-width="1"/>`);
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Multiplication array">
  ${cells.join('')}
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Array model: ${safeRows} rows x ${safeColumns} columns</text>
</svg>`;
  return { alt: `Array model for ${safeRows} by ${safeColumns}`, svg: encodeSvgDataUrl(svg) };
};

const measurementRulerSvg = (length: number, unit: 'cm' | 'in'): LessonSectionVisual => {
  const safeLength = Math.max(6, Math.min(24, length));
  const barWidth = 360;
  const startX = 80;
  const topY = 84;
  const bottomY = 136;
  const tickStep = barWidth / safeLength;
  const ticks = Array.from({ length: safeLength + 1 }, (_, idx) => {
    const x = Math.round(startX + idx * tickStep);
    const tall = idx % 5 === 0 || idx === safeLength;
    return [
      `<line x1="${x}" y1="${topY}" x2="${x}" y2="${tall ? bottomY : bottomY - 12}" stroke="#334155" stroke-width="${tall ? 2 : 1}"/>`,
      tall
        ? `<text x="${x}" y="${bottomY + 18}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="11" fill="#334155">${idx}</text>`
        : '',
    ].join('');
  }).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Ruler visual">
  <rect x="${startX}" y="${topY}" width="${barWidth}" height="52" rx="8" fill="#FEF3C7" stroke="#92400E" stroke-width="2"/>
  ${ticks}
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Measurement model (${unit})</text>
</svg>`;
  return { alt: `Ruler marked in ${unit}`, svg: encodeSvgDataUrl(svg) };
};

const barGraphSvg = (values: number[]): LessonSectionVisual => {
  const bars = values.slice(0, 4).map((value) => Math.max(1, Math.min(12, value)));
  while (bars.length < 4) bars.push(2 + bars.length);
  const barWidth = 56;
  const gap = 24;
  const startX = Math.round((520 - (bars.length * barWidth + (bars.length - 1) * gap)) / 2);
  const baselineY = 162;
  const rects = bars.map((value, idx) => {
    const x = startX + idx * (barWidth + gap);
    const height = value * 9;
    const y = baselineY - height;
    return [
      `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" fill="#BFDBFE" stroke="#1D4ED8" stroke-width="2"/>`,
      `<text x="${x + Math.round(barWidth / 2)}" y="${baselineY + 18}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="12" fill="#334155">${String.fromCharCode(65 + idx)}</text>`,
    ].join('');
  }).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Bar graph">
  <line x1="86" y1="${baselineY}" x2="434" y2="${baselineY}" stroke="#0F172A" stroke-width="2"/>
  ${rects}
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Compare data using bar heights</text>
</svg>`;
  return { alt: 'Bar graph with labeled categories', svg: encodeSvgDataUrl(svg) };
};

const areaModelSvg = (widthUnits: number, heightUnits: number): LessonSectionVisual => {
  const safeW = Math.max(2, Math.min(12, widthUnits));
  const safeH = Math.max(2, Math.min(10, heightUnits));
  const totalWidth = 280;
  const totalHeight = 140;
  const cellWidth = totalWidth / safeW;
  const cellHeight = totalHeight / safeH;
  const startX = Math.round((520 - totalWidth) / 2);
  const startY = 56;
  const cells = [];
  for (let row = 0; row < safeH; row += 1) {
    for (let col = 0; col < safeW; col += 1) {
      const x = Math.round(startX + col * cellWidth);
      const y = Math.round(startY + row * cellHeight);
      cells.push(`<rect x="${x}" y="${y}" width="${Math.ceil(cellWidth)}" height="${Math.ceil(cellHeight)}" fill="#DCFCE7" stroke="#15803D" stroke-width="1"/>`);
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220" role="img" aria-label="Area model">
  ${cells.join('')}
  <text x="260" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700" fill="#0F172A">Area model: ${safeW} x ${safeH} = ${safeW * safeH}</text>
</svg>`;
  return { alt: `Area model with ${safeW * safeH} square units`, svg: encodeSvgDataUrl(svg) };
};

export type PerimeterDimensions =
  | { shape: 'rectangle'; a: number; b: number; unit: string }
  | { shape: 'square'; a: number; unit: string }
  | { shape: 'triangle'; a: number; b: number; c: number; unit: string };

const extractPerimeterDimensions = (
  sectionContent: string,
): PerimeterDimensions | null => {
  const text = (sectionContent ?? '').toString();
  const candidates: Array<{ index: number; dims: PerimeterDimensions }> = [];
  const pushCandidate = (index: number | undefined, dims: PerimeterDimensions) => {
    if (typeof index !== 'number' || !Number.isFinite(index)) return;
    candidates.push({ index, dims });
  };

  // Rectangle: "... 4 feet tall and 2 feet wide ..."
  for (const rectWords of text.matchAll(/(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)\s*(?:tall|high|long).{0,40}?(\d+)\s*\2\s*(?:wide|across)/gi)) {
    const a = Number.parseInt(rectWords[1] ?? '', 10);
    const unit = (rectWords[2] ?? 'units').toLowerCase();
    const b = Number.parseInt(rectWords[3] ?? '', 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      pushCandidate(rectWords.index, { shape: 'rectangle', a, b, unit });
    }
  }

  // Rectangle equation: "Perimeter = 4 + 2 + 4 + 2 = ..."
  for (const rectEq of text.matchAll(/perimeter\s*=\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*=/gi)) {
    const n1 = Number.parseInt(rectEq[1] ?? '', 10);
    const n2 = Number.parseInt(rectEq[2] ?? '', 10);
    const n3 = Number.parseInt(rectEq[3] ?? '', 10);
    const n4 = Number.parseInt(rectEq[4] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(n1) && Number.isFinite(n2) && n1 === n3 && n2 === n4 && n1 > 0 && n2 > 0) {
      pushCandidate(rectEq.index, { shape: 'rectangle', a: n1, b: n2, unit });
    }
  }

  // Square: "each side ... 3 feet", "sides that are each 3 feet", etc.
  for (const squareSide of text.matchAll(
    /square[^.]*?(?:each\s+side|sides?\s+(?:that\s+are\s+)?each)[^0-9]{0,20}(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)\b/gi,
  )) {
    const a = Number.parseInt(squareSide[1] ?? '', 10);
    const unit = (squareSide[2] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && a > 0) {
      pushCandidate(squareSide.index, { shape: 'square', a, unit });
    }
  }

  // Square equation: "Perimeter = 3 + 3 + 3 + 3 = ..."
  for (const squareEq of text.matchAll(/perimeter\s*=\s*(\d+)\s*\+\s*\1\s*\+\s*\1\s*\+\s*\1\s*=/gi)) {
    const a = Number.parseInt(squareEq[1] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && a > 0) {
      pushCandidate(squareEq.index, { shape: 'square', a, unit });
    }
  }

  // Triangle: parse the first triangle sentence and use its first 3 side lengths.
  for (const triSentence of text.matchAll(/triangle[^.]*/gi)) {
    const sideMatches = Array.from(
      (triSentence[0] ?? '').matchAll(/(\d+)\s*(feet|foot|ft|inches|inch|in|cm|m)\b/gi),
    );
    if (sideMatches.length < 3) continue;

    const a = Number.parseInt(sideMatches[0]?.[1] ?? '', 10);
    const b = Number.parseInt(sideMatches[1]?.[1] ?? '', 10);
    const c = Number.parseInt(sideMatches[2]?.[1] ?? '', 10);
    const unit = (sideMatches[0]?.[2] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && a > 0 && b > 0 && c > 0) {
      pushCandidate(triSentence.index, { shape: 'triangle', a, b, c, unit });
    }
  }

  // Triangle equation: "Perimeter = 2 + 3 + 4 = ..."
  for (const triEq of text.matchAll(/perimeter\s*=\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*=/gi)) {
    const a = Number.parseInt(triEq[1] ?? '', 10);
    const b = Number.parseInt(triEq[2] ?? '', 10);
    const c = Number.parseInt(triEq[3] ?? '', 10);
    const unitMatch = text.match(/=\s*\d+\s*(feet|foot|ft|inches|inch|in|cm|m)\b/i);
    const unit = (unitMatch?.[1] ?? 'units').toLowerCase();
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && a > 0 && b > 0 && c > 0) {
      pushCandidate(triEq.index, { shape: 'triangle', a, b, c, unit });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[candidates.length - 1]?.dims ?? null;
};

export const extractPerimeterDimensionsFromText = (text: string): PerimeterDimensions | null =>
  extractPerimeterDimensions(text);

const extractNumbers = (text: string): number[] =>
  ((text ?? '').toString().match(/\b\d+\b/g) ?? [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

const extractFraction = (text: string): { numerator: number; denominator: number } | null => {
  const match = (text ?? '').toString().match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (!match) return null;
  const numerator = Number.parseInt(match[1] ?? '', 10);
  const denominator = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 1) return null;
  return { numerator, denominator };
};

const resolveGeneralK5MathVisual = (text: string): LessonSectionVisual | null => {
  const normalized = text.toLowerCase();
  const numbers = extractNumbers(text);

  if (/(place value|hundreds|tens|ones|expanded form|digit value)/i.test(normalized)) {
    const value = numbers.find((number) => number >= 100 && number <= 999) ?? 427;
    return placeValueChartSvg(value);
  }

  if (/(fraction|numerator|denominator|equivalent)/i.test(normalized)) {
    const fraction = extractFraction(text);
    if (fraction) {
      return fractionBarSvg(fraction.numerator, fraction.denominator);
    }
    const denominator = Math.max(2, Math.min(12, numbers[0] ?? 4));
    const numerator = Math.max(1, Math.min(denominator - 1, numbers[1] ?? 2));
    return fractionBarSvg(numerator, denominator);
  }

  if (/(multiply|multiplication|divide|division|product|quotient|array|equal groups)/i.test(normalized)) {
    const rows = Math.max(2, Math.min(8, numbers[0] ?? 3));
    const columns = Math.max(2, Math.min(10, numbers[1] ?? 4));
    return multiplicationArraySvg(rows, columns);
  }

  if (/(bar graph|line plot|table|chart|data|survey|graph)/i.test(normalized)) {
    return barGraphSvg(numbers.slice(0, 4));
  }

  if (/(measure|measurement|length|ruler|inch|inches|centimeter|cm)/i.test(normalized)) {
    const length = Math.max(6, Math.min(24, numbers[0] ?? 12));
    const unit = /\b(in|inch|inches)\b/i.test(normalized) ? 'in' : 'cm';
    return measurementRulerSvg(length, unit);
  }

  if (/\barea\b/i.test(normalized)) {
    const widthUnits = Math.max(2, Math.min(12, numbers[0] ?? 6));
    const heightUnits = Math.max(2, Math.min(10, numbers[1] ?? 4));
    return areaModelSvg(widthUnits, heightUnits);
  }

  if (/(add|subtract|sum|difference|number line)/i.test(normalized)) {
    const start = Math.max(0, numbers[0] ?? 0);
    const highlight = Math.max(start + 1, numbers[1] ?? start + 4);
    return numberLineSvg(start, highlight + 6, highlight);
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

  if (grade == null || grade > 5) {
    return null;
  }

  if (!subject.includes('math')) {
    return null;
  }

  // Pilot: perimeter visuals.
  if (title.includes('perimeter') || (input.sectionTitle ?? '').toString().toLowerCase().includes('perimeter')) {
    const dims = extractPerimeterDimensions(input.sectionContent);
    if (!dims) {
      const t = `${input.sectionTitle ?? ''}\n${input.sectionContent ?? ''}`.toLowerCase();
      if (t.includes('triangle')) return genericPerimeterSvg('triangle');
      if (t.includes('rectangle')) return genericPerimeterSvg('rectangle');
      return genericPerimeterSvg('square');
    }

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

  const generalVisual = resolveGeneralK5MathVisual(
    `${input.lessonTitle ?? ''}\n${input.sectionTitle ?? ''}\n${input.sectionContent ?? ''}`,
  );
  if (generalVisual) return generalVisual;

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

  const prompt = (input.prompt ?? '').toString();
  const promptLower = prompt.toLowerCase();
  if (title.includes('perimeter') || promptLower.includes('perimeter')) {
    const dims = extractPerimeterDimensions(prompt);
    if (!dims) {
      if (promptLower.includes('triangle')) return genericPerimeterSvg('triangle');
      if (promptLower.includes('rectangle')) return genericPerimeterSvg('rectangle');
      return genericPerimeterSvg('square');
    }

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

  return resolveGeneralK5MathVisual(`${input.lessonTitle ?? ''}\n${prompt}`);
};
