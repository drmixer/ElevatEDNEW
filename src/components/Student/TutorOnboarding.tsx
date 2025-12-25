/**
 * TutorOnboarding - "Meet Your Tutor" Onboarding Flow
 * 
 * A multi-step modal that guides students through personalizing their AI tutor.
 * 
 * Steps:
 * 1. Intro - Explains tutor capabilities and boundaries
 * 2. Persona - Choose from 4 tutor styles
 * 3. Naming - Optionally give your tutor a custom name
 * 4. Prompts - Suggested first questions and what to expect
 */

import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ChevronRight,
    ChevronLeft,
    Check,
    Sparkles,
    Shield,
    MessageCircle,
    HelpCircle,
    Lightbulb,
    Target,
    BookOpen,
    Heart,
} from 'lucide-react';
import { TUTOR_AVATARS, type AvatarManifest } from '../../../shared/avatarManifests';
import { validateTutorName, tutorNameErrorMessage } from '../../../shared/nameSafety';
import { saveTutorPersona } from '../../services/avatarService';
import { updatePreferences as updateStudentPreferences } from '../../services/onboardingService';
import trackEvent from '../../lib/analytics';

// ============================================================================
// Types
// ============================================================================

interface TutorOnboardingProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (result: OnboardingResult) => void;
    studentId: string;
    studentName?: string;
    currentPersonaId?: string | null;
    currentTutorName?: string | null;
}

interface OnboardingResult {
    personaId: string;
    tutorName: string | null;
    completed: boolean;
}

type OnboardingStep = 'intro' | 'persona' | 'naming' | 'prompts';

const STEPS: OnboardingStep[] = ['intro', 'persona', 'naming', 'prompts'];

const STEP_TITLES: Record<OnboardingStep, string> = {
    intro: 'Meet Your Learning Assistant',
    persona: 'Choose Your Tutor Style',
    naming: 'Name Your Tutor',
    prompts: 'Ready to Learn!',
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Step 1: Introduction - What the tutor can do
 */
const IntroStep: React.FC<{ studentName?: string }> = ({ studentName }) => {
    const greeting = studentName ? `Hi ${studentName}!` : 'Hi there!';

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{greeting}</h3>
                <p className="text-slate-600 mt-2">
                    I'm your personal AI learning assistant. Let me show you how I can help!
                </p>
            </div>

            <div className="grid gap-4">
                <FeatureCard
                    icon={<Lightbulb className="h-5 w-5" />}
                    title="Get Hints & Explanations"
                    description="Stuck on a problem? I'll give you hints without giving away the answer."
                    color="amber"
                />
                <FeatureCard
                    icon={<Target className="h-5 w-5" />}
                    title="Practice Weak Areas"
                    description="I know what you're working on and can help you improve."
                    color="emerald"
                />
                <FeatureCard
                    icon={<BookOpen className="h-5 w-5" />}
                    title="Study Tips & Support"
                    description="Need study strategies? I've got ideas that work for your learning style."
                    color="blue"
                />
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-slate-500 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-slate-700">I'm here to help, not to do your work</p>
                        <p className="text-xs text-slate-500 mt-1">
                            I stay school-safe, won't help with cheating, and I'm not a replacement for your teacher.
                            If something feels off, always ask a trusted adult.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: 'amber' | 'emerald' | 'blue' | 'purple';
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, color }) => {
    const colorClasses = {
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
    };

    return (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${colorClasses[color]}`}>
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="font-medium text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{description}</p>
            </div>
        </div>
    );
};

/**
 * Step 2: Persona Selection
 */
interface PersonaStepProps {
    selectedPersonaId: string | null;
    onSelect: (personaId: string) => void;
}

const PersonaStep: React.FC<PersonaStepProps> = ({ selectedPersonaId, onSelect }) => {
    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900">How should I communicate with you?</h3>
                <p className="text-slate-600 mt-2">
                    Pick the style that feels right. You can change this anytime!
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TUTOR_AVATARS.map((avatar) => (
                    <PersonaCard
                        key={avatar.id}
                        avatar={avatar}
                        isSelected={selectedPersonaId === avatar.id}
                        onSelect={() => onSelect(avatar.id)}
                    />
                ))}
            </div>
        </div>
    );
};

interface PersonaCardProps {
    avatar: AvatarManifest;
    isSelected: boolean;
    onSelect: () => void;
}

const PersonaCard: React.FC<PersonaCardProps> = ({ avatar, isSelected, onSelect }) => {
    const toneDescriptions: Record<string, string> = {
        calm: 'Patient explanations, no rushing',
        structured: 'Step-by-step with checkpoints',
        bold: 'High energy, quick motivation',
        concise: 'Gets to the point fast',
    };

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${isSelected
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
        >
            {isSelected && (
                <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                    </div>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: avatar.palette.background }}
                >
                    {avatar.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{avatar.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {toneDescriptions[avatar.tone ?? 'calm'] ?? avatar.description}
                    </p>
                </div>
            </div>
        </button>
    );
};

/**
 * Step 3: Naming the tutor
 */
interface NamingStepProps {
    tutorName: string;
    onNameChange: (name: string) => void;
    selectedPersona: AvatarManifest | null;
    error: string | null;
}

const NamingStep: React.FC<NamingStepProps> = ({
    tutorName,
    onNameChange,
    selectedPersona,
    error,
}) => {
    const placeholder = selectedPersona?.label ?? 'My AI Tutor';

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div
                    className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl"
                    style={{ backgroundColor: selectedPersona?.palette.background ?? '#EEF2FF' }}
                >
                    {selectedPersona?.icon ?? '🤝'}
                </div>
                <h3 className="text-xl font-bold text-slate-900">Give your tutor a name</h3>
                <p className="text-slate-600 mt-2">
                    This is optional! Leave it blank to use "{placeholder}"
                </p>
            </div>

            <div className="max-w-sm mx-auto">
                <input
                    type="text"
                    value={tutorName}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder={`e.g., ${placeholder}, Coach, Buddy...`}
                    maxLength={20}
                    className={`w-full px-4 py-3 text-lg text-center rounded-xl border-2 focus:outline-none focus:ring-2 transition-all ${error
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                        : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-200'
                        }`}
                />
                {error && (
                    <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
                )}
                <p className="text-xs text-slate-500 mt-2 text-center">
                    {tutorName.length}/20 characters
                </p>
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 max-w-sm mx-auto">
                <p className="text-sm text-indigo-700 text-center">
                    <MessageCircle className="h-4 w-4 inline mr-1" />
                    Your tutor will introduce itself using this name
                </p>
            </div>
        </div>
    );
};

/**
 * Step 4: Suggested prompts and final confirmation
 */
interface PromptsStepProps {
    selectedPersona: AvatarManifest | null;
    tutorName: string;
}

const PromptsStep: React.FC<PromptsStepProps> = ({ selectedPersona, tutorName }) => {
    const displayName = tutorName.trim() || selectedPersona?.label || 'Your Tutor';

    const suggestedPrompts = [
        { icon: <HelpCircle className="h-4 w-4" />, text: 'Can you help me with this problem?' },
        { icon: <Lightbulb className="h-4 w-4" />, text: 'Give me a study tip' },
        { icon: <Target className="h-4 w-4" />, text: 'What should I practice today?' },
        { icon: <BookOpen className="h-4 w-4" />, text: 'Explain this concept to me' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div
                    className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl"
                    style={{ backgroundColor: selectedPersona?.palette.background ?? '#EEF2FF' }}
                >
                    {selectedPersona?.icon ?? '🤝'}
                </div>
                <h3 className="text-xl font-bold text-slate-900">You're all set!</h3>
                <p className="text-slate-600 mt-2">
                    {displayName} is ready to help you learn. Here are some ways to get started:
                </p>
            </div>

            <div className="space-y-2">
                {suggestedPrompts.map((prompt, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                        <div className="text-indigo-600">{prompt.icon}</div>
                        <p className="text-sm text-slate-700">"{prompt.text}"</p>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-start gap-3">
                    <Heart className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-slate-700">
                            You can always customize your tutor later
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Look for "Customize Tutor" in your settings or dashboard anytime.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const TutorOnboarding: React.FC<TutorOnboardingProps> = ({
    isOpen,
    onClose,
    onComplete,
    studentId,
    studentName,
    currentPersonaId,
    currentTutorName,
}) => {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('intro');
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
        currentPersonaId ?? TUTOR_AVATARS[0]?.id ?? null
    );
    const [tutorName, setTutorName] = useState(currentTutorName ?? '');
    const [nameError, setNameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const currentStepIndex = STEPS.indexOf(currentStep);
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === STEPS.length - 1;

    const selectedPersona = useMemo(
        () => TUTOR_AVATARS.find((a) => a.id === selectedPersonaId) ?? null,
        [selectedPersonaId]
    );

    // Validate name when it changes
    const handleNameChange = useCallback((name: string) => {
        setTutorName(name);
        if (!name.trim()) {
            setNameError(null);
            return;
        }
        const validation = validateTutorName(name.trim());
        if (!validation.ok) {
            setNameError(tutorNameErrorMessage(validation));
        } else {
            setNameError(null);
        }
    }, []);

    // Handle persona selection
    const handlePersonaSelect = useCallback((personaId: string) => {
        setSelectedPersonaId(personaId);
        trackEvent('tutor_onboarding_step_completed', {
            step: 'persona',
            persona_id: personaId,
        });
    }, []);

    // Navigate to next step
    const handleNext = useCallback(() => {
        if (currentStep === 'persona' && !selectedPersonaId) {
            return; // Can't proceed without selecting a persona
        }

        if (currentStep === 'naming' && nameError) {
            return; // Can't proceed with invalid name
        }

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < STEPS.length) {
            const nextStep = STEPS[nextIndex];
            setCurrentStep(nextStep);
            trackEvent('tutor_onboarding_step_completed', {
                step: currentStep,
                persona_id: selectedPersonaId,
                has_name: Boolean(tutorName.trim()),
            });
        }
    }, [currentStep, currentStepIndex, selectedPersonaId, nameError, tutorName]);

    // Navigate to previous step
    const handleBack = useCallback(() => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(STEPS[prevIndex]);
        }
    }, [currentStepIndex]);

    // Complete onboarding and save preferences
    const handleComplete = useCallback(async () => {
        if (!selectedPersonaId) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            // Save preferences
            await updateStudentPreferences({ tutorPersonaId: selectedPersonaId });

            const trimmedName = tutorName.trim();
            if (trimmedName) {
                const validation = validateTutorName(trimmedName);
                if (validation.ok) {
                    await saveTutorPersona({ name: validation.value });
                }
            } else {
                await saveTutorPersona({ name: null });
            }

            // Track completion
            trackEvent('tutor_onboarding_completed', {
                persona_id: selectedPersonaId,
                name_set: Boolean(trimmedName),
            });

            // Mark onboarding as done in localStorage
            localStorage.setItem(`tutor-onboarding-done-${studentId}`, 'true');

            onComplete({
                personaId: selectedPersonaId,
                tutorName: trimmedName || null,
                completed: true,
            });
        } catch (error) {
            console.error('[TutorOnboarding] Failed to save', error);
            setSaveError(error instanceof Error ? error.message : 'Unable to save right now. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [selectedPersonaId, tutorName, studentId, onComplete]);

    // Handle close with tracking
    const handleClose = useCallback(() => {
        trackEvent('tutor_onboarding_dismissed', {
            step: currentStep,
            persona_id: selectedPersonaId,
        });
        onClose();
    }, [currentStep, selectedPersonaId, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {STEP_TITLES[currentStep]}
                            </h2>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Progress dots */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                            {STEPS.map((step, index) => (
                                <div
                                    key={step}
                                    className={`h-2 rounded-full transition-all ${index === currentStepIndex
                                        ? 'w-6 bg-indigo-500'
                                        : index < currentStepIndex
                                            ? 'w-2 bg-indigo-300'
                                            : 'w-2 bg-slate-200'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {currentStep === 'intro' && (
                                    <IntroStep studentName={studentName} />
                                )}
                                {currentStep === 'persona' && (
                                    <PersonaStep
                                        selectedPersonaId={selectedPersonaId}
                                        onSelect={handlePersonaSelect}
                                    />
                                )}
                                {currentStep === 'naming' && (
                                    <NamingStep
                                        tutorName={tutorName}
                                        onNameChange={handleNameChange}
                                        selectedPersona={selectedPersona}
                                        error={nameError}
                                    />
                                )}
                                {currentStep === 'prompts' && (
                                    <PromptsStep
                                        selectedPersona={selectedPersona}
                                        tutorName={tutorName}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {saveError && (
                            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                                {saveError}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        {!isFirstStep ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Skip for now
                            </button>
                        )}

                        {isLastStep ? (
                            <button
                                type="button"
                                onClick={handleComplete}
                                disabled={isSaving || !selectedPersonaId}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Get Started
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={currentStep === 'persona' && !selectedPersonaId}
                                className="inline-flex items-center gap-1 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Continue
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TutorOnboarding;

// ============================================================================
// Helper: Check if onboarding should be shown
// ============================================================================

export const shouldShowTutorOnboarding = (studentId: string): boolean => {
    if (typeof window === 'undefined') return false;
    const done = localStorage.getItem(`tutor-onboarding-done-${studentId}`);
    return !done;
};

export const markTutorOnboardingDone = (studentId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`tutor-onboarding-done-${studentId}`, 'true');
};

export const resetTutorOnboarding = (studentId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`tutor-onboarding-done-${studentId}`);
};
