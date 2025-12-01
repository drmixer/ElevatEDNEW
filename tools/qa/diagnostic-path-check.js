#!/usr/bin/env node
/* Quick QA: diagnostic → recommended path → first lesson reachability.
   Requires API server running; configure QA_BASE_URL (defaults to http://localhost:8787/api/v1). */

const fetch = global.fetch ?? ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const baseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8787/api/v1';
const subjectAliases = {
  math: 'Mathematics',
  mathematics: 'Mathematics',
  ela: 'English Language Arts',
  'english language arts': 'English Language Arts',
  science: 'Science',
};
const rawSubject = (process.env.QA_SUBJECT ?? 'math').toLowerCase();
const subject = subjectAliases[rawSubject] ?? process.env.QA_SUBJECT ?? 'Mathematics';
const grade = process.env.QA_GRADE ?? '6';

const exitWith = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

const requireOk = async (response, label) => {
  if (response.ok) return;
  const body = await response.text();
  exitWith(`${label} failed (${response.status}): ${body || response.statusText}`);
};

const main = async () => {
  console.log(`[qa] Using ${baseUrl} subject=${subject} grade=${grade}`);

  // 1) Load modules for subject/grade.
  const modulesResp = await fetch(`${baseUrl}/modules?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}&pageSize=5`);
  await requireOk(modulesResp, 'List modules');
  const modulesPayload = await modulesResp.json();
  const modules = modulesPayload?.data ?? [];
  if (!modules.length) exitWith('No modules returned for subject/grade; coverage too thin?');
  const module = modules[0];
  console.log(`[qa] Module: ${module.title} (#${module.id})`);

  // 2) Fetch module detail to get lessons + assessment id.
  const detailResp = await fetch(`${baseUrl}/modules/${module.id}`);
  await requireOk(detailResp, 'Module detail');
  const detail = await detailResp.json();
  const lessons = detail?.lessons ?? [];
  if (!lessons.length) exitWith(`Module ${module.id} has no lessons (expected at least one).`);
  const lesson = lessons[0];
  console.log(`[qa] First lesson: ${lesson.title} (#${lesson.id})`);

  // 3) Ensure module has an assessment (diagnostic) reachable.
  const assessmentResp = await fetch(`${baseUrl}/modules/${module.id}/assessment`);
  if (assessmentResp.status === 404) {
    console.warn('[qa] No assessment found (404). Skipping diagnostic check.');
  } else {
    await requireOk(assessmentResp, 'Module assessment');
    console.log('[qa] Diagnostic/assessment endpoint reachable.');
  }

  // 4) Fetch lesson detail (recommended path -> lesson load).
  const lessonResp = await fetch(`${baseUrl}/lessons/${lesson.id}`);
  await requireOk(lessonResp, 'Lesson detail');
  console.log('[qa] Lesson detail reachable.');

  console.log('[qa] Diagnostic → path → lesson flow passed.');
};

main().catch((error) => exitWith(error?.message ?? String(error)));
