/**
 * LessonHeader Component
 * 
 * Header section showing lesson title, subject, grade, and progress.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';
import { LessonProgressBarCompact } from './LessonProgressBar';

interface LessonHeaderProps {
    title: string;
    subject: string;
    gradeBand: string;
    moduleId?: number;
    moduleTitle?: string;
    estimatedMinutes?: number | null;
    className?: string;
}

export const LessonHeader: React.FC<LessonHeaderProps> = ({
    title,
    subject,
    gradeBand,
    moduleId,
    moduleTitle,
    estimatedMinutes,
    className = '',
}) => {
    return (
        <header className={`bg-white border-b border-slate-200 ${className}`}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <Link
                        to="/catalog"
                        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Catalog</span>
                    </Link>
                    {moduleId && moduleTitle && (
                        <>
                            <span className="text-slate-300">/</span>
                            <Link
                                to={`/module/${moduleId}`}
                                className="hover:text-blue-600 transition-colors truncate max-w-[200px]"
                            >
                                {moduleTitle}
                            </Link>
                        </>
                    )}
                </nav>

                {/* Title row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                        {/* Subject and grade badge */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                                <BookOpen className="h-3 w-3" />
                                {subject}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                                {gradeBand}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                            {title}
                        </h1>
                    </div>

                    {/* Time estimate */}
                    {estimatedMinutes != null && estimatedMinutes > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Clock className="h-4 w-4" />
                            <span>{estimatedMinutes} min</span>
                        </div>
                    )}
                </div>

                {/* Compact progress bar */}
                <div className="mt-4">
                    <LessonProgressBarCompact />
                </div>
            </div>
        </header>
    );
};

export default LessonHeader;
