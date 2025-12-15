import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    HelpCircle,
    Lightbulb,
    Bot,
    RefreshCw,
    Sparkles,
    ThumbsUp,
    ArrowRight,
} from 'lucide-react';

interface QuestionFeedbackPanelProps {
    isCorrect: boolean;
    explanation?: string | null;
    questionPrompt: string;
    lessonTitle: string;
    sectionTitle?: string | null;
    onAskTutor: (prompt: string, source: string) => void;
    onTrySimilar?: () => void;
    onScrollToResource?: () => void;
    tutorLabel?: string;
}

/**
 * QuestionFeedbackPanel - Enhanced feedback for correct/incorrect answers
 * Part of Phase 3: Context-Rich Lessons - Immediate Feedback Improvements
 * 
 * Key features:
 * - Encouraging language for both correct and incorrect answers
 * - "Why this is right" explanation for correct answers
 * - "I'm confused" button that triggers AI tutor contextually
 * - "Want to try a similar one?" option for incorrect answers
 * - Link back to lesson content
 */
const QuestionFeedbackPanel: React.FC<QuestionFeedbackPanelProps> = ({
    isCorrect,
    explanation,
    questionPrompt,
    lessonTitle,
    sectionTitle,
    onAskTutor,
    onTrySimilar,
    onScrollToResource,
    tutorLabel = 'ElevatED tutor',
}) => {
    const [showingMoreHelp, setShowingMoreHelp] = useState(false);

    // Generate encouraging messages
    const getCorrectMessage = (): { title: string; subtitle: string; emoji: string } => {
        const messages = [
            { title: "Great job!", subtitle: "You've got this concept down.", emoji: "🌟" },
            { title: "Nailed it!", subtitle: "Your understanding is solid.", emoji: "✨" },
            { title: "Excellent!", subtitle: "Keep up the amazing work.", emoji: "🎯" },
            { title: "Perfect!", subtitle: "You really understand this.", emoji: "💪" },
            { title: "Awesome!", subtitle: "That's exactly right.", emoji: "🚀" },
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    };

    const getIncorrectMessage = (): { title: string; subtitle: string; emoji: string } => {
        const messages = [
            { title: "Not quite, but you're learning!", subtitle: "Every mistake helps you grow.", emoji: "💡" },
            { title: "Almost there!", subtitle: "Let's figure this out together.", emoji: "🤔" },
            { title: "Good try!", subtitle: "Learning happens when we miss sometimes.", emoji: "🌱" },
            { title: "Keep going!", subtitle: "Mistakes are just part of the journey.", emoji: "📚" },
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    };

    const message = isCorrect ? getCorrectMessage() : getIncorrectMessage();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border-2 p-5 ${isCorrect
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
                : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
                }`}
        >
            {/* Main Feedback Header */}
            <div className="flex items-start gap-4">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-emerald-100' : 'bg-amber-100'
                        }`}
                >
                    {isCorrect ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : (
                        <Lightbulb className="h-6 w-6 text-amber-600" />
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{message.emoji}</span>
                        <h4
                            className={`text-lg font-bold ${isCorrect ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                        >
                            {message.title}
                        </h4>
                    </div>
                    <p className={`text-sm ${isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {message.subtitle}
                    </p>
                </div>
            </div>

            {/* Explanation Box */}
            {explanation && (
                <div className="mt-4 p-4 rounded-xl bg-white/80 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-brand-blue" />
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                            {isCorrect ? 'Why this is correct' : "Let's understand"}
                        </span>
                    </div>
                    <p className="text-sm text-gray-700">{explanation}</p>
                </div>
            )}

            {/* Resource Link */}
            {(sectionTitle || lessonTitle) && onScrollToResource && (
                <button
                    type="button"
                    onClick={onScrollToResource}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:text-brand-blue/80"
                >
                    <ArrowRight className="h-4 w-4" />
                    <span>
                        Review: {sectionTitle ?? lessonTitle}
                    </span>
                </button>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
                {/* Correct Answer Actions */}
                {isCorrect && (
                    <button
                        type="button"
                        onClick={() =>
                            onAskTutor(
                                `I got this question right: "${questionPrompt}". Can you explain why this answer is correct and give me a quick tip to remember it?`,
                                'feedback:correct:explain',
                            )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                        <ThumbsUp className="h-4 w-4" />
                        Tell me more about why
                    </button>
                )}

                {/* Incorrect Answer Actions */}
                {!isCorrect && (
                    <>
                        {/* I'm Confused Button - THE KEY ADDITION */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowingMoreHelp(true);
                                onAskTutor(
                                    `I'm confused about this question: "${questionPrompt}" from the lesson "${lessonTitle}". Can you explain the concept step by step in a simpler way?`,
                                    'feedback:confused',
                                );
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-blue text-white px-4 py-2 text-sm font-semibold hover:bg-brand-blue/90"
                        >
                            <HelpCircle className="h-4 w-4" />
                            I'm confused - help me understand
                        </button>

                        {/* Try Similar Question */}
                        {onTrySimilar && (
                            <button
                                type="button"
                                onClick={onTrySimilar}
                                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try a similar question
                            </button>
                        )}

                        {/* Quick Ask Tutor */}
                        <button
                            type="button"
                            onClick={() =>
                                onAskTutor(
                                    `I missed this question: "${questionPrompt}". Walk me through the correct answer with a simple example.`,
                                    'feedback:incorrect:help',
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/40 bg-white px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5"
                        >
                            <Bot className="h-4 w-4" />
                            Ask {tutorLabel}
                        </button>
                    </>
                )}
            </div>

            {/* Extra Encouragement for Incorrect */}
            {!isCorrect && (
                <AnimatePresence>
                    {showingMoreHelp && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 p-3 rounded-xl bg-brand-light-blue/30 border border-brand-light-blue"
                        >
                            <p className="text-sm text-brand-blue">
                                🤗 Don't worry! The tutor is generating a personalized explanation just for you...
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default QuestionFeedbackPanel;
