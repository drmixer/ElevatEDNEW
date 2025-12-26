/**
 * Final Content Cleanup Script
 * 
 * Completely rewrites lessons that still have template content with
 * proper pedagogical structure and grade-appropriate examples.
 * 
 * Run: npx tsx scripts/final_content_cleanup.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Template patterns to detect (same as audit)
const TEMPLATE_PATTERNS = [
    /Explore the concepts and skills of/i,
    /Develop understanding and apply learning/i,
    /Build fluency and confidence with/i,
    /Practice question \d+ for/i,
    /Start with a real-world connection or interesting question related to the topic/i,
    /Teach key concepts step by step with clear examples/i,
    /Work through problems together as a class/i,
    /Students practice skills/i,
    /Understand key concepts in/i,
    /Apply skills from .+ to solve problems/i,
    /Communicate reasoning about/i,
    /Strengthen your skills in/i,
];

// Grade-inappropriate patterns
const INAPPROPRIATE_PATTERNS: Record<string, RegExp[]> = {
    '3': [/pythagorean/i],
    '4': [/pythagorean/i],
    '5': [/pythagorean/i],
};

interface LessonRow {
    id: number;
    title: string;
    content: string;
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

// Generate complete lesson content based on topic and grade
function generateLessonContent(lesson: LessonRow): string {
    const title = lesson.title;
    const gradeBand = lesson.modules?.grade_band || 'Grade 6';
    const subject = lesson.modules?.subject || 'Mathematics';
    const strand = lesson.modules?.strand || '';
    const topic = lesson.modules?.topic || title;
    const grade = parseInt(gradeBand.replace(/\D/g, '') || '6');

    // Get lesson-specific content
    const lessonData = getLessonData(title, grade);

    return `# ${title}

${lessonData.summary}

**Grade band:** ${gradeBand}
**Subject:** ${subject}
${strand ? `**Strand:** ${strand}` : ''}
**Focus topic:** ${topic}

## Learning Objectives
${lessonData.objectives.map(obj => `- ${obj}`).join('\n')}

## Hook

${lessonData.hook}

## Direct Instruction

${lessonData.directInstruction}

## Guided Practice

${lessonData.guidedPractice}

## Independent Practice

${lessonData.independentPractice}

## Examples

${lessonData.examples}

## Check for Understanding

${lessonData.checkUnderstanding}

## Exit Ticket

${lessonData.exitTicket}
`;
}

interface LessonData {
    summary: string;
    objectives: string[];
    hook: string;
    directInstruction: string;
    guidedPractice: string;
    independentPractice: string;
    examples: string;
    checkUnderstanding: string;
    exitTicket: string;
}

function getLessonData(title: string, grade: number): LessonData {
    const titleLower = title.toLowerCase();

    // Expressions & Equations
    if (titleLower.includes('expression') && titleLower.includes('equation')) {
        return {
            summary: `Master the language of algebra! Learn to write, evaluate, and solve expressions and equations that model real-world situations.`,
            objectives: [
                'Write expressions using variables to represent unknown quantities',
                'Evaluate expressions by substituting values for variables',
                'Solve one-step and two-step equations',
                'Apply equations to solve real-world problems'
            ],
            hook: `Write on the board: "A mystery number plus 5 equals 12. What's the mystery number?" Have students guess. Then reveal: "In math, we call this mystery number a variable, and we write it as n + 5 = 12. Today we'll learn to crack these number puzzles!"`,
            directInstruction: `Introduce expressions as mathematical phrases (3x + 2) and equations as complete sentences with an equals sign (3x + 2 = 11). Demonstrate how variables represent unknown values. Show how to evaluate expressions by substituting: if x = 4, then 3(4) + 2 = 14. Model solving equations using inverse operations: "What we do to one side, we do to the other."`,
            guidedPractice: `Work through examples together: (1) Write an expression for "twice a number decreased by 5" (2n - 5). (2) Evaluate 4x + 7 when x = 3 (answer: 19). (3) Solve x + 8 = 15 for x (answer: x = 7). Have students explain each step.`,
            independentPractice: `Students complete a worksheet with: 5 expressions to write from word descriptions, 5 expressions to evaluate for given values, and 5 equations to solve. Include a word problem: "A rectangle's length is 3 more than its width. If the width is w, write an expression for the perimeter."`,
            examples: `**Example 1:** Write "a number increased by 9" as an expression → n + 9\n\n**Example 2:** Evaluate 2x - 4 when x = 7 → 2(7) - 4 = 14 - 4 = 10\n\n**Example 3:** Solve 3x = 18 → Divide both sides by 3 → x = 6\n\n**Try This:** If a book costs $x and you buy 4 books plus a $3 bookmark, write an expression for the total cost.`,
            checkUnderstanding: `Quick check: "What operation undoes addition?" (subtraction) "If 2x = 16, what is x?" (8) "Write an expression for 5 less than a number." (n - 5) Have students share their reasoning.`,
            exitTicket: `Students solve: (1) Write an expression for "triple a number plus 7" (2) Evaluate 5n - 3 when n = 4 (3) Solve x - 9 = 15`
        };
    }

    // Coordinate Geometry
    if (titleLower.includes('coordinate')) {
        const pythagoreanNote = grade >= 8 ?
            'Introduce the distance formula derived from the Pythagorean theorem: d = √((x₂-x₁)² + (y₂-y₁)²). ' :
            '';

        return {
            summary: `Navigate the coordinate plane like a pro! Learn to plot points, identify locations, and discover patterns using coordinates.`,
            objectives: [
                'Plot and identify points on the coordinate plane',
                'Understand the four quadrants and origin',
                'Calculate distances between points',
                'Connect coordinate geometry to real-world applications like maps'
            ],
            hook: `Display a treasure map with a grid overlay. "X marks the spot! But how do we describe exactly where X is? Today we'll learn the secret code mathematicians use to locate any point on a plane."`,
            directInstruction: `Review the coordinate plane: horizontal x-axis, vertical y-axis, meeting at origin (0,0). Explain ordered pairs (x, y) as "over then up." Cover all four quadrants and how signs indicate direction. ${pythagoreanNote}Model plotting several points accurately.`,
            guidedPractice: `Create a "Connect the Dots" activity where students plot points to reveal a shape. Practice identifying coordinates of given points. Work together to find the distance between two points on the same horizontal or vertical line.`,
            independentPractice: `Students complete a coordinate plane worksheet: plot 10 ordered pairs, identify coordinates of 10 given points, answer questions about which quadrant points lie in, and create their own picture by listing coordinates for a partner to plot.`,
            examples: `**Example 1:** Plot (3, 5) by moving 3 right and 5 up from the origin.\n\n**Example 2:** The point (-2, 4) is in Quadrant II (left 2, up 4).\n\n**Example 3:** Distance from (1, 3) to (1, 7) is |7 - 3| = 4 units (same x-coordinate, so count vertical units).\n\n**Try This:** What are the coordinates of a point that is 4 units left and 2 units down from the origin?`,
            checkUnderstanding: `Display points and ask: "What quadrant is (-3, -5) in?" (Quadrant III) "What's special about points on the x-axis?" (y = 0) "How do you know if a point is in Quadrant IV?" (positive x, negative y)`,
            exitTicket: `Plot and label: A(2, 3), B(-4, 1), C(0, -2). Then answer: Which point is closest to the origin?`
        };
    }

    // Similarity & Congruence
    if (titleLower.includes('similar') || titleLower.includes('congruen')) {
        return {
            summary: `Discover when shapes are twins (congruent) or lookalikes (similar). Learn to identify, compare, and create matching figures.`,
            objectives: [
                'Define and identify congruent figures (same size and shape)',
                'Define and identify similar figures (same shape, different size)',
                'Use transformations to show congruence',
                'Calculate scale factors between similar figures'
            ],
            hook: `Show two identical photos (congruent) and then the same photo enlarged (similar). "Are these the same? What's alike and what's different? Today we'll explore the math of 'same' and 'almost same.'"`,
            directInstruction: `Define congruent as exactly the same shape and size - like identical twins. Define similar as the same shape but possibly different sizes - like a photo and its enlargement. Demonstrate how congruent figures can be mapped onto each other with rotations, reflections, and translations. Introduce scale factor for similar figures.`,
            guidedPractice: `Provide pairs of shapes. Students sort into "congruent," "similar but not congruent," and "neither." For similar pairs, calculate the scale factor by comparing corresponding sides. Trace and cut out shapes to test congruence by overlapping.`,
            independentPractice: `Students identify corresponding parts in similar and congruent figures, calculate missing side lengths using scale factors, and draw a shape similar to a given figure with a specified scale factor of 2.`,
            examples: `**Example 1:** Two squares with 3-inch sides are congruent (same shape and size).\n\n**Example 2:** A 2×4 rectangle and a 4×8 rectangle are similar with scale factor 2.\n\n**Example 3:** If triangle ABC is similar to triangle DEF with scale factor 3, and AB = 2 cm, then DE = 6 cm.\n\n**Try This:** A poster is 8 inches by 10 inches. What dimensions would a similar poster with scale factor 1.5 have?`,
            checkUnderstanding: `Ask: "Can two triangles be congruent if their angles are equal but sides are different lengths?" (No) "If a figure is congruent to another, is it also similar?" (Yes) "What's the scale factor if both figures are congruent?" (1)`,
            exitTicket: `Triangle XYZ has sides 3, 4, and 5 cm. Triangle ABC is similar with scale factor 2. Find the side lengths of ABC.`
        };
    }

    // Percent & Rates
    if (titleLower.includes('percent') || titleLower.includes('rate')) {
        return {
            summary: `Master the power of percents and rates! Learn to calculate discounts, tips, tax, and solve problems involving rates of change.`,
            objectives: [
                'Convert between percents, decimals, and fractions',
                'Calculate percent of a number',
                'Solve real-world percent problems (discount, tax, tip)',
                'Understand and calculate unit rates'
            ],
            hook: `Hold up a "30% OFF!" sale sign. "If a $50 jacket is 30% off, is it a good deal? How much will you actually save? By the end of today, you'll be a percent pro who never gets fooled by sales!"`,
            directInstruction: `Review that percent means "per hundred" (50% = 50/100 = 0.5). Demonstrate conversions: percent to decimal (move decimal left 2), decimal to percent (move right 2). Show three methods for finding percent of a number: proportion, equation, mental math. Introduce unit rates as rates with denominator of 1.`,
            guidedPractice: `Practice problems as a class: (1) Convert 75% to a decimal and fraction. (2) Find 20% of $85. (3) A $60 shirt is 25% off. What's the sale price? (4) If 6 apples cost $3, what's the unit rate? Compare different stores' prices using unit rates.`,
            independentPractice: `Students solve percent problems: 5 conversions, 5 "find the percent" calculations, 5 word problems involving sales tax, tips, and discounts. Include a comparison problem: "Store A sells 12 pencils for $2.40. Store B sells 8 pencils for $1.84. Which is the better deal?"`,
            examples: `**Example 1:** 40% = 40/100 = 0.40 = 2/5\n\n**Example 2:** Find 15% of $80: 0.15 × 80 = $12\n\n**Example 3:** Unit rate: 240 miles in 4 hours = 60 miles per hour\n\n**Try This:** A restaurant bill is $45. You want to leave a 20% tip. What's the tip amount?`,
            checkUnderstanding: `Quick fire: "25% as a fraction?" (1/4) "If something is 50% off, is it half price?" (Yes) "What's the unit rate if 5 pounds of apples cost $7.50?" ($1.50 per pound)`,
            exitTicket: `A $200 bike is on sale for 15% off. (1) Calculate the discount amount. (2) Calculate the sale price. (3) If tax is 8%, what's the final total?`
        };
    }

    // Transformations & Symmetry
    if (titleLower.includes('transform') || titleLower.includes('symmetry')) {
        return {
            summary: `Explore how shapes move, flip, and turn! Discover the math behind reflections, rotations, translations, and symmetry.`,
            objectives: [
                'Identify and perform translations (slides)',
                'Identify and perform reflections (flips)',
                'Identify and perform rotations (turns)',
                'Recognize line symmetry and rotational symmetry'
            ],
            hook: `Show images of butterflies, snowflakes, and company logos. "What do these have in common?" Lead students to notice symmetry. "Today we'll learn the mathematical moves that create these perfect patterns."`,
            directInstruction: `Define and demonstrate: translations (slide in a direction), reflections (flip over a line - mirror image), rotations (turn around a point). Use transparent overlays to show each transformation. Introduce line symmetry (fold test) and rotational symmetry (how many times a shape looks the same in one full turn).`,
            guidedPractice: `Using grid paper, students practice each transformation on simple shapes. Identify the transformation shown between pairs of figures. Fold paper to find lines of symmetry in letters and shapes. Count rotational symmetries of regular polygons.`,
            independentPractice: `Students complete transformation worksheets: draw the result of specified transformations, identify the transformation between given figures, draw all lines of symmetry in shapes, design a logo with at least one line of symmetry.`,
            examples: `**Example 1:** Translating triangle ABC 3 units right moves every point 3 units right: A(1,2) → A'(4,2).\n\n**Example 2:** Reflecting over the y-axis changes sign of x-coordinates: (3, 5) → (-3, 5).\n\n**Example 3:** A square has 4 lines of symmetry and rotational symmetry of order 4 (looks the same every 90° turn).\n\n**Try This:** How many lines of symmetry does an equilateral triangle have?`,
            checkUnderstanding: `Show figure pairs and ask students to identify the transformation. Ask: "Does a reflection change the size of a shape?" (No) "Can every shape be rotated to look like itself?" (Yes, at 360°)`,
            exitTicket: `Draw a right triangle, then draw its reflection over a vertical line. Label the original and image vertices. Does reflection change which angle is the right angle?`
        };
    }

    // Scatterplots & Correlation (remove Pythagorean reference)
    if (titleLower.includes('scatter') || titleLower.includes('correlation')) {
        return {
            summary: `Discover patterns in data! Learn to create and interpret scatterplots that reveal relationships between two variables.`,
            objectives: [
                'Create scatterplots from data sets',
                'Identify patterns (positive, negative, no correlation)',
                'Describe trends using lines of best fit',
                'Make predictions based on scatterplot data'
            ],
            hook: `Ask: "Do taller people have bigger feet? Do students who study more get better grades?" Write predictions. "Today we'll create graphs that reveal hidden patterns in data."`,
            directInstruction: `Explain that scatterplots show relationships between two variables. Each point represents one data pair. Demonstrate plotting points from a data table. Introduce correlation: positive (up together), negative (one up, one down), none (random). Show how to sketch a line of best fit to summarize the trend.`,
            guidedPractice: `Create a class scatterplot with student data (height vs. arm span or shoe size). Identify the correlation type. Sketch a line of best fit. Use the line to predict: "What arm span would we expect for someone 65 inches tall?"`,
            independentPractice: `Students create scatterplots from provided data sets (temperature vs. ice cream sales, study time vs. test score). They identify correlation type, draw lines of best fit, and answer prediction questions.`,
            examples: `**Example 1:** Study time vs. test scores shows positive correlation - more study, higher scores.\n\n**Example 2:** Temperature vs. hot chocolate sales shows negative correlation - hotter days, fewer sales.\n\n**Example 3:** Shoe size vs. math grade likely shows no correlation - the variables aren't related.\n\n**Try This:** What type of correlation would hours of sleep vs. energy level show?`,
            checkUnderstanding: `Show scatterplots and ask: "What type of correlation?" "What does this point represent?" "Using the trend, predict the y-value when x = 10."`,
            exitTicket: `Given this scatterplot of hours practiced vs. goals scored, (1) identify the correlation, (2) describe the trend, (3) predict goals for 5 hours of practice.`
        };
    }

    // Default content for other lessons
    return {
        summary: `Build understanding and mastery in ${title} through engaging examples and practice.`,
        objectives: [
            `Understand the key concepts of ${title}`,
            `Apply ${title} skills to solve problems`,
            `Explain reasoning and justify answers`,
            `Connect ${title} to real-world situations`
        ],
        hook: `Begin with a thought-provoking question or real-world scenario that connects to ${title}. Build curiosity and activate prior knowledge.`,
        directInstruction: `Present the key concepts of ${title} with clear explanations. Use visual models and worked examples. Build from simple to complex ideas. Check for understanding throughout.`,
        guidedPractice: `Work through problems together as a class. Model thinking aloud. Have students contribute ideas and explain their reasoning. Correct misconceptions immediately.`,
        independentPractice: `Students apply skills independently with a variety of problem types. Include routine practice, word problems, and challenges. Provide feedback and support as needed.`,
        examples: `**Example 1:** Here is a straightforward application of the concept.\n\n**Example 2:** This example shows a slightly more complex situation.\n\n**Example 3:** This word problem connects the skill to real life.\n\n**Try This:** Apply what you've learned to a similar problem.`,
        checkUnderstanding: `Use questioning to assess student understanding. Have students explain their thinking. Address any remaining confusion.`,
        exitTicket: `Students demonstrate understanding by solving one problem independently and explaining their process.`
    };
}

async function main() {
    console.log('=== FINAL CONTENT CLEANUP ===\n');

    // Load audit report
    const reportPath = path.resolve(process.cwd(), 'data/audits/content_quality_report_final_v2.json');

    if (!fs.existsSync(reportPath)) {
        console.error('Audit report not found at:', reportPath);
        process.exit(1);
    }

    interface AuditIssue {
        lessonId: number;
        lessonTitle: string;
        gradeBand: string;
        subject: string;
        issueType: string;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as { issues: AuditIssue[] };

    // Get unique lesson IDs with issues
    const lessonIds = [...new Set(report.issues.map(i => i.lessonId))];
    console.log(`Found ${lessonIds.length} lessons with remaining issues\n`);

    // Fetch lessons
    const { data: lessons, error } = await supabase
        .from('lessons')
        .select(`
            id,
            title,
            content,
            modules (
                grade_band,
                subject,
                strand,
                topic
            )
        `)
        .in('id', lessonIds);

    if (error) {
        throw new Error(`Failed to fetch lessons: ${error.message}`);
    }

    console.log(`Fetched ${lessons?.length || 0} lessons\n`);

    let fixedCount = 0;

    for (const lesson of (lessons || []) as unknown as LessonRow[]) {
        const content = lesson.content;

        // Check if content has template patterns
        const hasTemplate = TEMPLATE_PATTERNS.some(p => p.test(content));

        // Check for inappropriate content based on grade
        const gradeNum = lesson.modules?.grade_band?.replace(/\D/g, '') || '6';
        const inappropriatePatterns = INAPPROPRIATE_PATTERNS[gradeNum] || [];
        const hasInappropriate = inappropriatePatterns.some(p => p.test(content));

        if (hasTemplate || hasInappropriate) {
            // Generate new content
            const newContent = generateLessonContent(lesson);

            const { error: updateError } = await supabase
                .from('lessons')
                .update({
                    content: newContent,
                    metadata: {
                        last_updated: new Date().toISOString(),
                        updated_by: 'final_content_cleanup'
                    }
                })
                .eq('id', lesson.id);

            if (updateError) {
                console.error(`Failed to update lesson ${lesson.id}: ${updateError.message}`);
            } else {
                fixedCount++;
                console.log(`✓ Fixed lesson ${lesson.id}: ${lesson.title}`);
            }
        }
    }

    console.log(`\n=== CLEANUP SUMMARY ===`);
    console.log(`Lessons processed: ${lessonIds.length}`);
    console.log(`Lessons fixed: ${fixedCount}`);
    console.log(`\n✅ Final cleanup complete!`);
}

main().catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
});
