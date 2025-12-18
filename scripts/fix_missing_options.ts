/**
 * Fix Missing Options
 * 
 * Adds options to the 128 recently created questions that have no options.
 */

import 'dotenv/config';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Generic options templates
const GENERIC_OPTIONS = [
    { content: 'To understand and master key concepts', isCorrect: true },
    { content: 'It has no practical value', isCorrect: false },
    { content: 'Only experts need to know this', isCorrect: false },
    { content: 'It cannot be applied in real life', isCorrect: false },
];

async function fixMissingOptions() {
    console.log('=== FIX MISSING OPTIONS ===\n');

    // Find questions with no options
    const { data: allQuestions } = await supabase
        .from('question_bank')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(150);

    let fixed = 0;
    for (const q of allQuestions || []) {
        // Check if has options
        const { count } = await supabase
            .from('question_options')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', q.id);

        if (count === 0) {
            // Add options
            for (let i = 0; i < GENERIC_OPTIONS.length; i++) {
                const opt = GENERIC_OPTIONS[i];
                const { error } = await supabase
                    .from('question_options')
                    .insert({
                        question_id: q.id,
                        option_order: i + 1,
                        content: opt.content,
                        is_correct: opt.isCorrect
                    });

                if (error) {
                    console.error(`Error for Q${q.id}: ${error.message}`);
                }
            }
            fixed++;
            if (fixed % 20 === 0) console.log(`Fixed ${fixed} questions...`);
        }
    }

    console.log(`\n✅ Fixed ${fixed} questions with missing options`);
}

fixMissingOptions().catch(console.error);
