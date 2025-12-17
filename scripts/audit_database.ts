import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface AuditResult {
    table: string;
    count: number;
    issues: string[];
}

async function auditDatabase() {
    console.log('='.repeat(60));
    console.log('ElevatED Platform Data Integrity Audit');
    console.log('='.repeat(60));
    console.log('');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _results: AuditResult[] = [];

    // 1. Core user tables
    console.log('📊 USER TABLES');
    console.log('-'.repeat(40));

    const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: studentProfilesCount } = await supabase.from('student_profiles').select('*', { count: 'exact', head: true });
    const { count: parentProfilesCount } = await supabase.from('parent_profiles').select('*', { count: 'exact', head: true });
    const { count: adminProfilesCount } = await supabase.from('admin_profiles').select('*', { count: 'exact', head: true });

    console.log(`  profiles: ${profilesCount}`);
    console.log(`  student_profiles: ${studentProfilesCount}`);
    console.log(`  parent_profiles: ${parentProfilesCount}`);
    console.log(`  admin_profiles: ${adminProfilesCount}`);
    console.log('');

    // 2. Content tables
    console.log('📚 CONTENT TABLES');
    console.log('-'.repeat(40));

    const { count: modulesCount } = await supabase.from('modules').select('*', { count: 'exact', head: true });
    const { count: lessonsCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });
    const { count: assessmentsCount } = await supabase.from('assessments').select('*', { count: 'exact', head: true });
    const { count: questionsCount } = await supabase.from('assessment_questions').select('*', { count: 'exact', head: true });
    const { count: sequencesCount } = await supabase.from('learning_sequences').select('*', { count: 'exact', head: true });

    console.log(`  modules: ${modulesCount}`);
    console.log(`  lessons: ${lessonsCount}`);
    console.log(`  assessments: ${assessmentsCount}`);
    console.log(`  assessment_questions: ${questionsCount}`);
    console.log(`  learning_sequences: ${sequencesCount}`);
    console.log('');

    // 3. Student progress tables
    console.log('📈 PROGRESS TABLES');
    console.log('-'.repeat(40));

    const { count: pathsCount } = await supabase.from('student_paths').select('*', { count: 'exact', head: true });
    const { count: entriesCount } = await supabase.from('student_path_entries').select('*', { count: 'exact', head: true });
    const { count: eventsCount } = await supabase.from('student_events').select('*', { count: 'exact', head: true });

    console.log(`  student_paths: ${pathsCount}`);
    console.log(`  student_path_entries: ${entriesCount}`);
    console.log(`  student_events: ${eventsCount}`);
    console.log('');

    // 4. Check grade band consistency
    console.log('🔍 DATA CONSISTENCY CHECKS');
    console.log('-'.repeat(40));

    // Check modules grade_band values
    const { data: moduleGradeBands } = await supabase
        .from('modules')
        .select('grade_band')
        .order('grade_band');

    const moduleBandCounts = new Map<string, number>();
    moduleGradeBands?.forEach(m => {
        moduleBandCounts.set(m.grade_band, (moduleBandCounts.get(m.grade_band) || 0) + 1);
    });

    console.log('  Module grade_band values:');
    for (const [band, count] of moduleBandCounts) {
        console.log(`    ${band}: ${count} modules`);
    }
    console.log('');

    // Check student_profiles grade_band values
    const { data: studentGradeBands } = await supabase
        .from('student_profiles')
        .select('grade_band, grade');

    const studentBandCounts = new Map<string, number>();
    studentGradeBands?.forEach(s => {
        const key = `${s.grade_band} (grade ${s.grade})`;
        studentBandCounts.set(key, (studentBandCounts.get(key) || 0) + 1);
    });

    console.log('  Student grade_band values:');
    for (const [band, count] of studentBandCounts) {
        console.log(`    ${band}: ${count} students`);
    }
    console.log('');

    // Check assessments coverage
    const { data: assessmentBands } = await supabase
        .from('assessments')
        .select('grade_band, name, id');

    console.log('  Assessments by grade_band:');
    assessmentBands?.forEach(a => {
        console.log(`    ${a.grade_band}: ${a.name}`);
    });
    console.log('');

    // Check if assessments have questions
    const { data: assessmentQuestionCounts } = await supabase
        .from('assessment_questions')
        .select('assessment_id');

    const questionsByAssessment = new Map<number, number>();
    assessmentQuestionCounts?.forEach(q => {
        questionsByAssessment.set(q.assessment_id, (questionsByAssessment.get(q.assessment_id) || 0) + 1);
    });

    console.log('  Questions per assessment:');
    for (const [id, count] of questionsByAssessment) {
        const assessment = assessmentBands?.find(a => a.id === id);
        console.log(`    Assessment ${id} (${assessment?.grade_band || 'unknown'}): ${count} questions`);
    }
    console.log('');

    // 5. Check for orphaned data
    console.log('🚨 POTENTIAL ISSUES');
    console.log('-'.repeat(40));

    // Students without paths
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: _studentsWithoutPaths } = await supabase
        .from('student_profiles')
        .select('id, first_name, last_name, grade')
        .not('id', 'in',
            supabase.from('student_paths').select('student_id')
        );

    // This doesn't work with Supabase, let's do it differently
    const { data: allStudents } = await supabase.from('student_profiles').select('id, first_name, last_name, grade');
    const { data: allPaths } = await supabase.from('student_paths').select('student_id');

    const studentIdsWithPaths = new Set(allPaths?.map(p => p.student_id) || []);
    const studentsNoPath = allStudents?.filter(s => !studentIdsWithPaths.has(s.id)) || [];

    if (studentsNoPath.length > 0) {
        console.log(`  ⚠️ Students without learning paths: ${studentsNoPath.length}`);
        studentsNoPath.slice(0, 5).forEach(s => {
            console.log(`     - ${s.first_name} ${s.last_name} (grade ${s.grade})`);
        });
        if (studentsNoPath.length > 5) {
            console.log(`     ... and ${studentsNoPath.length - 5} more`);
        }
    } else {
        console.log('  ✅ All students have learning paths');
    }
    console.log('');

    // Modules without lessons
    const { data: allModules } = await supabase.from('modules').select('id, title');
    const { data: allLessons } = await supabase.from('lessons').select('module_id');

    const moduleIdsWithLessons = new Set(allLessons?.map(l => l.module_id) || []);
    const modulesNoLessons = allModules?.filter(m => !moduleIdsWithLessons.has(m.id)) || [];

    if (modulesNoLessons.length > 0) {
        console.log(`  ⚠️ Modules without lessons: ${modulesNoLessons.length}`);
        modulesNoLessons.slice(0, 5).forEach(m => {
            console.log(`     - ${m.title}`);
        });
    } else {
        console.log('  ✅ All modules have lessons');
    }
    console.log('');

    // Empty learning_sequences
    if (sequencesCount === 0) {
        console.log('  ⚠️ learning_sequences table is EMPTY');
        console.log('     This means path generation falls back to direct module queries');
    } else {
        console.log(`  ✅ learning_sequences has ${sequencesCount} entries`);
    }
    console.log('');

    // 6. Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Users: ${profilesCount}`);
    console.log(`  - Students: ${studentProfilesCount}`);
    console.log(`  - Parents: ${parentProfilesCount}`);
    console.log(`  - Admins: ${adminProfilesCount}`);
    console.log(`Total Content: ${modulesCount} modules, ${lessonsCount} lessons`);
    console.log(`Assessments: ${assessmentsCount} (${questionsCount} questions total)`);
    console.log(`Learning Paths: ${pathsCount} paths, ${entriesCount} entries`);
    console.log('');
}

auditDatabase().catch(console.error);
