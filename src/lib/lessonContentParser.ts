/**
 * Lesson Content Parser
 * 
 * Parses markdown lesson content into a structured format
 * for the step-by-step lesson experience.
 */

import type {
    LessonContentStructure,
    LessonSection,
    VocabularyTerm,
    LessonResource,
} from '../types/lesson';

// Common section title patterns
const SECTION_PATTERNS = {
    objectives: /^(learning\s*goals?|what\s*you('ll)?\s*learn|objectives?)/i,
    introduction: /^(introduction|overview|getting\s*started)/i,
    concept: /^(key\s*concepts?|understanding|concepts?|main\s*idea|core\s*concepts?)/i,
    practice: /^(let'?s\s*practice|practice|try\s*it|your\s*turn|guided\s*practice)/i,
    vocabulary: /^(key\s*vocabulary|vocabulary|terms?|definitions?|glossary)/i,
    summary: /^(summary|review|key\s*takeaways?|wrap[\s-]*up|conclusion)/i,
    resources: /^(additional\s*resources?|resources?|further\s*reading|learn\s*more)/i,
} as const;

/**
 * Categorize a section based on its title
 */
function categorizeSectionType(title: string): LessonSection['type'] {
    const normalized = title.toLowerCase().trim();

    if (SECTION_PATTERNS.concept.test(normalized)) return 'concept';
    if (SECTION_PATTERNS.practice.test(normalized)) return 'activity';
    if (/example/i.test(normalized)) return 'example';
    if (/explain/i.test(normalized)) return 'explanation';

    return 'general';
}

/**
 * Extract objectives from a markdown section
 */
function extractObjectives(content: string): string[] {
    const objectives: string[] = [];

    // Match bullet points or numbered lists
    const listItemPattern = /^[\s]*[-*•]\s*(.+)$|^[\s]*\d+[.):]\s*(.+)$/gm;
    let match;

    while ((match = listItemPattern.exec(content)) !== null) {
        const item = (match[1] || match[2])?.trim();
        if (item && item.length > 5 && item.length < 200) {
            objectives.push(item);
        }
    }

    return objectives;
}

/**
 * Extract vocabulary terms from a markdown section
 */
function extractVocabulary(content: string): VocabularyTerm[] {
    const terms: VocabularyTerm[] = [];

    // Pattern 1: **Term**: Definition
    const boldColonPattern = /\*\*([^*]+)\*\*:\s*(.+?)(?=\n\*\*|\n\n|$)/gs;
    let match;

    while ((match = boldColonPattern.exec(content)) !== null) {
        const term = match[1]?.trim();
        const definition = match[2]?.trim().replace(/\n/g, ' ');
        if (term && definition) {
            terms.push({ term, definition });
        }
    }

    // Pattern 2: - **Term** - Definition or - Term: Definition
    if (terms.length === 0) {
        const listTermPattern = /^[\s]*[-*•]\s*\*?\*?([^:*\n]+)\*?\*?\s*[-–:]\s*(.+)$/gm;
        while ((match = listTermPattern.exec(content)) !== null) {
            const term = match[1]?.trim();
            const definition = match[2]?.trim();
            if (term && definition && term.length < 50) {
                terms.push({ term, definition });
            }
        }
    }

    return terms;
}

/**
 * Extract resources/links from a markdown section
 */
function extractResources(content: string): LessonResource[] {
    const resources: LessonResource[] = [];

    // Pattern: [Title](URL) or just URLs
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
        const title = match[1]?.trim();
        const url = match[2]?.trim();

        if (title && url && url.startsWith('http')) {
            let type: LessonResource['type'] = 'link';

            // Categorize by URL
            if (/youtube|vimeo|video/i.test(url)) {
                type = 'video';
            } else if (/docs|pdf|document/i.test(url)) {
                type = 'document';
            } else if (/interactive|simulation|game/i.test(url)) {
                type = 'interactive';
            } else if (/article|blog|medium|news/i.test(url)) {
                type = 'article';
            }

            resources.push({ title, url, type });
        }
    }

    return resources;
}

/**
 * Extract a hook/teaser from the introduction content
 */
function extractHook(content: string): string | undefined {
    const raw = (content ?? '').toString();
    if (!raw.trim()) return undefined;

    // Strip common front-matter / metadata-ish lines that show up in some lessons.
    const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^#{1,6}\s+/.test(line))
        .filter((line) => !/(^|\s)\*\*(grade|subject|estimated time)\s*:\*\*/i.test(line))
        .filter((line) => !/(^|\s)(grade|subject|estimated time)\s*:/i.test(line))
        .filter((line) => !/^\|/.test(line)); // tables

    const cleaned = lines
        .join(' ')
        .replace(/\*\*/g, '')
        .replace(/[_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return undefined;

    // Get first 1-2 sentences (or a short leading chunk if no punctuation).
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const hookCandidate = (sentences.length > 1 ? sentences.slice(0, 2).join(' ') : cleaned).trim();

    const hook = hookCandidate.length > 300 ? `${hookCandidate.slice(0, 300).trim()}…` : hookCandidate;
    if (hook.length > 20) {
        return hook;
    }

    return undefined;
}

/**
 * Split markdown content into sections based on ## headers
 */
function splitIntoSections(markdown: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = [];

    // Split by ## headers
    const parts = markdown.split(/^##\s+(.+)$/gm);

    // First part before any ## is intro (if it has content)
    const intro = parts[0]?.trim();
    if (intro && intro.length > 50) {
        sections.push({ title: 'Introduction', content: intro });
    }

    // Process remaining parts (alternating: title, content, title, content...)
    for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i]?.trim();
        const content = parts[i + 1]?.trim();

        if (title && content) {
            sections.push({ title, content });
        }
    }

    return sections;
}

/**
 * Main parser function - converts markdown to structured lesson content
 */
export function parseLessonContent(
    markdown: string,
    options: {
        title?: string;
        subject?: string;
        gradeBand?: string;
        estimatedMinutes?: number | null;
    } = {}
): LessonContentStructure {
    const {
        title = 'Lesson',
        subject = '',
        gradeBand = '',
        estimatedMinutes = null,
    } = options;

    const rawSections = splitIntoSections(markdown);

    // Initialize structure
    const result: LessonContentStructure = {
        welcome: {
            title,
            subject,
            gradeBand,
            objectives: [],
            estimatedMinutes,
            hook: undefined,
        },
        learnSections: [],
        vocabulary: [],
        summary: null,
        resources: [],
        rawContent: markdown,
    };

    // Process each section
    for (const section of rawSections) {
        const titleLower = section.title.toLowerCase();

        // Check for objectives section
        if (SECTION_PATTERNS.objectives.test(titleLower)) {
            result.welcome.objectives = extractObjectives(section.content);
            continue;
        }

        // Check for introduction - extract hook
        if (SECTION_PATTERNS.introduction.test(titleLower)) {
            result.welcome.hook = extractHook(section.content);
            // Also add as a learn section
            result.learnSections.push({
                id: `section-${result.learnSections.length}`,
                title: section.title,
                content: section.content,
                type: 'explanation',
            });
            continue;
        }

        // Check for vocabulary section
        if (SECTION_PATTERNS.vocabulary.test(titleLower)) {
            result.vocabulary = extractVocabulary(section.content);
            continue;
        }

        // Check for summary section
        if (SECTION_PATTERNS.summary.test(titleLower)) {
            result.summary = section.content;
            continue;
        }

        // Check for resources section
        if (SECTION_PATTERNS.resources.test(titleLower)) {
            result.resources = extractResources(section.content);
            continue;
        }

        // Default: add as a learn section
        result.learnSections.push({
            id: `section-${result.learnSections.length}`,
            title: section.title,
            content: section.content,
            type: categorizeSectionType(section.title),
        });
    }

    // If no sections were created, create one from the raw content
    if (result.learnSections.length === 0 && markdown.trim().length > 0) {
        result.learnSections.push({
            id: 'section-0',
            title: 'Lesson Content',
            content: markdown,
            type: 'general',
        });
    }

    // If no objectives found but we have content, try to generate some
    if (result.welcome.objectives.length === 0 && result.learnSections.length > 0) {
        // Use section titles as pseudo-objectives
        result.welcome.objectives = result.learnSections
            .slice(0, 4)
            .map((s) => `Understand ${s.title.toLowerCase()}`);
    }

    return result;
}

/**
 * Utility to merge adjacent short sections
 */
export function consolidateSections(
    sections: LessonSection[],
    minContentLength = 200
): LessonSection[] {
    const consolidated: LessonSection[] = [];

    for (const section of sections) {
        const lastSection = consolidated[consolidated.length - 1];

        // Merge short sections with previous
        if (
            lastSection &&
            section.content.length < minContentLength &&
            lastSection.content.length < minContentLength
        ) {
            lastSection.content += '\n\n## ' + section.title + '\n\n' + section.content;
            continue;
        }

        consolidated.push({ ...section });
    }

    return consolidated;
}

export default parseLessonContent;
