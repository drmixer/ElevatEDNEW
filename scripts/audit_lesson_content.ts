import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface LessonAudit {
    id: number;
    title: string;
    grade_band: string;
    subject: string;
    hasContent: boolean;
    contentLength: number;
    hasTitle: boolean;
    hasLearningGoals: boolean;
    hasExternalLink: boolean;
    hasVideo: boolean;
    hasImage: boolean;
    hasMediaUrl: boolean;
    mediaType: string | null;
    firstSection: string;
    issues: string[];
}

async function auditLessons() {
    console.log('=== LESSON CONTENT AUDIT ===\n');

    // Get all lessons with pagination
    let allLessons: any[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data } = await supabase
            .from('lessons')
            .select('id, title, content, media_url, media, module_id, modules(grade_band, subject)')
            .range(start, start + pageSize - 1);

        if (!data || data.length === 0) break;
        allLessons.push(...data);
        start += pageSize;
        if (data.length < pageSize) break;
    }

    console.log(`Auditing ${allLessons.length} lessons...\n`);

    const audits: LessonAudit[] = [];
    const issuesByType: Record<string, number> = {};

    for (const lesson of allLessons) {
        const content = lesson.content || '';
        const issues: string[] = [];

        // Check for title (# header)
        const hasTitle = /^#\s+.+/m.test(content);
        if (!hasTitle) issues.push('no_title');

        // Check for learning goals
        const hasLearningGoals = /##\s*(Learning\s*Goals?|Objectives?|Goals?)/i.test(content);
        if (!hasLearningGoals) issues.push('no_learning_goals');

        // Check for external links
        const hasExternalLink = /https?:\/\/[^\s)]+/i.test(content);

        // Check for video embed or link
        const hasVideo = /youtube|vimeo|video|\.mp4|\.webm/i.test(content) ||
            /\[.*video.*\]/i.test(content) ||
            (lesson.media_url && /video|youtube|vimeo/i.test(lesson.media_url));

        // Check for image
        const hasImage = /!\[.*\]\(.*\)/i.test(content) ||
            /\.jpg|\.png|\.gif|\.webp/i.test(content);

        // Check media field
        const hasMediaUrl = !!lesson.media_url;
        const mediaArray = Array.isArray(lesson.media) ? lesson.media : [];
        const mediaType = hasMediaUrl ? 'url' : (mediaArray.length > 0 ? 'array' : null);

        // Check content length
        const contentLength = content.length;
        if (contentLength < 200) issues.push('very_short_content');
        else if (contentLength < 500) issues.push('short_content');

        // Get first section after title
        const lines = content.split('\n').filter((l: string) => l.trim());
        const firstSection = lines.slice(0, 3).join(' ').substring(0, 100);

        // Check if content has substantive learning material
        const hasSubstantiveContent = /learn|understand|explore|discover|concept|skill/i.test(content.substring(0, 500));

        if (!hasSubstantiveContent && contentLength > 100) {
            issues.push('no_learning_content');
        }

        // Check for resource visibility
        const hasResourceAtTop = hasExternalLink || hasVideo || hasImage || hasMediaUrl;
        if (!hasResourceAtTop && !hasSubstantiveContent) {
            issues.push('no_resource_visible');
        }

        // Track issues
        for (const issue of issues) {
            issuesByType[issue] = (issuesByType[issue] || 0) + 1;
        }

        audits.push({
            id: lesson.id,
            title: lesson.title,
            grade_band: (lesson.modules as any)?.grade_band || 'unknown',
            subject: (lesson.modules as any)?.subject || 'unknown',
            hasContent: contentLength > 0,
            contentLength,
            hasTitle,
            hasLearningGoals,
            hasExternalLink,
            hasVideo,
            hasImage,
            hasMediaUrl,
            mediaType,
            firstSection,
            issues,
        });
    }

    // Summary statistics
    console.log('📊 SUMMARY STATISTICS\n');
    console.log(`Total lessons: ${audits.length}`);
    console.log(`With content: ${audits.filter(a => a.hasContent).length}`);
    console.log(`With title (#): ${audits.filter(a => a.hasTitle).length}`);
    console.log(`With Learning Goals: ${audits.filter(a => a.hasLearningGoals).length}`);
    console.log(`With external links: ${audits.filter(a => a.hasExternalLink).length}`);
    console.log(`With video: ${audits.filter(a => a.hasVideo).length}`);
    console.log(`With images: ${audits.filter(a => a.hasImage).length}`);
    console.log(`With media_url: ${audits.filter(a => a.hasMediaUrl).length}`);

    console.log('\n🚨 ISSUES BY TYPE\n');
    for (const [issue, count] of Object.entries(issuesByType).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / audits.length) * 100).toFixed(1);
        console.log(`  ${issue}: ${count} (${pct}%)`);
    }

    // Sample lessons with issues
    console.log('\n📝 SAMPLE LESSONS WITH ISSUES\n');
    const hasIssues = audits.filter(a => a.issues.length > 0);
    for (const audit of hasIssues.slice(0, 10)) {
        console.log(`ID ${audit.id} | Grade ${audit.grade_band} | ${audit.subject}`);
        console.log(`  Title: ${audit.title?.substring(0, 50)}...`);
        console.log(`  Issues: ${audit.issues.join(', ')}`);
        console.log(`  Length: ${audit.contentLength} chars`);
        console.log('');
    }

    // Sample good lessons
    console.log('\n✅ SAMPLE WELL-FORMATTED LESSONS\n');
    const goodLessons = audits.filter(a =>
        a.issues.length === 0 &&
        a.hasTitle &&
        a.hasLearningGoals &&
        a.contentLength > 500
    );

    for (const audit of goodLessons.slice(0, 5)) {
        console.log(`ID ${audit.id} | Grade ${audit.grade_band} | ${audit.subject}`);
        console.log(`  Title: ${audit.title?.substring(0, 60)}`);
        console.log(`  Length: ${audit.contentLength} chars`);
        console.log(`  Has video: ${audit.hasVideo} | Has link: ${audit.hasExternalLink}`);
        console.log('');
    }

    // Content structure analysis
    console.log('\n📖 CONTENT STRUCTURE ANALYSIS\n');

    // Check common section headers
    const sectionPatterns = {
        'Learning Goals': /##\s*Learning Goals?/i,
        'Launch': /##\s*Launch/i,
        'Guided Exploration': /##\s*Guided/i,
        'Collaborative Practice': /##\s*Collaborative/i,
        'Exit Ticket': /##\s*Exit/i,
        'Extensions': /##\s*Extension/i,
        'Key Vocabulary': /##\s*(Key\s*)?Vocabulary|##\s*Key Terms/i,
        'Introduction': /##\s*Introduction|##\s*Intro/i,
        'Summary': /##\s*Summary/i,
    };

    for (const [name, pattern] of Object.entries(sectionPatterns)) {
        const count = audits.filter(a => pattern.test(a.firstSection) ||
            pattern.test(allLessons.find(l => l.id === a.id)?.content || '')).length;
        const pct = ((count / audits.length) * 100).toFixed(1);
        console.log(`  ${name}: ${count} (${pct}%)`);
    }
}

auditLessons();
