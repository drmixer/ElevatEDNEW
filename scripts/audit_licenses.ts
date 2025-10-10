import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';
import { splitAttributionBlock } from './utils/attribution.js';
import { isAllowedLicense, normalizeLicense } from './utils/license.js';
import { createServiceRoleClient } from './utils/supabase.js';

type AssetRecord = {
  id: number;
  module_id: number | null;
  lesson_id: number | null;
  url: string;
  license: string;
  license_url: string | null;
  attribution_text: string | null;
};

type AuditIssue = {
  asset_id: number | null;
  lesson_id: number | null;
  module_id: number | null;
  issue:
    | 'invalid_license'
    | 'missing_license_url'
    | 'missing_attribution'
    | 'dead_url'
    | 'lesson_missing_attribution'
    | 'lesson_invalid_license';
  url: string | null;
  details: string;
};

type LessonRecord = {
  id: number;
  module_id: number | null;
  attribution_block: string | null;
};

const CONCURRENCY = 5;
const HEAD_TIMEOUT_MS = 8000;

const escapeCsv = (value: string | number | null) => {
  if (value == null) {
    return '';
  }
  const str = String(value);
  if (!/[",\n]/.test(str)) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const headRequest = async (url: string): Promise<{ ok: boolean; status?: number }> => {
  try {
    const response = await withTimeout(
      fetch(url, { method: 'HEAD' }),
      HEAD_TIMEOUT_MS,
    );
    if (!response.ok && response.status === 405) {
      const getResponse = await withTimeout(fetch(url, { method: 'GET' }), HEAD_TIMEOUT_MS);
      return { ok: getResponse.ok, status: getResponse.status };
    }
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: undefined };
  }
};

const checkUrls = async (assets: AssetRecord[]): Promise<Map<string, { ok: boolean; status?: number }>> => {
  const cache = new Map<string, { ok: boolean; status?: number }>();
  const queue = assets
    .map((asset) => asset.url.trim())
    .filter((url) => url.length > 0)
    .filter((url, index, arr) => arr.indexOf(url) === index);

  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const url = queue[index];
      const result = await headRequest(url);
      cache.set(url, result);
      // Friendly pacing to avoid hammering providers.
      await wait(150);
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker());
  await Promise.all(workers);

  return cache;
};

const fetchAssets = async (supabase: SupabaseClient): Promise<AssetRecord[]> => {
  const { data, error } = await supabase
    .from('assets')
    .select('id, module_id, lesson_id, url, license, license_url, attribution_text');

  if (error) {
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  return (data ?? []) as AssetRecord[];
};

const fetchLessons = async (supabase: SupabaseClient): Promise<LessonRecord[]> => {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, module_id, attribution_block');

  if (error) {
    throw new Error(`Failed to fetch lessons: ${error.message}`);
  }

  return (data ?? []) as LessonRecord[];
};

const auditAssets = async (assets: AssetRecord[]): Promise<AuditIssue[]> => {
  const issues: AuditIssue[] = [];
  const urlStatuses = await checkUrls(assets);

  for (const asset of assets) {
    const normalizedLicense = normalizeLicense(asset.license);
    if (!isAllowedLicense(normalizedLicense)) {
      issues.push({
        asset_id: asset.id,
        lesson_id: null,
        module_id: asset.module_id,
        issue: 'invalid_license',
        url: asset.url,
        details: `License "${asset.license}" is not whitelisted`,
      });
    }

    if (!asset.license_url || asset.license_url.trim().length === 0) {
      issues.push({
        asset_id: asset.id,
        lesson_id: null,
        module_id: asset.module_id,
        issue: 'missing_license_url',
        url: asset.url,
        details: 'Missing license_url',
      });
    }

    if (!asset.attribution_text || asset.attribution_text.trim().length === 0) {
      issues.push({
        asset_id: asset.id,
        lesson_id: null,
        module_id: asset.module_id,
        issue: 'missing_attribution',
        url: asset.url,
        details: 'Missing attribution_text',
      });
    }

    const status = urlStatuses.get(asset.url.trim());
    if (status && !status.ok) {
      issues.push({
        asset_id: asset.id,
        lesson_id: null,
        module_id: asset.module_id,
        issue: 'dead_url',
        url: asset.url,
        details: status.status ? `HTTP ${status.status}` : 'Request failed',
      });
    }
  }

  return issues;
};

const extractLessonLicenses = (segments: string[]): string[] => {
  const results = new Set<string>();
  for (const segment of segments) {
    const bracketMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(segment);
    if (bracketMatch?.[1]) {
      results.add(bracketMatch[1].trim());
    }

    const parts = segment.split('·');
    for (const part of parts) {
      const candidate = part.trim();
      if (candidate.length === 0) {
        continue;
      }
      if (isAllowedLicense(candidate) || isAllowedLicense(normalizeLicense(candidate))) {
        results.add(candidate);
      }
    }
  }
  return Array.from(results);
};

const auditLessons = (lessons: LessonRecord[]): AuditIssue[] => {
  const issues: AuditIssue[] = [];

  for (const lesson of lessons) {
    const segments = splitAttributionBlock(lesson.attribution_block);
    if (segments.length === 0) {
      issues.push({
        asset_id: null,
        lesson_id: lesson.id,
        module_id: lesson.module_id,
        issue: 'lesson_missing_attribution',
        url: null,
        details: 'Lesson is missing attribution_block content.',
      });
      continue;
    }

    const licenses = extractLessonLicenses(segments);
    const hasAllowedLicense = licenses.some((license) => isAllowedLicense(normalizeLicense(license)));

    if (!hasAllowedLicense) {
      const detail = licenses.length
        ? `Unapproved license tokens found: ${licenses.join(', ')}`
        : 'No recognizable license token found in attribution block.';

      issues.push({
        asset_id: null,
        lesson_id: lesson.id,
        module_id: lesson.module_id,
        issue: 'lesson_invalid_license',
        url: null,
        details: detail,
      });
    }
  }

  return issues;
};

const main = async () => {
  const supabase = createServiceRoleClient();
  const assets = await fetchAssets(supabase);
  const lessons = await fetchLessons(supabase);
  if (assets.length === 0) {
    console.log('No assets found.');
  }

  const [assetIssues, lessonIssues] = await Promise.all([
    auditAssets(assets),
    Promise.resolve(auditLessons(lessons)),
  ]);
  const issues = [...assetIssues, ...lessonIssues];

  console.log(['asset_id', 'lesson_id', 'module_id', 'issue', 'url', 'details'].map(escapeCsv).join(','));
  for (const issue of issues) {
    console.log([
      escapeCsv(issue.asset_id),
      escapeCsv(issue.lesson_id),
      escapeCsv(issue.module_id),
      escapeCsv(issue.issue),
      escapeCsv(issue.url),
      escapeCsv(issue.details),
    ].join(','));
  }

  console.error(`Audit complete: ${issues.length === 0 ? 'No issues detected.' : `${issues.length} issues found.`}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
