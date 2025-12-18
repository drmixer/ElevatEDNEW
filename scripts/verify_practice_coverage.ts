/**
 * Verify practice question coverage - final check
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('='.repeat(60));
    console.log('FINAL PRACTICE QUESTION COVERAGE VERIFICATION');
    console.log('='.repeat(60));
    console.log();

    // Get total lessons
    const { count: totalLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true });

    // Get unique lessons with skills linked - must paginate due to Supabase 1000 row limit
    const allLessonSkills: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data: batch } = await supabase
            .from('lesson_skills')
            .select('lesson_id')
            .range(offset, offset + batchSize - 1);

        if (!batch || batch.length === 0) break;
        allLessonSkills.push(...batch);
        if (batch.length < batchSize) break;
        offset += batchSize;
    }

    const uniqueLessonsWithSkills = new Set(allLessonSkills.map(ls => ls.lesson_id));

    // Get total questions
    const { count: totalQuestions } = await supabase
        .from('question_bank')
        .select('id', { count: 'exact', head: true });

    // Get total skills
    const { count: totalSkills } = await supabase
        .from('skills')
        .select('id', { count: 'exact', head: true });

    // Get lesson-skill link count
    const { count: lessonSkillCount } = await supabase
        .from('lesson_skills')
        .select('*', { count: 'exact', head: true });

    const coverage = ((uniqueLessonsWithSkills.size / (totalLessons || 1)) * 100).toFixed(1);

    console.log('📊 COVERAGE METRICS');
    console.log('-'.repeat(40));
    console.log(`Total lessons:               ${totalLessons}`);
    console.log(`Lessons WITH practice:       ${uniqueLessonsWithSkills.size} (${coverage}%)`);
    console.log(`Lessons WITHOUT practice:    ${(totalLessons || 0) - uniqueLessonsWithSkills.size}`);
    console.log();
    console.log('📋 DATABASE COUNTS');
    console.log('-'.repeat(40));
    console.log(`Total questions in DB:       ${totalQuestions}`);
    console.log(`Total skills:                ${totalSkills}`);
    console.log(`Lesson-skill links:          ${lessonSkillCount}`);
    console.log();

    // Calculate improvement
    const previousCoverage = 190; // From handoff
    const previousQuestions = 20561; // From earlier check

    console.log('📈 IMPROVEMENT');
    console.log('-'.repeat(40));
    console.log(`Lessons covered:  ${previousCoverage} → ${uniqueLessonsWithSkills.size} (+${uniqueLessonsWithSkills.size - previousCoverage})`);
    console.log(`Coverage:         16% → ${coverage}%`);
    console.log(`Questions added:  ${(totalQuestions || 0) - previousQuestions}`);
    console.log();

    if (uniqueLessonsWithSkills.size === totalLessons) {
        console.log('✅ 100% COVERAGE ACHIEVED!');
    } else {
        console.log(`⚠️  ${(totalLessons || 0) - uniqueLessonsWithSkills.size} lessons still need practice questions`);
    }
}

main().catch(console.error);
