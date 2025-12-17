/**
 * E2E Validation Script
 * 
 * Tests the ElevatED platform without requiring a browser:
 * - API endpoint availability
 * - Supabase connectivity
 * - Database integrity
 * - Content availability
 * 
 * Usage: npx tsx scripts/e2e_validation.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const VITE_DEV_SERVER = process.env.VITE_DEV_SERVER || 'http://localhost:5173';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    duration?: number;
}

const results: TestResult[] = [];

// Helper function to run a test
async function runTest(
    name: string,
    testFn: () => Promise<{ passed: boolean; message: string }>
): Promise<void> {
    const start = Date.now();
    try {
        const result = await testFn();
        results.push({
            name,
            passed: result.passed,
            message: result.message,
            duration: Date.now() - start,
        });
    } catch (error) {
        results.push({
            name,
            passed: false,
            message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
            duration: Date.now() - start,
        });
    }
}

// Test 1: Vite Dev Server Availability
async function testViteServer(): Promise<{ passed: boolean; message: string }> {
    try {
        const response = await fetch(VITE_DEV_SERVER, {
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            const html = await response.text();
            if (html.includes('ElevatED') || html.includes('root')) {
                return { passed: true, message: `Server responding at ${VITE_DEV_SERVER}` };
            }
            return { passed: false, message: 'Server responding but HTML seems incorrect' };
        }
        return { passed: false, message: `Server returned status ${response.status}` };
    } catch (error) {
        return {
            passed: false,
            message: `Cannot reach server: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 2: Supabase Client Connectivity
async function testSupabaseConnection(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return { passed: false, message: 'Missing Supabase credentials in environment' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        // Simple query to test connection
        const { error } = await supabase.from('modules').select('id').limit(1);
        if (error) {
            return { passed: false, message: `Supabase query failed: ${error.message}` };
        }
        return { passed: true, message: 'Supabase connection successful' };
    } catch (error) {
        return {
            passed: false,
            message: `Supabase connection error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 3: Content Availability (Lessons)
async function testContentAvailability(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return { passed: false, message: 'Missing Supabase credentials' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('id, title, content')
            .not('content', 'is', null)
            .limit(5);

        if (error) {
            return { passed: false, message: `Failed to fetch lessons: ${error.message}` };
        }

        if (!lessons || lessons.length === 0) {
            return { passed: false, message: 'No lessons found in database' };
        }

        const lessonsWithContent = lessons.filter(l => l.content && Object.keys(l.content).length > 0);
        return {
            passed: lessonsWithContent.length > 0,
            message: `Found ${lessonsWithContent.length}/${lessons.length} lessons with content`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Content check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 4: Modules and Grade Bands - uses service key to bypass RLS
async function testModulesStructure(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { passed: false, message: 'Missing Supabase service key for this test' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const { data: modules, error, count } = await supabase
            .from('modules')
            .select('id, title, grade_band, subject', { count: 'exact' })
            .limit(20);

        if (error) {
            return { passed: false, message: `Failed to fetch modules: ${error.message}` };
        }

        if (!modules || modules.length === 0) {
            return { passed: false, message: 'No modules found in database' };
        }

        const gradeBands = [...new Set(modules.map(m => m.grade_band))];
        const subjects = [...new Set(modules.map(m => m.subject))];

        return {
            passed: true,
            message: `Found ${count ?? modules.length} modules across ${gradeBands.length} grade bands and ${subjects.length} subjects`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Modules check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 5: Student Profiles Table
async function testStudentProfiles(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { passed: false, message: 'Missing Supabase service key for this test' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const { error, count } = await supabase
            .from('student_profiles')
            .select('id, grade', { count: 'exact' })
            .limit(5);

        if (error) {
            return { passed: false, message: `Failed to fetch student profiles: ${error.message}` };
        }

        return {
            passed: true,
            message: `Student profiles table accessible. Total count: ${count ?? 'unknown'}`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Student profiles check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 6: Subscriptions Table (checking for the constraint issue)
async function testSubscriptionsTable(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { passed: false, message: 'Missing Supabase service key for this test' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('id, parent_id, status')
            .limit(3);

        if (error) {
            return { passed: false, message: `Failed to query subscriptions: ${error.message}` };
        }

        return {
            passed: true,
            message: `Subscriptions table accessible. Found ${data?.length ?? 0} records.`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Subscriptions check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 7: API Health Check
async function testAPIHealth(): Promise<{ passed: boolean; message: string }> {
    try {
        // Test the health endpoint if it exists
        const response = await fetch(`${VITE_DEV_SERVER}/api/health`, {
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            return { passed: true, message: 'API health endpoint responding' };
        }

        // If health endpoint doesn't exist, try a basic API call
        const billingResponse = await fetch(`${VITE_DEV_SERVER}/api/billing/plans`, {
            signal: AbortSignal.timeout(5000),
        });

        if (billingResponse.status === 401 || billingResponse.ok) {
            return { passed: true, message: 'API endpoints accessible (billing/plans responded)' };
        }

        return { passed: false, message: 'API endpoints not responding as expected' };
    } catch (error) {
        return {
            passed: false,
            message: `API check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 8: Image Coverage (images are embedded in markdown content)
async function testImageCoverage(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return { passed: false, message: 'Missing Supabase credentials' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('id, content')
            .not('content', 'is', null)
            .limit(100);

        if (error) {
            return { passed: false, message: `Failed to fetch lessons: ${error.message}` };
        }

        if (!lessons || lessons.length === 0) {
            return { passed: false, message: 'No lessons found' };
        }

        let withImages = 0;
        for (const lesson of lessons) {
            // Content is stored as markdown text, check for image references
            const content = lesson.content as string || '';
            if (content.includes('![') || content.includes('imgur.com') ||
                content.includes('.png') || content.includes('.jpg') ||
                content.includes('wikimedia.org')) {
                withImages++;
            }
        }

        const percentage = Math.round((withImages / lessons.length) * 100);
        return {
            passed: percentage >= 80,
            message: `${withImages}/${lessons.length} lessons have images in content (${percentage}%)`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Image coverage check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Test 9: Plans Table (for billing) - uses service key to bypass RLS
async function testPlansTable(): Promise<{ passed: boolean; message: string }> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { passed: false, message: 'Missing Supabase service key for this test' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const { data: plans, error } = await supabase
            .from('plans')
            .select('slug, name, price_cents, status')
            .eq('status', 'active');

        if (error) {
            return { passed: false, message: `Failed to fetch plans: ${error.message}` };
        }

        if (!plans || plans.length === 0) {
            return { passed: false, message: 'No active plans found in database' };
        }

        const planNames = plans.map(p => p.slug).join(', ');
        return {
            passed: true,
            message: `Found ${plans.length} active plans: ${planNames}`
        };
    } catch (error) {
        return {
            passed: false,
            message: `Plans check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Main execution
async function main() {
    console.log('\n🧪 ElevatED E2E Validation');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`Server: ${VITE_DEV_SERVER}`);
    console.log(`Supabase: ${SUPABASE_URL ? '✓ Configured' : '✗ Missing'}`);
    console.log('═'.repeat(60));
    console.log('\nRunning tests...\n');

    // Run all tests
    await runTest('1. Vite Dev Server', testViteServer);
    await runTest('2. Supabase Connection', testSupabaseConnection);
    await runTest('3. Content Availability', testContentAvailability);
    await runTest('4. Modules Structure', testModulesStructure);
    await runTest('5. Student Profiles', testStudentProfiles);
    await runTest('6. Subscriptions Table', testSubscriptionsTable);
    await runTest('7. API Health', testAPIHealth);
    await runTest('8. Image Coverage', testImageCoverage);
    await runTest('9. Plans Table', testPlansTable);

    // Print results
    console.log('\n' + '─'.repeat(60));
    console.log('Results:');
    console.log('─'.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        const duration = result.duration ? ` (${result.duration}ms)` : '';
        console.log(`${icon} ${result.name}${duration}`);
        console.log(`   ${result.message}`);

        if (result.passed) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`);

    if (failed === 0) {
        console.log('🎉 All tests passed! The platform is ready for production testing.');
    } else {
        console.log('⚠️  Some tests failed. Review the issues above.');
    }
    console.log('═'.repeat(60) + '\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
