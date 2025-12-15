import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, BookOpen, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LessonResourcePanelProps {
    lessonTitle: string;
    lessonContent: string;
    attributionBlock?: string | null;
    isCollapsed?: boolean;
    onToggle?: () => void;
}

/**
 * LessonResourcePanel - A collapsible panel that keeps lesson content accessible
 * during practice questions. Part of Phase 3: Context-Rich Lessons.
 * 
 * Key features:
 * - Collapsed by default during questions to reduce visual clutter
 * - "Read again" button to expand
 * - Smooth expand/collapse animation
 * - Scrolls to highlighted section when specified
 */
const LessonResourcePanel: React.FC<LessonResourcePanelProps> = ({
    lessonTitle,
    lessonContent,
    attributionBlock,
    isCollapsed = true,
    onToggle,
}) => {
    const [internalCollapsed, setInternalCollapsed] = useState(isCollapsed);

    const collapsed = onToggle ? isCollapsed : internalCollapsed;
    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalCollapsed(!internalCollapsed);
        }
    };

    // Extract a brief preview (first paragraph) from the content
    const getContentPreview = (): string => {
        const firstParagraph = lessonContent.split('\n\n')[0] || '';
        const text = firstParagraph.replace(/[#*_`]/g, '').trim();
        return text.length > 150 ? `${text.slice(0, 150)}...` : text;
    };

    return (
        <div className="bg-gradient-to-br from-brand-light-blue/30 to-white rounded-2xl border-2 border-brand-light-blue/50 shadow-sm overflow-hidden">
            {/* Header - Always visible */}
            <button
                type="button"
                onClick={handleToggle}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-brand-light-blue/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-teal flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                                📖 Lesson Material
                            </span>
                            {collapsed && (
                                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    Tap to read
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{lessonTitle}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {collapsed ? (
                        <>
                            <span className="text-sm font-semibold text-brand-blue hidden sm:inline">Read again</span>
                            <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center">
                                <ChevronDown className="h-5 w-5 text-brand-blue" />
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-semibold text-gray-600 hidden sm:inline">Collapse</span>
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <ChevronUp className="h-5 w-5 text-gray-600" />
                            </div>
                        </>
                    )}
                </div>
            </button>

            {/* Collapsed Preview */}
            {collapsed && (
                <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 italic line-clamp-2">{getContentPreview()}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-brand-blue">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="font-medium">Click above to view full lesson content</span>
                    </div>
                </div>
            )}

            {/* Expanded Content */}
            <AnimatePresence>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
                            <div className="prose prose-slate prose-sm max-w-none [&_h2]:text-lg [&_h3]:text-base [&_p]:text-sm">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {lessonContent}
                                </ReactMarkdown>
                            </div>
                            {attributionBlock && (
                                <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 [&_a]:text-brand-blue [&_a]:underline">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {attributionBlock}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LessonResourcePanel;
