/**
 * ParentOnboardingTour - First-Visit Walkthrough for Parents
 * 
 * Feature: C.7 Parent Onboarding & Education
 * 
 * A 3-step tour that guides new parents through the dashboard:
 * 1. Welcome & overview of what they'll see
 * 2. Key features walkthrough (child progress, settings, tips)
 * 3. Getting started actions
 * 
 * Also includes:
 * - "Parent guide" link with quick explainers
 * - Optional video overview link
 * - Skippable and re-openable from settings
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ChevronRight,
    ChevronLeft,
    Users,
    BarChart3,
    Settings,
    Lightbulb,
    MessageSquare,
    BookOpen,
    CheckCircle,
    Play,
    ArrowRight,
    Sparkles,
    Target,
    Shield,
    PartyPopper,
} from 'lucide-react';
import trackEvent from '../../lib/analytics';

// ============================================================================
// Types
// ============================================================================

interface ParentOnboardingTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    parentName?: string;
    childrenCount?: number;
}

type TourStep = 'welcome' | 'features' | 'actions';

const TOUR_STEPS: TourStep[] = ['welcome', 'features', 'actions'];

// ============================================================================
// Step Components
// ============================================================================

interface WelcomeStepProps {
    parentName?: string;
    childrenCount?: number;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ parentName, childrenCount }) => {
    const firstName = parentName?.split(' ')[0] || 'there';

    return (
        <div className="text-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
            >
                <PartyPopper className="w-10 h-10 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Welcome, {firstName}! 🎉
            </h2>

            <p className="text-slate-600 mb-6 max-w-md mx-auto">
                This is your parent dashboard — your command center for tracking
                {childrenCount && childrenCount > 1 ? ` your ${childrenCount} learners'` : ' your learner\'s'} progress and supporting their education journey.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="text-center">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <BarChart3 className="w-6 h-6 text-teal-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">Track Progress</p>
                </div>
                <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <Lightbulb className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">Get Tips</p>
                </div>
                <div className="text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <Settings className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">Customize</p>
                </div>
            </div>
        </div>
    );
};

const FeaturesStep: React.FC = () => {
    const features = [
        {
            icon: <Users className="w-6 h-6" />,
            title: 'Child Overview',
            description: 'See all your learners at a glance with progress, streaks, and focus areas',
            color: 'bg-teal-100 text-teal-600',
        },
        {
            icon: <Target className="w-6 h-6" />,
            title: 'Subject Status',
            description: 'Understand performance in each subject with clear on-track/at-risk indicators',
            color: 'bg-indigo-100 text-indigo-600',
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            title: 'AI Tutor Controls',
            description: 'Customize how the AI tutor interacts with your child — set limits and tones',
            color: 'bg-purple-100 text-purple-600',
        },
        {
            icon: <Lightbulb className="w-6 h-6" />,
            title: 'Weekly Tips',
            description: 'Get personalized coaching suggestions to support learning at home',
            color: 'bg-amber-100 text-amber-600',
        },
    ];

    return (
        <div>
            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                Key Features
            </h2>
            <p className="text-slate-600 text-center mb-6">
                Here's what you can do from your dashboard
            </p>

            <div className="space-y-3">
                {features.map((feature, index) => (
                    <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl"
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${feature.color}`}>
                            {feature.icon}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                            <p className="text-sm text-slate-600">{feature.description}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

interface ActionsStepProps {
    onComplete: () => void;
}

const ActionsStep: React.FC<ActionsStepProps> = ({ onComplete }) => {
    const actions = [
        {
            icon: <Users className="w-5 h-5" />,
            label: 'Click on a child card to see detailed progress',
            done: true,
        },
        {
            icon: <BookOpen className="w-5 h-5" />,
            label: 'Browse the lesson catalog to assign content',
            done: false,
        },
        {
            icon: <Settings className="w-5 h-5" />,
            label: 'Set AI tutor preferences for each child',
            done: false,
        },
        {
            icon: <Shield className="w-5 h-5" />,
            label: 'Review safety & privacy settings',
            done: false,
        },
    ];

    return (
        <div>
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
                <Sparkles className="w-8 h-8 text-white" />
            </motion.div>

            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                You're All Set!
            </h2>
            <p className="text-slate-600 text-center mb-6">
                Here are some quick actions to get started
            </p>

            <div className="space-y-2 mb-6">
                {actions.map((action, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-500">
                            {action.icon}
                        </div>
                        <span className="flex-1 text-sm text-slate-700">{action.label}</span>
                        {action.done && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Resources */}
            <div className="flex flex-col sm:flex-row gap-3">
                <a
                    href="/help/parent-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors"
                >
                    <BookOpen className="w-4 h-4" />
                    Parent Guide
                </a>
                <a
                    href="/help/parent-video"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors"
                >
                    <Play className="w-4 h-4" />
                    Watch Overview (90s)
                </a>
            </div>

            {/* Main CTA */}
            <button
                type="button"
                onClick={onComplete}
                className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/25 transition-all"
            >
                Start Exploring
                <ArrowRight className="w-5 h-5" />
            </button>
        </div>
    );
};

// ============================================================================
// Progress Indicator
// ============================================================================

interface ProgressIndicatorProps {
    currentStep: number;
    totalSteps: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, totalSteps }) => (
    <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
            <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${index <= currentStep
                    ? 'w-8 bg-teal-500'
                    : 'w-2 bg-slate-200'
                    }`}
            />
        ))}
    </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ParentOnboardingTour: React.FC<ParentOnboardingTourProps> = ({
    isOpen,
    onClose,
    onComplete,
    parentName,
    childrenCount,
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const currentStep = TOUR_STEPS[currentStepIndex];

    const handleNext = useCallback(() => {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
            trackEvent('parent_onboarding_step', { step: currentStepIndex + 1 });
        }
    }, [currentStepIndex]);

    const handleBack = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    }, [currentStepIndex]);

    const handleComplete = useCallback(() => {
        trackEvent('parent_onboarding_complete', {});
        onComplete();
    }, [onComplete]);

    const handleSkip = useCallback(() => {
        trackEvent('parent_onboarding_skip', { step: currentStepIndex });
        onClose();
    }, [currentStepIndex, onClose]);

    // Reset step when reopened
    useEffect(() => {
        if (isOpen) {
            setCurrentStepIndex(0);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50"
                        onClick={handleSkip}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-[5%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-lg flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-semibold text-slate-900">Getting Started</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSkip}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Skip tour"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-6">
                            <AnimatePresence mode="wait">
                                {currentStep === 'welcome' && (
                                    <motion.div
                                        key="welcome"
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <WelcomeStep parentName={parentName} childrenCount={childrenCount} />
                                    </motion.div>
                                )}
                                {currentStep === 'features' && (
                                    <motion.div
                                        key="features"
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <FeaturesStep />
                                    </motion.div>
                                )}
                                {currentStep === 'actions' && (
                                    <motion.div
                                        key="actions"
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <ActionsStep onComplete={handleComplete} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer - Navigation */}
                        {currentStep !== 'actions' && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        disabled={currentStepIndex === 0}
                                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Back
                                    </button>

                                    <ProgressIndicator currentStep={currentStepIndex} totalSteps={TOUR_STEPS.length} />

                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ParentOnboardingTour;
