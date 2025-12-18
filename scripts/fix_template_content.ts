/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Fix Template Content Script
 * 
 * Replaces generic template content in lessons with subject-specific educational content.
 * These lessons have placeholder text like "Explore the concepts and skills of..."
 * 
 * Run: npx tsx scripts/fix_template_content.ts [--apply]
 */

import 'dotenv/config';
import * as fs from 'fs';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

interface LessonWithModule {
    id: number;
    title: string;
    content: string;
    modules: {
        id: number;
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

// Content generators by topic
const MATH_CONTENT_TEMPLATES: Record<string, (grade: number) => string> = {
    'Coordinate Geometry': (grade) => `# Coordinate Geometry

## Learning Goals

By the end of this lesson, you will be able to:
- Plot points and identify coordinates on the coordinate plane
- Calculate distance between two points
- Find the midpoint of a line segment
- Apply coordinate geometry to solve real-world problems

## Introduction

Coordinate geometry connects algebra and geometry by using numbers to describe positions and shapes. Imagine a map of your city - every location can be described using street numbers and avenue numbers. That's exactly what a coordinate plane does!

## Key Concepts

### The Coordinate Plane

The coordinate plane has two perpendicular number lines:
- The **x-axis** runs horizontally (left and right)
- The **y-axis** runs vertically (up and down)
- The point where they meet is called the **origin** (0, 0)

Every point on the plane is identified by an **ordered pair** (x, y), where x tells you how far to move horizontally and y tells you how far to move vertically.

### Plotting Points

To plot a point like (3, 4):
1. Start at the origin
2. Move 3 units to the right (positive x)
3. Move 4 units up (positive y)
4. Mark the point!

### The Four Quadrants

The axes divide the plane into four quadrants:
- **Quadrant I**: (+, +) - both coordinates positive
- **Quadrant II**: (-, +) - negative x, positive y
- **Quadrant III**: (-, -) - both coordinates negative  
- **Quadrant IV**: (+, -) - positive x, negative y

## 💡 Example

**Problem:** Plot the points A(2, 5), B(-3, 4), and C(4, -2). In which quadrant is each point?

**Solution:**
- Point A(2, 5): Move 2 right, 5 up → **Quadrant I**
- Point B(-3, 4): Move 3 left, 4 up → **Quadrant II**
- Point C(4, -2): Move 4 right, 2 down → **Quadrant IV**

## Key Vocabulary

- **Coordinate plane**: A two-dimensional surface formed by two perpendicular number lines
- **Origin**: The point (0, 0) where the x-axis and y-axis intersect
- **Ordered pair**: A pair of numbers (x, y) that identifies a point on the coordinate plane
- **Quadrant**: One of the four regions created by the x-axis and y-axis

## Summary

Coordinate geometry gives us a powerful way to describe locations using numbers. By understanding the coordinate plane, you can solve problems involving distance, position, and geometric shapes using algebraic methods.
`,

    'Pythagorean Theorem': (grade) => `# The Pythagorean Theorem

## Learning Goals

By the end of this lesson, you will be able to:
- State and explain the Pythagorean Theorem
- Use the theorem to find unknown side lengths in right triangles
- Apply the Pythagorean Theorem to real-world problems
- Determine if a triangle is a right triangle using the converse

## Introduction

The Pythagorean Theorem is one of the most famous and useful theorems in mathematics! It was discovered over 2,500 years ago, but we still use it today for everything from building houses to programming video games.

## Key Concepts

### What is the Pythagorean Theorem?

In any right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.

**Formula:** a² + b² = c²

Where:
- **a** and **b** are the legs (the sides that form the right angle)
- **c** is the hypotenuse (the side opposite the right angle - always the longest side)

### Using the Theorem

**Finding the hypotenuse:** If you know both legs, solve for c:
c = √(a² + b²)

**Finding a leg:** If you know the hypotenuse and one leg, solve for the other leg:
a = √(c² - b²)

## 💡 Example

**Problem:** A ladder is leaning against a wall. The base of the ladder is 6 feet from the wall, and the ladder reaches 8 feet up the wall. How long is the ladder?

**Solution:**
- The ground (6 ft) and wall (8 ft) form the right angle, so they are the legs
- The ladder is the hypotenuse
- c² = 6² + 8² = 36 + 64 = 100
- c = √100 = **10 feet**

The ladder is 10 feet long!

### Pythagorean Triples

Some sets of whole numbers satisfy the Pythagorean Theorem perfectly:
- 3, 4, 5 (3² + 4² = 9 + 16 = 25 = 5²)
- 5, 12, 13
- 8, 15, 17

## Key Vocabulary

- **Right triangle**: A triangle with one 90-degree angle
- **Hypotenuse**: The longest side of a right triangle, opposite the right angle
- **Legs**: The two shorter sides of a right triangle that form the right angle
- **Pythagorean triple**: Three whole numbers that satisfy a² + b² = c²

## Summary

The Pythagorean Theorem (a² + b² = c²) lets us find unknown side lengths in right triangles. It has countless practical applications in construction, navigation, and everyday problem-solving.
`,

    'Similarity & Congruence': (grade) => `# Similarity and Congruence

## Learning Goals

By the end of this lesson, you will be able to:
- Identify and describe congruent figures
- Identify and describe similar figures
- Find unknown measurements using similarity
- Apply congruence and similarity to solve problems

## Introduction

Have you ever noticed that a photograph looks exactly like reality, just smaller? Or that two identical puzzle pieces fit in exactly the same spot? These are examples of similarity and congruence - two important geometric relationships.

## Key Concepts

### Congruent Figures

Two figures are **congruent** if they have exactly the same shape AND the same size. You could place one on top of the other and they would match perfectly.

**Congruent figures have:**
- Equal corresponding angles
- Equal corresponding side lengths

We write congruence using the symbol: ≅

### Similar Figures

Two figures are **similar** if they have the same shape but may be different sizes. One is like a scaled version of the other.

**Similar figures have:**
- Equal corresponding angles
- Proportional corresponding side lengths

We write similarity using the symbol: ~

### Scale Factor

The **scale factor** is the ratio of corresponding side lengths between similar figures. If triangle ABC is similar to triangle DEF with a scale factor of 2, then every side of DEF is twice as long as the corresponding side of ABC.

## 💡 Example

**Problem:** Triangle ABC ~ Triangle DEF. If AB = 6 cm, BC = 8 cm, and DE = 9 cm, find EF.

**Solution:**
1. Find the scale factor: DE/AB = 9/6 = 1.5
2. Apply to find EF: EF = BC × 1.5 = 8 × 1.5 = **12 cm**

## Key Vocabulary

- **Congruent**: Same shape and same size
- **Similar**: Same shape, possibly different sizes
- **Corresponding parts**: Parts that match up between two figures
- **Scale factor**: The ratio of corresponding lengths in similar figures

## Summary

Congruent figures are identical in shape and size, while similar figures have the same shape but may differ in size. These relationships help us solve problems involving proportions and geometric reasoning.
`,

    'Functions': (grade) => `# Introduction to Functions

## Learning Goals

By the end of this lesson, you will be able to:
- Define what a function is
- Identify functions from tables, graphs, and equations
- Use function notation
- Evaluate functions for given inputs

## Introduction

A function is like a machine: you put something in, something comes out, and the same input always produces the same output. Functions are everywhere - from calculating the cost of items at a store to predicting the weather!

## Key Concepts

### What is a Function?

A **function** is a rule that assigns each input exactly one output. Think of it as a dependable relationship between two quantities.

**Key property:** For every input, there is exactly one output.

### Function Notation

We use f(x) to represent a function called "f" with input "x". For example:
- f(x) = 2x + 3 means "take x, multiply by 2, then add 3"
- f(4) = 2(4) + 3 = 11

### Identifying Functions

A relationship is a function if each input has exactly one output. 

**The Vertical Line Test:** On a graph, if any vertical line touches the graph more than once, it's NOT a function.

### Domain and Range

- **Domain**: All possible input values
- **Range**: All possible output values

## 💡 Example

**Problem:** For f(x) = 3x - 1, find f(5).

**Solution:**
- Replace x with 5: f(5) = 3(5) - 1
- Calculate: f(5) = 15 - 1 = **14**

## Key Vocabulary

- **Function**: A rule assigning each input exactly one output
- **Input**: The value you put into a function (x)
- **Output**: The value that comes out of a function (f(x) or y)
- **Domain**: The set of all possible inputs
- **Range**: The set of all possible outputs

## Summary

Functions describe predictable relationships where each input produces exactly one output. Understanding functions is fundamental to algebra and helps us model real-world situations mathematically.
`,

    'Expressions & Equations': (grade) => `# Expressions and Equations

## Learning Goals

By the end of this lesson, you will be able to:
- Write and simplify algebraic expressions
- Solve one-step and two-step equations
- Translate word problems into equations
- Check solutions to equations

## Introduction

Algebra is like a puzzle where we find unknown values. Instead of guessing, we use mathematical operations to solve for exactly what we need. This skill is used by scientists, engineers, economists, and many other professionals every day!

## Key Concepts

### Algebraic Expressions

An **expression** is a mathematical phrase that contains numbers, variables, and operations.

**Examples:**
- 3x + 5
- 2(n - 4)
- x² + 7

### Simplifying Expressions

Combine **like terms** (terms with the same variable and exponent):
- 4x + 3x = 7x
- 5y - 2y + 8 = 3y + 8

### Equations

An **equation** states that two expressions are equal. Equations have an equals sign (=).

**Example:** 2x + 5 = 13

### Solving Equations

Use **inverse operations** to isolate the variable:
- Addition and subtraction are inverses
- Multiplication and division are inverses

**Goal:** Get the variable alone on one side

## 💡 Example

**Problem:** Solve 3x + 7 = 22

**Solution:**
1. Subtract 7 from both sides: 3x + 7 - 7 = 22 - 7
2. Simplify: 3x = 15
3. Divide both sides by 3: x = 15 ÷ 3
4. **x = 5**

**Check:** 3(5) + 7 = 15 + 7 = 22 ✓

## Key Vocabulary

- **Variable**: A letter that represents an unknown number
- **Expression**: A mathematical phrase with numbers, variables, and operations
- **Equation**: A statement that two expressions are equal
- **Inverse operations**: Operations that undo each other

## Summary

Expressions and equations are the foundation of algebra. By using inverse operations, we can solve for unknown values and apply these skills to real-world problems.
`,

    'Integers & Rational Numbers': (grade) => `# Integers and Rational Numbers

## Learning Goals

By the end of this lesson, you will be able to:
- Identify and compare integers and rational numbers
- Perform operations with negative numbers
- Plot rational numbers on a number line
- Solve real-world problems involving rational numbers

## Introduction

Have you ever seen a temperature below zero? Or a bank account with a negative balance? Negative numbers help us describe quantities less than zero, and rational numbers let us express parts of wholes. Together, they expand our number toolkit!

## Key Concepts

### Integers

**Integers** are whole numbers and their opposites: ..., -3, -2, -1, 0, 1, 2, 3, ...

- Positive integers are greater than 0
- Negative integers are less than 0
- Zero is neither positive nor negative

### Rational Numbers

A **rational number** is any number that can be written as a fraction a/b where a and b are integers and b ≠ 0.

**Examples:** 3/4, -2.5, 7, -1/2, 0.75

### Adding and Subtracting Integers

**Same signs:** Add the absolute values, keep the sign
- (-5) + (-3) = -8

**Different signs:** Subtract the absolute values, use the sign of the larger absolute value
- (-7) + 4 = -3

### Multiplying and Dividing Integers

- Positive × Positive = Positive
- Negative × Negative = Positive
- Positive × Negative = Negative

## 💡 Example

**Problem:** The temperature dropped from 8°F to -5°F. What was the total change?

**Solution:**
- Change = Final - Initial = -5 - 8 = **-13°F**
- The temperature dropped 13 degrees.

## Key Vocabulary

- **Integer**: A positive or negative whole number, or zero
- **Rational number**: A number expressible as a fraction of two integers
- **Absolute value**: The distance from zero on the number line
- **Opposite**: Numbers the same distance from zero on opposite sides

## Summary

Integers and rational numbers extend our number system to include negatives and fractions. These numbers are essential for describing real-world quantities like temperature, money, and measurements.
`,

    'Percent & Rates': (grade) => `# Percent and Rates

## Learning Goals

By the end of this lesson, you will be able to:
- Convert between fractions, decimals, and percents
- Calculate percentages of quantities
- Solve problems involving percent increase and decrease
- Work with unit rates and proportions

## Introduction

Percents are everywhere! Sales discounts, test scores, battery life, and statistics all use percentages. Understanding percents helps you make smart decisions about money, health, and more.

## Key Concepts

### What is a Percent?

**Percent** means "per hundred." 25% means 25 out of 100, or 25/100.

**Conversions:**
- Percent to decimal: Divide by 100 (45% = 0.45)
- Decimal to percent: Multiply by 100 (0.75 = 75%)
- Fraction to percent: Convert to decimal, then to percent (3/4 = 0.75 = 75%)

### Finding a Percent of a Number

To find a percent of a number, convert the percent to a decimal and multiply.

**Formula:** Part = Percent × Whole

### Percent Increase and Decrease

**Percent change = (Change ÷ Original) × 100**

- If the result is positive: percent increase
- If the result is negative: percent decrease

### Unit Rates

A **unit rate** compares a quantity to one unit of another quantity.

**Example:** 150 miles in 3 hours → 150 ÷ 3 = 50 miles per hour

## 💡 Example

**Problem:** A jacket originally costs $80 and is on sale for 25% off. What is the sale price?

**Solution:**
1. Find the discount: 25% of $80 = 0.25 × 80 = $20
2. Subtract from original: $80 - $20 = **$60**

## Key Vocabulary

- **Percent**: A ratio expressing a number as a fraction of 100
- **Unit rate**: A rate with a denominator of 1
- **Percent increase**: The percent by which a value grows
- **Percent decrease**: The percent by which a value shrinks

## Summary

Percents express parts per hundred and are used in countless real-world situations. Combined with unit rates, these concepts help us compare values and make informed decisions.
`,

    'Ratios & Proportional Reasoning': (grade) => `# Ratios and Proportional Reasoning

## Learning Goals

By the end of this lesson, you will be able to:
- Write and simplify ratios
- Identify proportional relationships
- Solve problems using proportions
- Apply proportional reasoning to real-world situations

## Introduction

Have you ever doubled a recipe? Or figured out how long a trip will take based on your speed? You were using proportional reasoning! Ratios and proportions help us compare quantities and solve problems involving scaling.

## Key Concepts

### What is a Ratio?

A **ratio** compares two quantities. It can be written as:
- a to b
- a:b
- a/b

### Equivalent Ratios

Ratios are **equivalent** if they represent the same comparison.

**Example:** 2:3 is equivalent to 4:6 and 6:9 (all simplify to 2:3)

### Proportions

A **proportion** is an equation stating that two ratios are equal.

**Example:** 2/3 = 4/6

### Solving Proportions

Use **cross multiplication**: If a/b = c/d, then a × d = b × c

### Proportional Relationships

In a proportional relationship, the ratio between two quantities is constant.

**Example:** If y = 5x, then y and x are proportional with a constant ratio of 5.

## 💡 Example

**Problem:** If 3 notebooks cost $7.50, how much do 7 notebooks cost?

**Solution:**
1. Set up proportion: 3/7.50 = 7/x
2. Cross multiply: 3x = 7.50 × 7 = 52.50
3. Solve: x = 52.50 ÷ 3 = **$17.50**

## Key Vocabulary

- **Ratio**: A comparison of two quantities
- **Proportion**: An equation showing two ratios are equal
- **Constant of proportionality**: The constant ratio in a proportional relationship
- **Equivalent ratios**: Different ratios that represent the same relationship

## Summary

Ratios compare quantities, and proportions help us solve problems where that comparison stays consistent. Proportional reasoning is fundamental to scaling, unit conversion, and mathematical modeling.
`
};

function getContentForTopic(title: string, grade: number): string | null {
    // Try to match the topic
    for (const [topic, generator] of Object.entries(MATH_CONTENT_TEMPLATES)) {
        if (title.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(title.toLowerCase().replace(/\(.*\)/g, '').trim())) {
            return generator(grade);
        }
    }

    // Check for partial matches
    if (title.includes('Coordinate')) return MATH_CONTENT_TEMPLATES['Coordinate Geometry'](grade);
    if (title.includes('Pythagorean')) return MATH_CONTENT_TEMPLATES['Pythagorean Theorem'](grade);
    if (title.includes('Similar') || title.includes('Congruence')) return MATH_CONTENT_TEMPLATES['Similarity & Congruence'](grade);
    if (title.includes('Function')) return MATH_CONTENT_TEMPLATES['Functions'](grade);
    if (title.includes('Expression') || title.includes('Equation')) return MATH_CONTENT_TEMPLATES['Expressions & Equations'](grade);
    if (title.includes('Integer') || title.includes('Rational')) return MATH_CONTENT_TEMPLATES['Integers & Rational Numbers'](grade);
    if (title.includes('Percent') || title.includes('Rate')) return MATH_CONTENT_TEMPLATES['Percent & Rates'](grade);
    if (title.includes('Ratio') || title.includes('Proportion')) return MATH_CONTENT_TEMPLATES['Ratios & Proportional Reasoning'](grade);

    return null;
}

function hasTemplateContent(content: string): boolean {
    const patterns = [
        /Explore the concepts and skills of/i,
        /Develop understanding and apply learning/i,
        /Build fluency and confidence with/i,
    ];
    return patterns.some(p => p.test(content));
}

async function fetchTemplateContentLessons(): Promise<LessonWithModule[]> {
    // Read the audit report to get lesson IDs
    const reportPath = 'data/audits/content_quality_report.json';

    if (!fs.existsSync(reportPath)) {
        console.error('Audit report not found. Run: npx tsx scripts/audit_content_quality.ts first');
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const templateIssues = report.issues.filter(
        (issue: any) => issue.issueType === 'template_content'
    );

    console.log(`Found ${templateIssues.length} lessons with template content in audit report`);

    const lessonIds = [...new Set(templateIssues.map((i: any) => i.lessonId))];

    const { data, error } = await supabase
        .from('lessons')
        .select(`
            id, 
            title, 
            content,
            modules (
                id,
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

    return (data || []) as unknown as LessonWithModule[];
}

async function fixTemplateContent(apply: boolean = false) {
    console.log('============================================================');
    console.log('FIX TEMPLATE CONTENT');
    console.log('============================================================');
    console.log(`Mode: ${apply ? 'APPLY (making changes)' : 'DRY RUN (preview only)'}\n`);

    const lessons = await fetchTemplateContentLessons();

    // Filter to only lessons that still have template content
    const lessonsNeedingFix = lessons.filter(lesson => hasTemplateContent(lesson.content));
    console.log(`Lessons still needing fix: ${lessonsNeedingFix.length}\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const lesson of lessonsNeedingFix) {
        const grade = parseInt(lesson.modules?.grade_band || '6') || 6;
        const newContent = getContentForTopic(lesson.title, grade);

        if (!newContent) {
            console.log(`  ⚠️  No content template for: ${lesson.title}`);
            skipped++;
            continue;
        }

        console.log(`  📝 ${lesson.title} (Grade ${grade})`);

        if (apply) {
            const { error } = await supabase
                .from('lessons')
                .update({ content: newContent })
                .eq('id', lesson.id);

            if (error) {
                console.error(`    Error: ${error.message}`);
                errors++;
            } else {
                fixed++;
            }
        } else {
            fixed++;
        }
    }

    console.log('\n============================================================');
    console.log('SUMMARY');
    console.log('============================================================');
    console.log(`Lessons processed: ${lessonsNeedingFix.length}`);
    console.log(`Lessons ${apply ? 'fixed' : 'to fix'}: ${fixed}`);
    console.log(`Lessons skipped (no template): ${skipped}`);
    if (errors > 0) {
        console.log(`Errors: ${errors}`);
    }

    if (!apply) {
        console.log('\n💡 Run with --apply to make changes');
    } else {
        console.log('\n✅ Changes applied successfully');
    }
}

// Main execution
const apply = process.argv.includes('--apply');
fixTemplateContent(apply).catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
});
