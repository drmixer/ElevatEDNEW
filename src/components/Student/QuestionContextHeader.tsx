import React from 'react';
import { BookOpen, ArrowUp, Link2 } from 'lucide-react';

interface QuestionContextHeaderProps {
    lessonTitle: string;
    sectionTitle?: string | null;
    moduleTitle?: string | null;
    onJumpToResource?: () => void;
    questionNumber: number;
    totalQuestions: number;
}

/**
 * QuestionContextHeader - Shows what resource/section a question relates to
 * Part of Phase 3: Context-Rich Lessons - Question-to-Resource Linking
 * 
 * Key features:
 * - "Based on: [Resource Title]" header
 * - Quick-link to jump back to the relevant section
 * - Visual indicator tying question to resource
 * - Question progress indicator
 */
const QuestionContextHeader: React.FC<QuestionContextHeaderProps> = ({
    lessonTitle,
    sectionTitle,
    moduleTitle,
    onJumpToResource,
    questionNumber,
    totalQuestions,
}) => {
    const resourceDisplayTitle = sectionTitle ?? lessonTitle;

    return (
        <div className="rounded-xl bg-gradient-to-r from-brand-light-blue/40 to-brand-light-teal/30 border border-brand-light-blue/50 p-4 mb-4">
            {/* Question Number Badge */}
            <div className="flex items-center justify-between gap-4 mb-3">
                <div className="inline-flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-teal flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{questionNumber}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                        Question {questionNumber} of {totalQuestions}
                    </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/60 rounded-full">
                    <Link2 className="h-3.5 w-3.5 text-brand-blue" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                        Context Available
                    </span>
                </div>
            </div>

            {/* Based on Section */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/80 border border-brand-light-blue flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-teal mb-0.5">
                            📖 Based on
                        </p>
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {resourceDisplayTitle}
                        </p>
                        {moduleTitle && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                                From: {moduleTitle}
                            </p>
                        )}
                    </div>
                </div>

                {onJumpToResource && (
                    <button
                        type="button"
                        onClick={onJumpToResource}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-brand-blue/40 px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue/5 transition-colors flex-shrink-0"
                    >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Jump to lesson</span>
                        <span className="sm:hidden">View</span>
                    </button>
                )}
            </div>

            {/* Helpful Tip */}
            <div className="mt-3 pt-3 border-t border-brand-light-blue/50">
                <p className="text-xs text-gray-600">
                    💡 <span className="font-medium">Tip:</span> If you're unsure, tap "Jump to lesson" above to review the material before answering.
                </p>
            </div>
        </div>
    );
};

export default QuestionContextHeader;
