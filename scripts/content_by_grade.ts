import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkContentByGrade() {
    console.log('Content Analysis by Grade Level\n');
    console.log('='.repeat(60));

    // Get all modules with lesson counts
    const { data: modules } = await supabase
        .from('modules')
        .select('id, title, grade_band, subject');

    const { data: lessons } = await supabase
        .from('lessons')
        .select('id, module_id');

    // Count lessons per module
    const lessonCountByModule = new Map<number, number>();
    lessons?.forEach(l => {
        lessonCountByModule.set(l.module_id, (lessonCountByModule.get(l.module_id) || 0) + 1);
    });

    // Group by grade
    const gradeStats = new Map<string, { total: number; withLessons: number; subjects: Set<string> }>();

    modules?.forEach(m => {
        const grade = m.grade_band || 'unknown';
        if (!gradeStats.has(grade)) {
            gradeStats.set(grade, { total: 0, withLessons: 0, subjects: new Set() });
        }
        const stats = gradeStats.get(grade)!;
        stats.total++;
        stats.subjects.add(m.subject);
        if ((lessonCountByModule.get(m.id) || 0) > 0) {
            stats.withLessons++;
        }
    });

    // Sort grades
    const gradeOrder = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const sortedGrades = [...gradeStats.keys()].sort((a, b) => {
        const aIdx = gradeOrder.indexOf(a);
        const bIdx = gradeOrder.indexOf(b);
        if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });

    console.log('\nModules by Grade:');
    console.log('-'.repeat(60));

    for (const grade of sortedGrades) {
        const stats = gradeStats.get(grade)!;
        const pct = Math.round((stats.withLessons / stats.total) * 100);
        const status = stats.withLessons === stats.total ? '✅' :
            stats.withLessons > 0 ? '⚠️' : '❌';
        console.log(`Grade ${grade.padEnd(3)}: ${stats.total.toString().padStart(3)} modules, ${stats.withLessons.toString().padStart(3)} have lessons (${pct}%) ${status}`);
        console.log(`         Subjects: ${[...stats.subjects].join(', ')}`);
    }

    // Placement assessments
    console.log('\n' + '='.repeat(60));
    console.log('Placement Assessments:');
    console.log('-'.repeat(60));

    const { data: placements } = await supabase
        .from('assessments')
        .select('id, title, metadata')
        .is('module_id', null);

    const placementsByBand = new Map<string, { id: number; title: string }[]>();

    placements?.forEach(a => {
        const meta = a.metadata as Record<string, unknown> | null;
        const purpose = String(meta?.purpose || meta?.type || '').toLowerCase();
        if (purpose === 'placement' || purpose === 'diagnostic') {
            const band = String(meta?.grade_band || meta?.gradeBand || 'unknown');
            if (!placementsByBand.has(band)) {
                placementsByBand.set(band, []);
            }
            placementsByBand.get(band)!.push({ id: a.id, title: a.title });
        }
    });

    // Check each grade band
    const bands = [
        { band: 'K-2', grades: ['K', '1', '2'] },
        { band: '3-5', grades: ['3', '4', '5'] },
        { band: '6-8', grades: ['6', '7', '8'] },
        { band: '9-12', grades: ['9', '10', '11', '12'] },
    ];

    for (const { band, grades } of bands) {
        const assessments = placementsByBand.get(band) || [];
        // Also check individual grade assessments
        grades.forEach(g => {
            const gradeAssessments = placementsByBand.get(g) || [];
            gradeAssessments.forEach(a => {
                if (!assessments.find(existing => existing.id === a.id)) {
                    assessments.push(a);
                }
            });
        });

        const status = assessments.length > 0 ? '✅' : '❌';
        console.log(`${band.padEnd(5)}: ${assessments.length} assessments ${status}`);
        assessments.forEach(a => console.log(`       - ${a.title}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDATION:');
    console.log('-'.repeat(60));
    console.log('If grades 3-8 are the target, consider:');
    console.log('1. Removing or hiding K-2, 9-12 grade options from onboarding');
    console.log('2. Or creating placeholder content for those grades');
    console.log('3. The app currently shows all grades K-12 in onboarding');
}

checkContentByGrade().catch(console.error);
