#!/usr/bin/env node
/* Coverage sanity check: validates minimum modules and diagnostics per grade/subject. */
import { readFileSync } from 'node:fs';

const fetch = global.fetch ?? ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const baseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8787/api/v1';
const configPath = process.env.COVERAGE_CONFIG ?? 'tools/content/minimum-coverage.json';

const config = JSON.parse(readFileSync(configPath, 'utf8'));

const subjectAliases = {
  math: 'Mathematics',
  mathematics: 'Mathematics',
  ela: 'English Language Arts',
  'english language arts': 'English Language Arts',
  science: 'Science',
};
const requireDiagnostic = process.env.REQUIRE_DIAGNOSTIC === 'true';

const exitWith = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

const requireOk = async (resp, label) => {
  if (resp.ok) return;
  const body = await resp.text();
  exitWith(`${label} failed (${resp.status}): ${body || resp.statusText}`);
};

const listAllModules = async (subject, grade) => {
  const pageSize = 50; // API cap
  let page = 1;
  const modules = [];

  while (true) {
    const resp = await fetch(
      `${baseUrl}/modules?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(
        grade,
      )}&pageSize=${pageSize}&page=${page}`,
    );
    await requireOk(resp, `list modules ${subject} grade ${grade} page ${page}`);
    const payload = await resp.json();
    const batch = payload?.data ?? [];
    modules.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
  }

  return modules;
};

const countModules = async (subject, grade) => {
  const modules = await listAllModules(subject, grade);
  return modules.length;
};

const findDiagnostic = async (subject, grade) => {
  const modules = await listAllModules(subject, grade);
  for (const module of modules) {
    const detailResp = await fetch(`${baseUrl}/modules/${module.id}/assessment`);
    if (detailResp.status === 200) {
      return true;
    }
  }
  return false;
};

const main = async () => {
  const failures = [];
  const warnings = [];
  for (const [rawSubject, grades] of Object.entries(config)) {
    const subject = subjectAliases[rawSubject.toLowerCase()] ?? rawSubject;
    for (const [grade, thresholds] of Object.entries(grades)) {
      const moduleCount = await countModules(subject, grade);
      if (moduleCount < thresholds.minModules) {
        failures.push(`${subject} grade ${grade}: ${moduleCount} modules < min ${thresholds.minModules}`);
      }
      const hasDiagnostic = await findDiagnostic(subject, grade);
      if (!hasDiagnostic) {
        if (requireDiagnostic) {
          failures.push(`${subject} grade ${grade}: no diagnostic assessment reachable`);
        } else {
          warnings.push(`${subject} grade ${grade}: no diagnostic assessment reachable`);
        }
      }
    }
  }
  if (failures.length) {
    exitWith(`Coverage gaps:\n- ${failures.join('\n- ')}`);
  }
  if (warnings.length) {
    console.warn(`Warnings (diagnostic missing, tolerated):\n- ${warnings.join('\n- ')}`);
  }
  console.log('[qa] Coverage checks passed for all configured grades/subjects.');
};

main().catch((error) => exitWith(error?.message ?? String(error)));
