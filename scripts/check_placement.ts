import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkPlacementAssessments() {
    console.log('Checking for placement assessments...\n');

    // Get standalone assessments (module_id = null)
    const { data: standaloneAssessments, error } = await supabase
        .from('assessments')
        .select('id, title, module_id, metadata')
        .is('module_id', null)
        .limit(50);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${standaloneAssessments?.length || 0} standalone assessments (module_id = null)\n`);

    if (!standaloneAssessments || standaloneAssessments.length === 0) {
        console.log('❌ NO STANDALONE ASSESSMENTS FOUND!');
        console.log('This means placement assessments cannot work.\n');
        return;
    }

    // Check which have placement/diagnostic purpose
    let placementCount = 0;
    let diagnosticCount = 0;
    let otherCount = 0;

    console.log('Standalone assessments:');
    for (const a of standaloneAssessments) {
        const meta = a.metadata as Record<string, unknown> | null;
        const purpose = (meta?.purpose || meta?.type || meta?.kind || 'unknown') as string;
        const gradeBand = meta?.grade_band || meta?.gradeBand || meta?.grade || 'none';
        const subjectKey = meta?.subject_key || meta?.subjectKey || 'mixed';

        if (purpose.toLowerCase() === 'placement') {
            placementCount++;
        } else if (purpose.toLowerCase() === 'diagnostic') {
            diagnosticCount++;
        } else {
            otherCount++;
        }

        console.log(`  ID ${a.id}: ${a.title?.substring(0, 50) || 'no title'}`);
        console.log(`    Purpose: ${purpose}, Grade Band: ${gradeBand}, Subject: ${subjectKey}`);
    }

    console.log(`\nSummary:`);
    console.log(`  - Placement: ${placementCount}`);
    console.log(`  - Diagnostic: ${diagnosticCount}`);
    console.log(`  - Other/Unknown: ${otherCount}`);

    if (placementCount === 0 && diagnosticCount === 0) {
        console.log(`\n❌ NO PLACEMENT OR DIAGNOSTIC ASSESSMENTS!`);
        console.log(`Students cannot complete onboarding assessment.`);
    }
}

checkPlacementAssessments().catch(console.error);
