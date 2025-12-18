/**
 * ReviewPhase Component
 * 
 * Review phase showing summary, vocabulary, and additional resources.
 */

import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BookMarked,
    BookOpen,
    ExternalLink,
    Layers,
} from 'lucide-react';
import { LessonCard, LessonCardBody } from '../LessonCard';
import { LessonNavigation } from '../LessonNavigation';
import type { VocabularyTerm, LessonResource } from '../../../types/lesson';

interface ReviewPhaseProps {
    summary: string | null;
    vocabulary: VocabularyTerm[];
    resources: LessonResource[];
}

export const ReviewPhase: React.FC<ReviewPhaseProps> = ({
    summary,
    vocabulary,
    resources,
}) => {
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Summary card */}
            {summary && (
                <LessonCard>
                    <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                                <Layers className="h-5 w-5" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Key Takeaways
                            </h2>
                        </div>
                    </div>
                    <LessonCardBody>
                        <div className="prose prose-slate max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {summary}
                            </ReactMarkdown>
                        </div>
                    </LessonCardBody>
                </LessonCard>
            )}

            {/* Vocabulary card */}
            {vocabulary.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <LessonCard>
                        <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
                                    <BookMarked className="h-5 w-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Key Vocabulary
                                </h2>
                            </div>
                        </div>
                        <LessonCardBody>
                            <dl className="space-y-4">
                                {vocabulary.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 + index * 0.05 }}
                                        className="rounded-lg bg-slate-50 p-4"
                                    >
                                        <dt className="font-semibold text-slate-900 mb-1">
                                            {item.term}
                                        </dt>
                                        <dd className="text-slate-600">
                                            {item.definition}
                                        </dd>
                                    </motion.div>
                                ))}
                            </dl>
                        </LessonCardBody>
                    </LessonCard>
                </motion.div>
            )}

            {/* Resources card */}
            {resources.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <LessonCard>
                        <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Additional Resources
                                </h2>
                            </div>
                        </div>
                        <LessonCardBody>
                            <div className="space-y-3">
                                {resources.map((resource, index) => (
                                    <a
                                        key={index}
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-medium text-slate-900 group-hover:text-blue-700">
                                                {resource.title}
                                            </h3>
                                            {resource.description && (
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    {resource.description}
                                                </p>
                                            )}
                                            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-slate-400">
                                                {resource.type}
                                            </span>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                    </a>
                                ))}
                            </div>
                        </LessonCardBody>
                    </LessonCard>
                </motion.div>
            )}

            {/* Navigation */}
            <LessonCard>
                <LessonCardBody>
                    <LessonNavigation
                        continueLabel="Complete Lesson"
                        backLabel="Back to Practice"
                    />
                </LessonCardBody>
            </LessonCard>
        </div>
    );
};

export default ReviewPhase;
