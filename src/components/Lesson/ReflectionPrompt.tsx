/**
 * ReflectionPrompt Component
 * 
 * Shows after lesson completion to gather student reflections
 * on their learning experience.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb,
    ThumbsUp,
    ThumbsDown,
    Meh,
    Send,
    X,
    Sparkles,
} from 'lucide-react';
import { saveReflection } from '../../services/reflectionService';

// Reflection questions based on lesson difficulty/outcome
const REFLECTION_QUESTIONS = {
    what_learned: {
        label: 'What did you learn?',
        prompt: "What's one thing you learned today that you didn't know before?",
        emoji: '💡',
    },
    try_differently: {
        label: 'Try differently',
        prompt: "If you could try this lesson again, what would you do differently?",
        emoji: '🔄',
    },
    friend_tip: {
        label: 'Friend tip',
        prompt: "What tip would you give a friend about to start this lesson?",
        emoji: '👋',
    },
    stuck_moment: {
        label: 'Stuck moment',
        prompt: "Was there a moment where you felt stuck? What helped you move forward?",
        emoji: '🤔',
    },
    proud_of: {
        label: 'Proud moment',
        prompt: "What are you most proud of from this lesson?",
        emoji: '🌟',
    },
};

type QuestionId = keyof typeof REFLECTION_QUESTIONS;

// Confidence levels
const CONFIDENCE_LEVELS = [
    { value: 'low', label: 'Still learning', icon: ThumbsDown, color: 'text-amber-500 bg-amber-50 border-amber-200' },
    { value: 'medium', label: 'Getting it', icon: Meh, color: 'text-blue-500 bg-blue-50 border-blue-200' },
    { value: 'high', label: 'Got it!', icon: ThumbsUp, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
];

interface ReflectionPromptProps {
    lessonId: number;
    lessonTitle: string;
    subject?: string;
    didWell: boolean; // Based on practice score
    onComplete?: () => void;
    onSkip?: () => void;
}

export const ReflectionPrompt: React.FC<ReflectionPromptProps> = ({
    lessonId,
    lessonTitle,
    subject,
    didWell,
    onComplete,
    onSkip,
}) => {
    const [step, setStep] = useState<'confidence' | 'question' | 'response' | 'done'>('confidence');
    const [confidence, setConfidence] = useState<string | null>(null);
    const [selectedQuestion, setSelectedQuestion] = useState<QuestionId | null>(null);
    const [response, setResponse] = useState('');
    const [shareWithParent, setShareWithParent] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Choose appropriate questions based on performance
    const getQuestions = (): QuestionId[] => {
        if (didWell) {
            return ['what_learned', 'friend_tip', 'proud_of'];
        } else {
            return ['try_differently', 'stuck_moment', 'what_learned'];
        }
    };

    const handleConfidenceSelect = (value: string) => {
        setConfidence(value);
        setStep('question');
    };

    const handleQuestionSelect = (questionId: QuestionId) => {
        setSelectedQuestion(questionId);
        setStep('response');
    };

    const handleSubmit = async () => {
        if (!selectedQuestion || !response.trim()) return;

        setSaving(true);
        setError(null);

        try {
            await saveReflection({
                questionId: selectedQuestion,
                responseText: response.trim(),
                lessonId: String(lessonId),
                subject: subject,
                sentiment: confidence || undefined,
                shareWithParent,
            });

            setStep('done');
            setTimeout(() => {
                onComplete?.();
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save reflection');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        onSkip?.();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6 mt-6"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-100">
                        <Lightbulb className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">Quick Reflection</h3>
                        <p className="text-sm text-slate-500">Takes less than a minute!</p>
                    </div>
                </div>
                <button
                    onClick={handleSkip}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Skip reflection"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <AnimatePresence mode="wait">
                {/* Step 1: Confidence Check */}
                {step === 'confidence' && (
                    <motion.div
                        key="confidence"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <p className="text-slate-700 mb-4">
                            How confident do you feel about <span className="font-medium">{lessonTitle}</span>?
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {CONFIDENCE_LEVELS.map(({ value, label, icon: Icon, color }) => (
                                <button
                                    key={value}
                                    onClick={() => handleConfidenceSelect(value)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105 ${color}`}
                                >
                                    <Icon className="h-6 w-6" />
                                    <span className="text-sm font-medium">{label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Question Selection */}
                {step === 'question' && (
                    <motion.div
                        key="question"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <p className="text-slate-700 mb-4">Pick a question to reflect on:</p>
                        <div className="space-y-2">
                            {getQuestions().map((qId) => {
                                const q = REFLECTION_QUESTIONS[qId];
                                return (
                                    <button
                                        key={qId}
                                        onClick={() => handleQuestionSelect(qId)}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                                    >
                                        <span className="text-2xl">{q.emoji}</span>
                                        <span className="text-slate-700">{q.prompt}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Response Input */}
                {step === 'response' && selectedQuestion && (
                    <motion.div
                        key="response"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <p className="text-slate-700 mb-3">
                            <span className="text-xl mr-2">
                                {REFLECTION_QUESTIONS[selectedQuestion].emoji}
                            </span>
                            {REFLECTION_QUESTIONS[selectedQuestion].prompt}
                        </p>
                        <div className="relative">
                            <textarea
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                placeholder="Share your thoughts..."
                                className="w-full p-4 pr-12 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none min-h-[100px]"
                                maxLength={500}
                            />
                            <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                                {response.length}/500
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                            <input
                                type="checkbox"
                                id="share-parent"
                                checked={shareWithParent}
                                onChange={(e) => setShareWithParent(e.target.checked)}
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor="share-parent" className="text-sm text-slate-600">
                                Share this with my parent/guardian
                            </label>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 mt-2">{error}</p>
                        )}

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setStep('question')}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!response.trim() || saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    'Saving...'
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Save Reflection
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 4: Done */}
                {step === 'done' && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-4"
                    >
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">Reflection Saved!</h4>
                        <p className="text-sm text-slate-600">Great job thinking about your learning!</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ReflectionPrompt;
