/**
 * Quick database connectivity test
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');

    const startTime = Date.now();

    try {
        // Simple count query - should be fast
        const { count, error } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true });

        const elapsed = Date.now() - startTime;

        if (error) {
            console.log('❌ Error:', error.message);
        } else {
            console.log(`✅ Connected! Found ${count} lessons (${elapsed}ms)`);
        }
    } catch (e: any) {
        console.log('❌ Exception:', e.message);
    }
}

test();
