import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
  auth: { persistSession: false },
});

const GRADES = ['3','4','5','6','7','8'];
const SUBJECT = 'Science';
const quizFile = 'data/assessments/science_module_quizzes_authored.json';
const practiceFile = 'data/practice/science_authored_practice_items.json';
const lessonsFile = 'data/lessons/science_authored_launch_lessons.json';

const readJson = async (p: string) => JSON.parse(await fs.readFile(p, 'utf8')) as Record<string, unknown>;

const validateQuizzes = (data: Record<string, any>): string[] => {
  const issues: string[] = [];
  for (const [slug, quiz] of Object.entries<any>(data)) {
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length < 6) {
      issues.push(`${slug}: needs >=6 questions`);
      continue;
    }
    quiz.questions.forEach((q: any, idx: number) => {
      const pre = `${slug} q${idx + 1}`;
      if (!q.id || !q.prompt || !q.type || !['multiple_choice', 'short_answer'].includes(q.type)) issues.push(`${pre}: missing id/prompt/type`);
      if (![1, 2, 3].includes(q.difficulty)) issues.push(`${pre}: difficulty invalid`);
      if (!Array.isArray(q.standards) || q.standards.length === 0) issues.push(`${pre}: missing standards`);
      if (q.type === 'multiple_choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          issues.push(`${pre}: needs >=2 options`);
        } else {
          const correct = q.options.filter((o: any) => o.isCorrect === true);
          if (correct.length === 0) issues.push(`${pre}: no correct option`);
          q.options.forEach((o: any, oi: number) => { if (!o.text) issues.push(`${pre} opt${oi + 1}: missing text`); });
        }
      }
    });
  }
  return issues;
};

const validatePractice = (data: Record<string, any>): string[] => {
  const issues: string[] = [];
  for (const [slug, items] of Object.entries<any>(data)) {
    if (!Array.isArray(items)) { issues.push(`${slug}: not array`); continue; }
    if (items.length !== 12) issues.push(`${slug}: needs 12 items (has ${items.length})`);
    items.forEach((it: any, idx: number) => {
      const pre = `${slug} item${idx + 1}`;
      if (!it.prompt || it.type !== 'multiple_choice') issues.push(`${pre}: missing prompt/type`);
      if (![1, 2, 3].includes(it.difficulty)) issues.push(`${pre}: difficulty invalid`);
      if (!Array.isArray(it.standards) || it.standards.length === 0) issues.push(`${pre}: missing standards`);
      if (!Array.isArray(it.options) || it.options.length < 2) {
        issues.push(`${pre}: needs >=2 options`);
      } else {
        const correct = it.options.filter((o: any) => o.isCorrect === true);
        if (correct.length === 0) issues.push(`${pre}: no correct option`);
        it.options.forEach((o: any, oi: number) => { if (!o.text) issues.push(`${pre} opt${oi + 1}: missing text`); });
      }
    });
  }
  return issues;
};

const validateLessons = (data: Record<string, any>): string[] => {
  const issues: string[] = [];
  const req = ['hook','direct_instruction','guided_practice','independent_practice','check_for_understanding','exit_ticket','materials'];
  for (const [slug, lesson] of Object.entries<any>(data)) {
    if (!lesson.title || !lesson.summary || !Array.isArray(lesson.objectives) || lesson.objectives.length === 0) issues.push(`${slug}: missing title/summary/objectives`);
    if (!lesson.grade_band || !lesson.subject) issues.push(`${slug}: missing grade_band/subject`);
    if (!Array.isArray(lesson.standards) || lesson.standards.length === 0) issues.push(`${slug}: missing standards`);
    if (!lesson.outline) { issues.push(`${slug}: missing outline`); continue; }
    for (const k of req) { if (!(k in lesson.outline)) issues.push(`${slug}: outline missing ${k}`); }
  }
  return issues;
};

const logIssues = (label: string, arr: string[]) => {
  if (arr.length === 0) { console.log(`${label}: OK`); return; }
  console.log(`${label}: ${arr.length} issues`);
  arr.slice(0, 20).forEach((i) => console.log(`  - ${i}`));
  if (arr.length > 20) console.log(`  ...and ${arr.length - 20} more`);
};

const main = async () => {
  console.log('=== Science ===');
  const { data: modules, error } = await supabase.from('modules').select('slug,subject,grade_band').eq('subject', SUBJECT).in('grade_band', GRADES);
  if (error) throw error;
  const moduleSlugs = new Set((modules ?? []).map((m) => m.slug as string));
  console.log(`DB modules (grade 3-8): ${moduleSlugs.size}`);

  const quiz = await readJson(quizFile);
  const practice = await readJson(practiceFile);
  const lessons = await readJson(lessonsFile);

  const qSlugs = new Set(Object.keys(quiz));
  const pSlugs = new Set(Object.keys(practice));
  const lSlugs = new Set(Object.keys(lessons));

  const missing = (set: Set<string>) => [...moduleSlugs].filter((s) => !set.has(s));
  const extra = (set: Set<string>) => [...set].filter((s) => !moduleSlugs.has(s));

  const mQ = missing(qSlugs); const mP = missing(pSlugs); const mL = missing(lSlugs);
  const eQ = extra(qSlugs); const eP = extra(pSlugs); const eL = extra(lSlugs);

  console.log(`Files coverage -> quiz ${qSlugs.size}, practice ${pSlugs.size}, lessons ${lSlugs.size}`);
  if (mQ.length) console.log(`Missing quiz modules (${mQ.length}): ${mQ.join(', ')}`);
  if (mP.length) console.log(`Missing practice modules (${mP.length}): ${mP.join(', ')}`);
  if (mL.length) console.log(`Missing lesson modules (${mL.length}): ${mL.join(', ')}`);
  if (eQ.length) console.log(`Extra quiz modules (${eQ.length}): ${eQ.join(', ')}`);
  if (eP.length) console.log(`Extra practice modules (${eP.length}): ${eP.join(', ')}`);
  if (eL.length) console.log(`Extra lesson modules (${eL.length}): ${eL.join(', ')}`);

  logIssues('Quiz checks', validateQuizzes(quiz));
  logIssues('Practice checks', validatePractice(practice));
  logIssues('Lesson checks', validateLessons(lessons));
};

main().catch((err) => { console.error(err); process.exit(1); });
