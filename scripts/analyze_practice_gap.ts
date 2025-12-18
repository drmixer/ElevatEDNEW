/**
 * Analyze Practice Question Coverage Gap
 * 
 * This script analyzes:
 * 1. What practice questions exist in authored files
 * 2. What's already seeded in the database
 * 3. What gaps remain (lessons without practice)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PracticeQuestion {
    prompt: string;
    type: string;
    difficulty: number;
    options: Array<{
        text: string;
        isCorrect: boolean;
        feedback?: string;
    }>;
}

async function analyzeAuthoredFiles(): Promise<{
    totalQuestions: number;
    realQuestions: number;
    placeholderQuestions: number;
    modulesCovered: string[];
}> {
    const practiceDir = './data/practice';
    const files = fs.readdirSync(practiceDir).filter(f => f.endsWith('.json'));

    let totalQuestions = 0;
    let realQuestions = 0;
    let placeholderQuestions = 0;
    const modulesCovered = new Set<string>();

    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(practiceDir, file), 'utf-8'));

            // Handle object structure (keyed by module slug)
            if (typeof data === 'object' && !Array.isArray(data)) {
                for (const [moduleSlug, questions] of Object.entries(data)) {
                    if (Array.isArray(questions)) {
                        totalQuestions += questions.length;
                        modulesCovered.add(moduleSlug);

                        for (const q of questions as PracticeQuestion[]) {
                            const isPlaceholder =
                                q.prompt?.includes('Practice Item') ||
                                q.options?.some(o => o.text === 'Correct answer' || o.text === 'Incorrect answer A');

                            if (isPlaceholder) {
                                placeholderQuestions++;
                            } else {
                                realQuestions++;
                            }
                        }
                    }
                }
            }
            // Handle array structure
            else if (Array.isArray(data)) {
                for (const item of data) {
                    totalQuestions++;
                    if (item.moduleSlug) {
                        modulesCovered.add(item.moduleSlug);
                    }

                    const isPlaceholder =
                        item.prompt?.includes('Practice Item') ||
                        item.options?.some((o: { text: string }) => o.text === 'Correct answer');

                    if (isPlaceholder) {
                        placeholderQuestions++;
                    } else {
                        realQuestions++;
                    }
                }
            }
        } catch (e) {
            console.log(`Error reading ${file}:`, e);
        }
    }

    return {
        totalQuestions,
        realQuestions,
        placeholderQuestions,
        modulesCovered: Array.from(modulesCovered)
    };
}

async function analyzeDatabase(): Promise<{
    lessonsWithPractice: number;
    lessonsWithoutPractice: number;
    totalQuestions: number;
    totalSkills: number;
    lessonSkillLinks: number;
}> {
    // Get lessons with skills linked
    const { data: lessonSkills, error: lsError } = await supabase
        .from('lesson_skills')
        .select('lesson_id, skill_id');

    if (lsError) {
        console.error('Error fetching lesson_skills:', lsError);
        return { lessonsWithPractice: 0, lessonsWithoutPractice: 0, totalQuestions: 0, totalSkills: 0, lessonSkillLinks: 0 };
    }

    const lessonsWithSkills = new Set(lessonSkills?.map(ls => ls.lesson_id) || []);

    // Get total lessons
    const { count: totalLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true });

    // Get total questions
    const { count: totalQuestions } = await supabase
        .from('question_bank')
        .select('id', { count: 'exact', head: true });

    // Get total skills
    const { count: totalSkills } = await supabase
        .from('skills')
        .select('id', { count: 'exact', head: true });

    return {
        lessonsWithPractice: lessonsWithSkills.size,
        lessonsWithoutPractice: (totalLessons || 0) - lessonsWithSkills.size,
        totalQuestions: totalQuestions || 0,
        totalSkills: totalSkills || 0,
        lessonSkillLinks: lessonSkills?.length || 0
    };
}

async function getSubjectDistribution(): Promise<Map<string, { total: number; withPractice: number }>> {
    // Get all lessons with their modules and subjects
    const { data: lessons } = await supabase
        .from('lessons')
        .select(`
      id,
      module:module_id (
        id,
        subject:subject_id (name)
      )
    `);

    // Get lessons with skills
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id');

    const lessonsWithSkills = new Set(lessonSkills?.map(ls => ls.lesson_id) || []);

    const subjectStats = new Map<string, { total: number; withPractice: number }>();

    for (const lesson of lessons || []) {
        const subjectName = (lesson.module as { subject?: { name?: string } })?.subject?.name || 'Unknown';

        if (!subjectStats.has(subjectName)) {
            subjectStats.set(subjectName, { total: 0, withPractice: 0 });
        }

        const stats = subjectStats.get(subjectName)!;
        stats.total++;
        if (lessonsWithSkills.has(lesson.id)) {
            stats.withPractice++;
        }
    }

    return subjectStats;
}

async function getLessonsNeedingPractice(): Promise<Array<{
    id: number;
    title: string;
    moduleSlug: string;
    subject: string;
    gradeBand: string;
}>> {
    // Get all lessons
    const { data: allLessons } = await supabase
        .from('lessons')
        .select(`
      id,
      title,
      module:module_id (
        slug,
        grade_band,
        subject:subject_id (name)
      )
    `);

    // Get lessons that have skills linked
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id');

    const lessonsWithSkills = new Set(lessonSkills?.map(ls => ls.lesson_id) || []);

    const needsPractice = (allLessons || [])
        .filter(l => !lessonsWithSkills.has(l.id))
        .map(l => ({
            id: l.id,
            title: l.title,
            moduleSlug: (l.module as { slug?: string })?.slug || '',
            subject: (l.module as { subject?: { name?: string } })?.subject?.name || 'Unknown',
            gradeBand: (l.module as { grade_band?: string })?.grade_band || ''
        }));

    return needsPractice;
}

async function main() {
    console.log('='.repeat(60));
    console.log('PRACTICE QUESTION COVERAGE ANALYSIS');
    console.log('='.repeat(60));
    console.log();

    // Analyze authored files
    console.log('📁 AUTHORED PRACTICE FILES');
    console.log('-'.repeat(40));
    const fileAnalysis = await analyzeAuthoredFiles();
    console.log(`Total questions in files: ${fileAnalysis.totalQuestions}`);
    console.log(`  Real questions: ${fileAnalysis.realQuestions}`);
    console.log(`  Placeholder questions: ${fileAnalysis.placeholderQuestions}`);
    console.log(`Modules covered by files: ${fileAnalysis.modulesCovered.length}`);
    console.log();

    // Analyze database
    console.log('🗄️  DATABASE STATE');
    console.log('-'.repeat(40));
    const dbAnalysis = await analyzeDatabase();
    console.log(`Total lessons: ${dbAnalysis.lessonsWithPractice + dbAnalysis.lessonsWithoutPractice}`);
    console.log(`Lessons WITH practice: ${dbAnalysis.lessonsWithPractice} (${((dbAnalysis.lessonsWithPractice / (dbAnalysis.lessonsWithPractice + dbAnalysis.lessonsWithoutPractice)) * 100).toFixed(1)}%)`);
    console.log(`Lessons WITHOUT practice: ${dbAnalysis.lessonsWithoutPractice} (${((dbAnalysis.lessonsWithoutPractice / (dbAnalysis.lessonsWithPractice + dbAnalysis.lessonsWithoutPractice)) * 100).toFixed(1)}%)`);
    console.log(`Total questions in DB: ${dbAnalysis.totalQuestions}`);
    console.log(`Total skills: ${dbAnalysis.totalSkills}`);
    console.log(`Lesson-skill links: ${dbAnalysis.lessonSkillLinks}`);
    console.log();

    // Subject distribution
    console.log('📊 COVERAGE BY SUBJECT');
    console.log('-'.repeat(40));
    const subjectStats = await getSubjectDistribution();
    for (const [subject, stats] of Array.from(subjectStats.entries()).sort((a, b) => b[1].total - a[1].total)) {
        const pct = ((stats.withPractice / stats.total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(stats.withPractice / stats.total * 20)) + '░'.repeat(20 - Math.round(stats.withPractice / stats.total * 20));
        console.log(`${subject.padEnd(25)} ${bar} ${stats.withPractice}/${stats.total} (${pct}%)`);
    }
    console.log();

    // Get some sample lessons needing practice
    console.log('📝 SAMPLE LESSONS NEEDING PRACTICE');
    console.log('-'.repeat(40));
    const needsPractice = await getLessonsNeedingPractice();

    // Group by subject for sampling
    const bySubject = new Map<string, typeof needsPractice>();
    for (const lesson of needsPractice) {
        if (!bySubject.has(lesson.subject)) {
            bySubject.set(lesson.subject, []);
        }
        bySubject.get(lesson.subject)!.push(lesson);
    }

    // Show 3 from each subject
    for (const [subject, lessons] of bySubject) {
        console.log(`\n${subject}:`);
        for (const lesson of lessons.slice(0, 3)) {
            console.log(`  - [${lesson.gradeBand}] ${lesson.title}`);
        }
        if (lessons.length > 3) {
            console.log(`  ... and ${lessons.length - 3} more`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(60));

    const needsGeneration = dbAnalysis.lessonsWithoutPractice;
    const avgQuestionsPerLesson = 4;
    const totalQuestionsNeeded = needsGeneration * avgQuestionsPerLesson;

    console.log(`\n1. Generate ${totalQuestionsNeeded} practice questions for ${needsGeneration} lessons`);
    console.log(`2. Prioritize by subject (largest gaps first):`);

    const sortedSubjects = Array.from(subjectStats.entries())
        .map(([name, stats]) => ({ name, gap: stats.total - stats.withPractice }))
        .sort((a, b) => b.gap - a.gap);

    for (const { name, gap } of sortedSubjects.slice(0, 5)) {
        console.log(`   - ${name}: ${gap} lessons need questions`);
    }

    // Save the list of lessons needing practice
    const outputPath = './data/audits/lessons_needing_practice.json';
    fs.writeFileSync(outputPath, JSON.stringify(needsPractice, null, 2));
    console.log(`\n✅ Full list saved to: ${outputPath}`);
}

main().catch(console.error);
