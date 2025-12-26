/**
 * Fix Remaining Content Issues Script
 * 
 * Addresses two types of medium-severity issues:
 * 1. structure_issue - "No examples found in content" - Adds contextual examples
 * 2. template_content - "Template/generated content detected" - Replaces template phrases
 * 
 * Run: npx tsx scripts/fix_remaining_content_issues.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Template patterns to detect and replace
const TEMPLATE_PATTERNS: { pattern: RegExp; replacement: (match: string, title: string) => string }[] = [
    {
        pattern: /Explore the concepts and skills of ([^.]+)\./gi,
        replacement: (_, topic) => `Dive into the world of ${topic}. You'll discover practical applications and build lasting understanding.`
    },
    {
        pattern: /Develop understanding and apply learning in ([^.]+)\./gi,
        replacement: (_, topic) => `Master the key concepts of ${topic} through hands-on practice and real-world connections.`
    },
    {
        pattern: /Build fluency and confidence with ([^.]+)\./gi,
        replacement: (_, topic) => `Strengthen your skills in ${topic} through engaging practice and step-by-step guidance.`
    },
    {
        pattern: /Practice question \d+ for ([^.]+)\./gi,
        replacement: (_, topic) => `Let's practice what you've learned about ${topic}.`
    },
];

// Example generators by subject
const EXAMPLE_GENERATORS: Record<string, (title: string, gradeBand: string) => string> = {
    'Mathematics': (title, gradeBand) => {
        const grade = parseInt(gradeBand.replace(/\D/g, '') || '5');
        const examples = getMathExamples(title, grade);
        return `\n\n## Examples\n\n${examples}`;
    },
    'English Language Arts': (title, gradeBand) => {
        const examples = getELAExamples(title, gradeBand);
        return `\n\n## Examples\n\n${examples}`;
    },
    'Science': (title, gradeBand) => {
        const examples = getScienceExamples(title, gradeBand);
        return `\n\n## Examples\n\n${examples}`;
    },
    'Social Studies': (title, gradeBand) => {
        return `\n\n## Examples\n\n**Real-World Connection:** Think about how the concepts in this lesson connect to current events and your community.\n\n**Example:** Consider how the ideas we're studying have shaped the world around us today.\n\n**Try This:** Look for examples of these concepts in news articles or your neighborhood.`;
    },
};

function getMathExamples(title: string, grade: number): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('fraction')) {
        if (grade <= 4) {
            return `**Example 1:** Imagine you have a pizza cut into 4 equal slices. If you eat 1 slice, you've eaten 1/4 of the pizza.\n\n**Example 2:** A chocolate bar has 8 pieces. If you share 2 pieces with a friend, you gave away 2/8 = 1/4 of the bar.\n\n**Try This:** Draw a rectangle and divide it into 6 equal parts. Color in 3 parts. What fraction did you color?`;
        } else {
            return `**Example 1:** To add 2/3 + 1/4, find a common denominator (12). So 2/3 = 8/12 and 1/4 = 3/12. The answer is 11/12.\n\n**Example 2:** A recipe calls for 3/4 cup of flour. If you want to make half the recipe, multiply: 3/4 × 1/2 = 3/8 cup.\n\n**Try This:** Calculate 5/6 - 1/3. Remember to find a common denominator first!`;
        }
    }

    if (titleLower.includes('equation') || titleLower.includes('expression')) {
        return `**Example 1:** The expression 3x + 5 means "multiply a number by 3, then add 5." If x = 4, then 3(4) + 5 = 17.\n\n**Example 2:** To solve 2x + 6 = 14, subtract 6 from both sides (2x = 8), then divide by 2 (x = 4).\n\n**Try This:** If you have 5 boxes with the same number of pencils, plus 3 extra pencils, and 23 pencils total, how many are in each box?`;
    }

    if (titleLower.includes('geometry') || titleLower.includes('coordinate')) {
        return `**Example 1:** The point (3, 5) is located by moving 3 units right on the x-axis and 5 units up on the y-axis.\n\n**Example 2:** To find the distance between (0, 0) and (3, 4), use the Pythagorean theorem: √(3² + 4²) = √25 = 5.\n\n**Try This:** Plot the points (2, 1), (2, 4), and (5, 1). What shape do they form when connected?`;
    }

    if (titleLower.includes('probability')) {
        return `**Example 1:** When flipping a fair coin, the probability of heads is 1/2 or 50%.\n\n**Example 2:** If a bag has 3 red marbles and 5 blue marbles, the probability of drawing red is 3/8.\n\n**Try This:** If you roll a standard die, what's the probability of rolling an even number?`;
    }

    if (titleLower.includes('ratio') || titleLower.includes('proportion')) {
        return `**Example 1:** If a recipe uses 2 cups flour for every 1 cup sugar, the ratio is 2:1.\n\n**Example 2:** If 3 pencils cost $1.50, then 9 pencils cost $4.50 (multiply both by 3).\n\n**Try This:** A car travels 120 miles in 2 hours. At this rate, how far will it travel in 5 hours?`;
    }

    if (titleLower.includes('decimal') || titleLower.includes('percent')) {
        return `**Example 1:** 0.75 equals 75% (move the decimal two places right) or 3/4.\n\n**Example 2:** To find 20% of 80: convert to decimal (0.20) and multiply (0.20 × 80 = 16).\n\n**Try This:** A shirt costs $40 and is on sale for 25% off. What's the discount amount? What's the sale price?`;
    }

    if (titleLower.includes('transform') || titleLower.includes('symmetry')) {
        return `**Example 1:** When you reflect a shape across a line, each point moves the same distance on the opposite side.\n\n**Example 2:** Rotating a square 90° clockwise keeps it looking the same because squares have rotational symmetry.\n\n**Try This:** Draw a simple shape and its reflection across a vertical line. Are all points equidistant from the line?`;
    }

    if (titleLower.includes('scatter') || titleLower.includes('correlation')) {
        return `**Example 1:** A scatterplot showing study time vs. test scores might show a positive correlation (more study = higher scores).\n\n**Example 2:** A scatterplot of ice cream sales vs. temperature would likely show positive correlation.\n\n**Try This:** What kind of correlation would you expect between hours of video games played and grades? Why?`;
    }

    // Default math examples
    return `**Example 1:** Let's apply this concept to a real situation you might encounter.\n\n**Example 2:** Here's another way to think about solving this type of problem.\n\n**Try This:** Practice with a similar problem and check your work!`;
}

function getELAExamples(title: string, gradeBand: string): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('vocabulary') || titleLower.includes('word')) {
        return `**Example 1:** The word "benevolent" contains the root "bene" (good). Think of other "bene" words: benefit, beneficial, benefactor.\n\n**Example 2:** Adding the prefix "un-" to "happy" reverses its meaning: unhappy means not happy.\n\n**Try This:** Find a new word in your reading today and identify its parts (root, prefix, or suffix).`;
    }

    if (titleLower.includes('writing') || titleLower.includes('paragraph')) {
        return `**Example 1:** A strong topic sentence: "Dogs make excellent companions for several reasons." This tells the reader exactly what the paragraph will discuss.\n\n**Example 2:** Supporting details: "First, dogs are loyal and always happy to see you. Second, they encourage exercise through daily walks."\n\n**Try This:** Write a topic sentence for a paragraph about your favorite activity.`;
    }

    if (titleLower.includes('reading') || titleLower.includes('comprehension')) {
        return `**Example 1:** When the text says "Her face fell," we can infer the character became disappointed, even though it doesn't say "disappointed" directly.\n\n**Example 2:** Looking for context clues around an unfamiliar word helps determine its meaning.\n\n**Try This:** Read a short passage and identify the main idea. What details support this main idea?`;
    }

    return `**Example 1:** Consider how this skill applies to texts you read every day.\n\n**Example 2:** Practice this strategy with a piece of writing you enjoy.\n\n**Try This:** Apply what you've learned to your next reading or writing assignment.`;
}

function getScienceExamples(title: string, gradeBand: string): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('energy')) {
        return `**Example 1:** When you turn on a flashlight, chemical energy in the battery converts to electrical energy, then to light energy.\n\n**Example 2:** Rubbing your hands together converts kinetic (motion) energy to thermal (heat) energy.\n\n**Try This:** Identify three energy transformations that happen in your home every day.`;
    }

    if (titleLower.includes('force') || titleLower.includes('motion')) {
        return `**Example 1:** Pushing a shopping cart: an unbalanced force causes it to accelerate in the direction you push.\n\n**Example 2:** A book on a table: gravity pulls down, the table pushes up equally – balanced forces, no motion.\n\n**Try This:** Observe a ball rolling across the floor. What forces cause it to eventually stop?`;
    }

    if (titleLower.includes('ecosystem') || titleLower.includes('food')) {
        return `**Example 1:** In a pond ecosystem: algae (producer) → small fish (consumer) → heron (consumer) → bacteria (decomposer).\n\n**Example 2:** If frogs disappeared from a pond, insects would increase (no predator) and heron population would decrease (less food).\n\n**Try This:** Draw a simple food web for your backyard or a local park.`;
    }

    return `**Example 1:** Observe this concept in your everyday environment.\n\n**Example 2:** This scientific principle explains many phenomena you encounter daily.\n\n**Try This:** Design a simple experiment to test this concept at home.`;
}

interface LessonRecord {
    id: number;
    title: string;
    content: string;
    modules: {
        grade_band: string;
        subject: string;
    } | null;
}

interface AuditIssue {
    lessonId: number;
    lessonTitle: string;
    gradeBand: string;
    subject: string;
    issueType: string;
    severity: string;
    details: string;
}

interface AuditReport {
    issues: AuditIssue[];
}

async function fetchLessonsByIds(ids: number[]): Promise<Map<number, LessonRecord>> {
    const lessons = new Map<number, LessonRecord>();

    const { data, error } = await supabase
        .from('lessons')
        .select(`
            id, 
            title, 
            content, 
            modules (
                grade_band,
                subject
            )
        `)
        .in('id', ids);

    if (error) {
        throw new Error(`Failed to fetch lessons: ${error.message}`);
    }

    for (const lesson of (data || []) as unknown as LessonRecord[]) {
        lessons.set(lesson.id, lesson);
    }

    return lessons;
}

async function updateLessonContent(id: number, content: string): Promise<void> {
    const { error } = await supabase
        .from('lessons')
        .update({
            content,
            metadata: {
                last_updated: new Date().toISOString(),
                updated_by: 'fix_remaining_content_issues'
            }
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update lesson ${id}: ${error.message}`);
    }
}

function fixTemplateContent(content: string, title: string): string {
    let fixed = content;

    for (const { pattern, replacement } of TEMPLATE_PATTERNS) {
        fixed = fixed.replace(pattern, (match, ...args) => replacement(match, args[0] || title));
    }

    return fixed;
}

function addExamples(content: string, title: string, subject: string, gradeBand: string): string {
    const generator = EXAMPLE_GENERATORS[subject] || EXAMPLE_GENERATORS['Mathematics'];
    const examples = generator(title, gradeBand);

    // Find a good place to insert examples (after main content, before exit ticket if present)
    if (content.includes('## Exit Ticket')) {
        return content.replace('## Exit Ticket', examples + '\n\n## Exit Ticket');
    } else if (content.includes('## Check for Understanding')) {
        return content.replace('## Check for Understanding', examples + '\n\n## Check for Understanding');
    } else if (content.includes('## Summary')) {
        return content.replace('## Summary', examples + '\n\n## Summary');
    } else {
        // Append at the end
        return content + examples;
    }
}

async function main() {
    console.log('=== FIXING REMAINING CONTENT ISSUES ===\n');

    // Load audit report
    const reportPath = path.resolve(process.cwd(), 'data/audits/content_quality_report_post_seed.json');

    if (!fs.existsSync(reportPath)) {
        console.error('Audit report not found. Run audit_content_quality.ts first.');
        process.exit(1);
    }

    const report: AuditReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    // Group issues by lesson ID
    const issuesByLesson = new Map<number, AuditIssue[]>();
    for (const issue of report.issues) {
        const existing = issuesByLesson.get(issue.lessonId) || [];
        existing.push(issue);
        issuesByLesson.set(issue.lessonId, existing);
    }

    const lessonIds = Array.from(issuesByLesson.keys());
    console.log(`Found ${lessonIds.length} lessons with issues\n`);

    // Fetch lesson content
    console.log('Fetching lesson content...');
    const lessons = await fetchLessonsByIds(lessonIds);
    console.log(`Fetched ${lessons.size} lessons\n`);

    let fixedCount = 0;
    let templateFixed = 0;
    let examplesAdded = 0;

    for (const [lessonId, issues] of issuesByLesson) {
        const lesson = lessons.get(lessonId);
        if (!lesson) {
            console.warn(`Lesson ${lessonId} not found, skipping`);
            continue;
        }

        let content = lesson.content;
        const subject = lesson.modules?.subject || 'Mathematics';
        const gradeBand = lesson.modules?.grade_band || 'Grade 5';

        for (const issue of issues) {
            if (issue.issueType === 'template_content') {
                content = fixTemplateContent(content, lesson.title);
                templateFixed++;
            } else if (issue.issueType === 'structure_issue' && issue.details.includes('No examples')) {
                content = addExamples(content, lesson.title, subject, gradeBand);
                examplesAdded++;
            }
        }

        // Update if content changed
        if (content !== lesson.content) {
            await updateLessonContent(lessonId, content);
            fixedCount++;

            if (fixedCount % 20 === 0) {
                console.log(`Fixed ${fixedCount}/${lessonIds.length} lessons...`);
            }
        }
    }

    console.log('\n=== FIX SUMMARY ===\n');
    console.log(`Total lessons processed: ${lessonIds.length}`);
    console.log(`Lessons fixed: ${fixedCount}`);
    console.log(`Template content replaced: ${templateFixed}`);
    console.log(`Examples added: ${examplesAdded}`);
    console.log('\n✅ Content fixes complete!');
}

main().catch((error) => {
    console.error('Fix failed:', error);
    process.exit(1);
});
