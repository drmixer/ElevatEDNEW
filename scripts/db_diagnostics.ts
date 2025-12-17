/**
 * Database Diagnostics Script
 * 
 * Checks the health and content of the ElevatED database.
 * 
 * Usage: npx tsx scripts/db_diagnostics.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
    console.error('Missing SUPABASE_URL');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY || '');

interface TableStats {
    table: string;
    count: number | null;
    sample?: unknown;
}

async function getTableCount(tableName: string): Promise<number | null> {
    try {
        const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error(`  Error counting ${tableName}: ${error.message}`);
            return null;
        }
        return count;
    } catch (err) {
        console.error(`  Exception counting ${tableName}: ${err}`);
        return null;
    }
}

async function getSampleRow(tableName: string, columns: string = '*'): Promise<unknown> {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select(columns)
            .limit(1)
            .single();

        if (error) {
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

async function main() {
    console.log('\n📊 ElevatED Database Diagnostics');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`Database: ${SUPABASE_URL}`);
    console.log(`Auth: ${SUPABASE_SERVICE_KEY ? 'Service Role' : 'Anon Key'}`);
    console.log('═'.repeat(60));

    // Core content tables
    console.log('\n📚 Content Tables:');
    console.log('─'.repeat(40));

    const contentTables = ['modules', 'lessons', 'strands', 'standards'];
    for (const table of contentTables) {
        const count = await getTableCount(table);
        console.log(`  ${table}: ${count ?? 'error'} rows`);
    }

    // Check lessons with content details
    console.log('\n📖 Lessons Content Analysis:');
    console.log('─'.repeat(40));

    const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title, content')
        .limit(100);

    if (lessonsError) {
        console.log(`  Error: ${lessonsError.message}`);
    } else if (lessons) {
        console.log(`  Total lessons checked: ${lessons.length}`);

        let withContent = 0;
        let withHeroImage = 0;
        let withImageUrl = 0;
        let withVideo = 0;

        for (const lesson of lessons) {
            const content = lesson.content as Record<string, unknown> | null;
            if (content && Object.keys(content).length > 0) {
                withContent++;
                if (content.heroImage || content.hero_image) withHeroImage++;
                if (content.image_url || content.imageUrl) withImageUrl++;
                if (content.videoId || content.video_id || content.video) withVideo++;
            }
        }

        console.log(`  With content object: ${withContent}`);
        console.log(`  With heroImage: ${withHeroImage}`);
        console.log(`  With image_url: ${withImageUrl}`);
        console.log(`  With video: ${withVideo}`);

        // Show sample lesson content structure
        const sampleWithContent = lessons.find(l => l.content && Object.keys(l.content as object).length > 0);
        if (sampleWithContent) {
            console.log('\n  Sample lesson content keys:');
            const contentKeys = Object.keys(sampleWithContent.content as object);
            console.log(`    ${contentKeys.join(', ')}`);
        }
    }

    // User tables
    console.log('\n👥 User Tables:');
    console.log('─'.repeat(40));

    const userTables = ['profiles', 'student_profiles', 'parent_profiles'];
    for (const table of userTables) {
        const count = await getTableCount(table);
        console.log(`  ${table}: ${count ?? 'error'} rows`);
    }

    // Billing tables
    console.log('\n💳 Billing Tables:');
    console.log('─'.repeat(40));

    const billingTables = ['plans', 'subscriptions', 'payments'];
    for (const table of billingTables) {
        const count = await getTableCount(table);
        console.log(`  ${table}: ${count ?? 'error'} rows`);
    }

    // Check plans specifically
    const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select('slug, name, status, price_cents');

    if (plansError) {
        console.log(`  Plans query error: ${plansError.message}`);
    } else if (plans && plans.length > 0) {
        console.log('\n  Plan details:');
        for (const plan of plans) {
            const status = plan.status || 'unknown';
            console.log(`    ${plan.slug}: $${(plan.price_cents / 100).toFixed(2)} (${status})`);
        }
    } else {
        console.log('  ⚠️  No plans found - billing may not work!');
    }

    // Progress/Assessment tables
    console.log('\n📈 Progress Tables:');
    console.log('─'.repeat(40));

    const progressTables = ['student_progress', 'student_mastery', 'student_assessment_attempts'];
    for (const table of progressTables) {
        const count = await getTableCount(table);
        console.log(`  ${table}: ${count ?? 'error'} rows`);
    }

    // Check subscriptions constraint
    console.log('\n🔧 Database Constraints Check:');
    console.log('─'.repeat(40));

    // Try to query the constraint info (this might not work depending on permissions)
    try {
        const { data: constraints } = await supabase.rpc('get_table_constraints', { table_name: 'subscriptions' });
        if (constraints) {
            console.log('  Subscriptions constraints:', constraints);
        }
    } catch {
        console.log('  (Constraint check requires database admin access)');
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('Diagnostics complete.\n');
}

main().catch(console.error);
