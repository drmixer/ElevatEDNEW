/**
 * LearnPhase Component
 * 
 * Main learning content phase with section-by-section navigation.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Bot } from 'lucide-react';
import { LessonCard, LessonCardBody, LessonCardFooter } from '../LessonCard';
import { LessonNavigation } from '../LessonNavigation';
import { useLessonStepper } from '../LessonStepper';
import type { LessonSection } from '../../../types/lesson';

interface LearnPhaseProps {
    sections: LessonSection[];
    onAskTutor?: (context: string) => void;
}

export const LearnPhase: React.FC<LearnPhaseProps> = ({
    sections,
    onAskTutor,
}) => {
    const {
        currentSectionIndex,
        nextPhase,
        nextSection,
        previousSection,
        previousPhase,
        hasPracticeQuestions,
    } = useLessonStepper();

    const currentSection = sections[currentSectionIndex] || sections[0];
    const hasMultipleSections = sections.length > 1;
    const isLastSection = currentSectionIndex >= sections.length - 1;
    const isFirstSection = currentSectionIndex === 0;

    // Show appropriate button label based on whether practice questions exist
    const lastSectionLabel = hasPracticeQuestions ? 'Continue to Practice' : 'Continue to Review';

    const handleContinue = () => {
        if (isLastSection) {
            nextPhase();
        } else {
            nextSection();
        }
    };

    const handleBack = () => {
        if (isFirstSection) {
            previousPhase();
        } else {
            previousSection();
        }
    };

    const handleAskTutor = () => {
        if (onAskTutor && currentSection) {
            onAskTutor(`I'm reading about "${currentSection.title}". Can you explain it in simple terms?`);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <LessonCard>
                {/* Section header */}
                <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {currentSection?.title || 'Lesson Content'}
                                </h2>
                                {hasMultipleSections && (
                                    <p className="text-sm text-slate-500">
                                        Section {currentSectionIndex + 1} of {sections.length}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ask tutor button */}
                        {onAskTutor && (
                            <button
                                type="button"
                                onClick={handleAskTutor}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                                <Bot className="h-4 w-4" />
                                <span className="hidden sm:inline">Ask ElevatED</span>
                            </button>
                        )}
                    </div>

                    {/* Section progress for mobile */}
                    {hasMultipleSections && (
                        <div className="mt-3 flex items-center gap-2">
                            {sections.map((_, index) => (
                                <div
                                    key={index}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${index <= currentSectionIndex ? 'bg-blue-500' : 'bg-slate-200'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <LessonCardBody className="min-h-[300px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSectionIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900"
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {currentSection?.content || ''}
                            </ReactMarkdown>
                        </motion.div>
                    </AnimatePresence>
                </LessonCardBody>

                {/* Navigation */}
                <LessonCardFooter>
                    <LessonNavigation
                        continueLabel={isLastSection ? lastSectionLabel : 'Next Section'}
                        backLabel={isFirstSection ? 'Back to Welcome' : 'Previous Section'}
                        onContinue={handleContinue}
                        onBack={handleBack}
                    />
                </LessonCardFooter>
            </LessonCard>
        </div>
    );
};

export default LearnPhase;
