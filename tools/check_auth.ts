import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Checking Supabase Configuration...');
console.log(`VITE_SUPABASE_URL exists: ${!!supabaseUrl}`);
console.log(`VITE_SUPABASE_ANON_KEY exists: ${!!supabaseAnonKey}`);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Missing environment variables.');
    process.exit(1);
}

console.log('Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Attempting to get session...');
const start = Date.now();
supabase.auth.getSession().then(({ data, error }) => {
    const duration = Date.now() - start;
    console.log(`getSession completed in ${duration}ms`);
    if (error) {
        console.error('Error getting session:', error.message);
    } else {
        console.log('Session retrieved successfully (or null if no session).');
        console.log('User:', data.session?.user?.email ?? 'None');
    }
}).catch(err => {
    console.error('Exception getting session:', err);
});
