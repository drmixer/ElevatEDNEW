/**
 * Fix Missing Options
 * 
 * Adds options to the 128 recently created questions that have no options.
 */

import 'dotenv/config';
import process from 'node:process';
import { createServiceRoleClient } from './utils/supabase.js';
import { extractWriteMode, logWriteMode } from './utils/writeMode.js';

const supabase = createServiceRoleClient();

// Generic options templates
const GENERIC_OPTIONS = [
    { content: 'To understand and master key concepts', isCorrect: true },
    { content: 'It has no practical value', isCorrect: false },
    { content: 'Only experts need to know this', isCorrect: false },
    { content: 'It cannot be applied in real life', isCorrect: false },
];

async function fixMissingOptions() {
    const { apply, rest } = extractWriteMode(process.argv.slice(2));
    if (rest.length > 0) {
        throw new Error(`Unknown argument: ${rest[0]}`);
    }
    logWriteMode(apply, 'missing question options');
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
            if (apply) {
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
            }
            fixed++;
            if (fixed % 20 === 0) console.log(`Fixed ${fixed} questions...`);
        }
    }

    console.log(apply ? `\n✅ Fixed ${fixed} questions with missing options` : `\nWould fix ${fixed} questions with missing options`);
}

fixMissingOptions().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
