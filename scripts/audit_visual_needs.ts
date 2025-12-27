/**
 * Visual Content Needs Audit
 * 
 * Analyzes lessons to identify which ones would benefit most from:
 * - Images/diagrams (for abstract concepts)
 * - Videos (for demonstrations/processes)
 * - Interactive resources (for practice)
 * 
 * Prioritizes by subject and concept type.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Keywords that indicate visual aids would help
const VISUAL_BENEFIT_KEYWORDS = {
    // Math - geometry, fractions, graphs
    highVisual: [
        /geometry/i, /shape/i, /triangle/i, /circle/i, /rectangle/i, /polygon/i,
        /graph/i, /chart/i, /plot/i, /coordinate/i, /number line/i,
        /fraction/i, /divide/i, /portion/i, /part of/i,
        /angle/i, /degree/i, /rotation/i,
        /area/i, /perimeter/i, /volume/i,
        /pattern/i, /sequence/i, /symmetry/i,
        /diagram/i, /model/i, /visual/i,
    ],
    // Science - experiments, life cycles, systems
    mediumVisual: [
        /experiment/i, /observe/i, /measure/i,
        /cycle/i, /process/i, /stage/i, /phase/i,
        /system/i, /organ/i, /cell/i, /plant/i, /animal/i,
        /planet/i, /solar/i, /weather/i, /climate/i,
        /force/i, /motion/i, /energy/i,
        /compare/i, /contrast/i, /difference/i,
        /map/i, /region/i, /location/i,
        /timeline/i, /history/i, /era/i,
    ],
    // Interactive benefit keywords
    interactive: [
        /practice/i, /solve/i, /calculate/i, /compute/i,
        /manipulate/i, /explore/i, /discover/i,
        /simulation/i, /virtual/i, /interactive/i,
    ],
    // Video benefit keywords
    video: [
        /demonstrate/i, /show how/i, /step by step/i,
        /procedure/i, /technique/i, /method/i,
        /real world/i, /example/i, /application/i,
        /story/i, /narrative/i, /journey/i,
    ]
};

// Subjects ordered by typical visual needs
const SUBJECT_VISUAL_PRIORITY: Record<string, number> = {
    'Mathematics': 10,
    'Science': 9,
    'Social Studies': 7,
    'English Language Arts': 5,
    'arts_music': 8,
    'health_pe': 6,
    'computer_science': 7,
    'financial_literacy': 6,
    'study_skills': 4,
};

interface LessonVisualAudit {
    id: number;
    title: string;
    gradeBand: string;
    subject: string;
    strand: string | null;
    topic: string | null;
    contentLength: number;
    hasImages: boolean;
    hasLinks: boolean;
    hasVideo: boolean;
    visualScore: number;
    interactiveScore: number;
    videoScore: number;
    overallPriority: number;
    recommendedResources: string[];
    conceptsForVisuals: string[];
}

interface AuditReport {
    timestamp: string;
    totalLessons: number;
    byPriority: {
        high: number;
        medium: number;
        low: number;
    };
    bySubject: Record<string, { count: number; avgPriority: number }>;
    topCandidates: LessonVisualAudit[];
    conceptsNeedingVisuals: Record<string, string[]>;
}

async function auditLessons(): Promise<AuditReport> {
    console.log('=== VISUAL CONTENT NEEDS AUDIT ===\n');

    // Fetch all lessons with module info
    const allLessons: Array<{
        id: number;
        title: string;
        content: string;
        modules: {
            grade_band: string;
            subject: string;
            strand: string | null;
            topic: string | null;
        } | null;
    }> = [];

    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, modules(grade_band, subject, strand, topic)')
            .range(start, start + pageSize - 1);

        if (error) {
            console.error('Error fetching lessons:', error.message);
            break;
        }

        if (!data || data.length === 0) break;
        allLessons.push(...(data as typeof allLessons));
        start += pageSize;
        if (data.length < pageSize) break;
    }

    console.log(`Auditing ${allLessons.length} lessons...\n`);

    const audits: LessonVisualAudit[] = [];

    for (const lesson of allLessons) {
        const content = lesson.content || '';
        const module = lesson.modules;

        const gradeBand = module?.grade_band || 'Unknown';
        const subject = module?.subject || 'Unknown';
        const strand = module?.strand || null;
        const topic = module?.topic || null;

        // Check for existing visuals
        const hasImages = /!\[.*\]\(.*\)/i.test(content) || /\.jpg|\.png|\.gif|\.webp/i.test(content);
        const hasLinks = /https?:\/\/[^\s)]+/i.test(content);
        const hasVideo = /youtube|vimeo|video|\.mp4|\.webm/i.test(content);

        // Score visual needs
        let visualScore = 0;
        let interactiveScore = 0;
        let videoScore = 0;
        const conceptsForVisuals: string[] = [];

        // Check for high visual benefit keywords
        for (const pattern of VISUAL_BENEFIT_KEYWORDS.highVisual) {
            const matches = content.match(pattern);
            if (matches) {
                visualScore += 3;
                if (matches[0] && !conceptsForVisuals.includes(matches[0])) {
                    conceptsForVisuals.push(matches[0].toLowerCase());
                }
            }
        }

        // Check for medium visual benefit keywords
        for (const pattern of VISUAL_BENEFIT_KEYWORDS.mediumVisual) {
            if (pattern.test(content)) visualScore += 1;
        }

        // Check for interactive benefit keywords
        for (const pattern of VISUAL_BENEFIT_KEYWORDS.interactive) {
            if (pattern.test(content)) interactiveScore += 2;
        }

        // Check for video benefit keywords
        for (const pattern of VISUAL_BENEFIT_KEYWORDS.video) {
            if (pattern.test(content)) videoScore += 2;
        }

        // Adjust scores based on subject
        const subjectMultiplier = SUBJECT_VISUAL_PRIORITY[subject] || 5;
        visualScore = Math.round(visualScore * (subjectMultiplier / 10));

        // Reduce priority if already has resources
        if (hasImages) visualScore = Math.round(visualScore * 0.5);
        if (hasLinks) interactiveScore = Math.round(interactiveScore * 0.7);
        if (hasVideo) videoScore = Math.round(videoScore * 0.3);

        // Calculate overall priority
        const overallPriority = visualScore + interactiveScore + videoScore;

        // Generate recommendations
        const recommendedResources: string[] = [];
        if (visualScore >= 5) recommendedResources.push('diagrams', 'illustrations');
        if (interactiveScore >= 4) recommendedResources.push('interactive tool', 'practice simulation');
        if (videoScore >= 4) recommendedResources.push('video demonstration');

        // Check specific concepts
        if (/fraction/i.test(content)) recommendedResources.push('fraction visual model');
        if (/geometry|shape/i.test(content)) recommendedResources.push('geometric shapes diagram');
        if (/graph|plot/i.test(content)) recommendedResources.push('graphing examples');
        if (/cycle|process/i.test(content)) recommendedResources.push('process diagram');
        if (/map|region/i.test(content)) recommendedResources.push('educational map');

        audits.push({
            id: lesson.id,
            title: lesson.title,
            gradeBand,
            subject,
            strand,
            topic,
            contentLength: content.length,
            hasImages,
            hasLinks,
            hasVideo,
            visualScore,
            interactiveScore,
            videoScore,
            overallPriority,
            recommendedResources: [...new Set(recommendedResources)],
            conceptsForVisuals: [...new Set(conceptsForVisuals.slice(0, 5))],
        });
    }

    // Sort by priority
    audits.sort((a, b) => b.overallPriority - a.overallPriority);

    // Calculate statistics
    const highPriority = audits.filter(a => a.overallPriority >= 10).length;
    const mediumPriority = audits.filter(a => a.overallPriority >= 5 && a.overallPriority < 10).length;
    const lowPriority = audits.filter(a => a.overallPriority < 5).length;

    // Group by subject
    const bySubject: Record<string, { count: number; totalPriority: number }> = {};
    for (const audit of audits) {
        if (!bySubject[audit.subject]) {
            bySubject[audit.subject] = { count: 0, totalPriority: 0 };
        }
        bySubject[audit.subject].count++;
        bySubject[audit.subject].totalPriority += audit.overallPriority;
    }

    const bySubjectAvg: Record<string, { count: number; avgPriority: number }> = {};
    for (const [subject, data] of Object.entries(bySubject)) {
        bySubjectAvg[subject] = {
            count: data.count,
            avgPriority: Math.round(data.totalPriority / data.count * 10) / 10,
        };
    }

    // Get concepts needing visuals by subject
    const conceptsNeedingVisuals: Record<string, string[]> = {};
    for (const audit of audits.filter(a => a.overallPriority >= 8)) {
        if (!conceptsNeedingVisuals[audit.subject]) {
            conceptsNeedingVisuals[audit.subject] = [];
        }
        for (const concept of audit.conceptsForVisuals) {
            if (!conceptsNeedingVisuals[audit.subject].includes(concept)) {
                conceptsNeedingVisuals[audit.subject].push(concept);
            }
        }
    }

    // Print summary
    console.log('📊 SUMMARY\n');
    console.log(`Total lessons: ${allLessons.length}`);
    console.log(`High priority (need visuals): ${highPriority}`);
    console.log(`Medium priority: ${mediumPriority}`);
    console.log(`Low priority: ${lowPriority}`);

    console.log('\n📈 BY SUBJECT\n');
    for (const [subject, data] of Object.entries(bySubjectAvg).sort((a, b) => b[1].avgPriority - a[1].avgPriority)) {
        console.log(`  ${subject}: ${data.count} lessons, avg priority ${data.avgPriority}`);
    }

    console.log('\n🎯 TOP 20 CANDIDATES FOR VISUAL CONTENT\n');
    for (const audit of audits.slice(0, 20)) {
        console.log(`[${audit.id}] ${audit.title}`);
        console.log(`     ${audit.subject} | ${audit.gradeBand} | Priority: ${audit.overallPriority}`);
        if (audit.recommendedResources.length > 0) {
            console.log(`     Recommended: ${audit.recommendedResources.join(', ')}`);
        }
        console.log('');
    }

    console.log('\n🔑 CONCEPTS NEEDING VISUALS BY SUBJECT\n');
    for (const [subject, concepts] of Object.entries(conceptsNeedingVisuals)) {
        if (concepts.length > 0) {
            console.log(`  ${subject}: ${concepts.slice(0, 10).join(', ')}`);
        }
    }

    const report: AuditReport = {
        timestamp: new Date().toISOString(),
        totalLessons: allLessons.length,
        byPriority: {
            high: highPriority,
            medium: mediumPriority,
            low: lowPriority,
        },
        bySubject: bySubjectAvg,
        topCandidates: audits.slice(0, 300),
        conceptsNeedingVisuals,
    };

    return report;
}

async function main() {
    const report = await auditLessons();

    // Save report
    const outputPath = path.resolve(process.cwd(), 'data/audits/visual_needs_audit.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Report saved to ${outputPath}`);
}

main().catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
});
