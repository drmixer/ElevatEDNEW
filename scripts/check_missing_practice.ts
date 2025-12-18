/**
 * Check Missing Practice Questions
 * 
 * Investigates the 34 lessons flagged as "missing practice" to determine
 * if they truly need questions generated.
 */

import 'dotenv/config';
import * as fs from 'fs';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

async function checkMissingPractice() {
    console.log('=== CHECK MISSING PRACTICE ===\n');

    // Get lesson IDs from the audit
    const report = JSON.parse(fs.readFileSync('data/audits/content_quality_report.json', 'utf-8'));
    const practiceIssues = report.issues.filter((i: any) => i.issueType === 'missing_practice');
    const lessonIds = practiceIssues.map((i: any) => i.lessonId);

    console.log(`Checking ${lessonIds.length} lessons with missing practice...\n`);

    // Check if these lessons have skills
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id, skill_id')
        .in('lesson_id', lessonIds);

    const lessonSkillMap: Record<number, number[]> = {};
    for (const ls of lessonSkills || []) {
        lessonSkillMap[ls.lesson_id] = lessonSkillMap[ls.lesson_id] || [];
        lessonSkillMap[ls.lesson_id].push(ls.skill_id);
    }

    // Check which skills have questions
    const allSkillIds = [...new Set((lessonSkills || []).map(ls => ls.skill_id))];

    console.log('Total skill links:', (lessonSkills || []).length);
    console.log('Unique skills linked:', allSkillIds.length);

    if (allSkillIds.length > 0) {
        const { data: questionSkills } = await supabase
            .from('question_skills')
            .select('skill_id')
            .in('skill_id', allSkillIds);

        const skillsWithQuestions = new Set((questionSkills || []).map(qs => qs.skill_id));

        console.log('Skills with questions:', skillsWithQuestions.size);
        console.log('Skills WITHOUT questions:', allSkillIds.length - skillsWithQuestions.size);
    }

    // Lessons with no skills at all
    const lessonsWithNoSkills = lessonIds.filter((lid: number) => !lessonSkillMap[lid] || lessonSkillMap[lid].length === 0);
    console.log('\nLessons with NO skills linked:', lessonsWithNoSkills.length);

    // Get lesson titles for context
    if (lessonsWithNoSkills.length > 0 || lessonIds.length <= 10) {
        const { data: lessons } = await supabase
            .from('lessons')
            .select('id, title')
            .in('id', lessonIds.slice(0, 15));

        console.log('\nSample lessons needing questions:');
        for (const lesson of lessons || []) {
            const skillCount = lessonSkillMap[lesson.id]?.length || 0;
            console.log(`  - ${lesson.title} (${skillCount} skills linked)`);
        }
    }

    console.log('\n=== RECOMMENDATION ===');
    console.log('These lessons need practice questions generated.');
    console.log('Run: npx tsx scripts/generate_practice_for_all_lessons.ts');
}

checkMissingPractice().catch(console.error);
