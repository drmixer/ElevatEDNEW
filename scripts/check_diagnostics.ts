/**
 * Debug script to check diagnostic assessments in the database
 */

import 'dotenv/config';
import { createServiceRoleClient } from './utils/supabase.js';

async function main() {
    const supabase = createServiceRoleClient();

    // Get all assessments with "diagnostic" in title
    const { data: diagnostics, error } = await supabase
        .from('assessments')
        .select('id, title, metadata')
        .ilike('title', '%diagnostic%');

    if (error) {
        console.error('Error fetching diagnostics:', error);
        return;
    }

    console.log(`Found ${diagnostics?.length || 0} diagnostic assessments:\n`);

    for (const d of diagnostics || []) {
        const meta = d.metadata as Record<string, unknown> | null;
        console.log(`ID: ${d.id}`);
        console.log(`  Title: ${d.title}`);
        console.log(`  Grade: ${meta?.grade_band || 'N/A'}`);
        console.log(`  Subject Key: ${meta?.subject_key || 'N/A'}`);
        console.log(`  Purpose: ${meta?.purpose || 'N/A'}`);
        console.log('');
    }
}

main().catch(console.error);
