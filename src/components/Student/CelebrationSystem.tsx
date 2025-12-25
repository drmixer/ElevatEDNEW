/**
 * CelebrationSystem - Level-up & Milestone Celebrations
 *
 * Displays lightweight celebration modals/banners when:
 * - Student levels up
 * - Streak milestones (7, 14, 30 days)
 * - Avatar/accent unlocked
 * - Mission completion (first completion)
 *
 * Each celebration:
 * - States what behavior caused it
 * - Suggests one specific next goal
 * - Is short, dismissible, non-blocking
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Award,
    Flame,
    PartyPopper,
    Sparkles,
    Star,
    Target,
    Trophy,
    X,
    Zap,
} from 'lucide-react';
import Confetti from './Confetti';
import trackEvent from '../../lib/analytics';
import type { CelebrationKind, CelebrationMoment } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface CelebrationSystemProps {
    /** Pending celebrations to show */
    celebrations?: CelebrationMoment[];
    /** Student's current level (for level-up detection) */
    currentLevel?: number;
    /** Student's current streak */
    currentStreak?: number;
    /** Callback when celebration is dismissed */
    onDismiss?: (id: string, reason: 'auto' | 'close' | 'cta') => void;
    /** Callback when CTA is clicked */
    onCtaClick?: (celebration: CelebrationMoment, ctaType: string) => void;
}

interface CelebrationCardProps {
    celebration: CelebrationMoment;
    onClose: () => void;
    onCta: (ctaType: string) => void;
    isModal?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CELEBRATION_CONFIG: Record<
    CelebrationKind,
    {
        icon: React.ComponentType<{ className?: string }>;
        color: string;
        bgGradient: string;
        accentColor: string;
        showConfetti: boolean;
        autoClose?: number;
    }
> = {
    level: {
        icon: Star,
        color: 'text-amber-600',
        bgGradient: 'from-amber-50 to-yellow-50',
        accentColor: 'bg-amber-100',
        showConfetti: true,
    },
    streak: {
        icon: Flame,
        color: 'text-orange-600',
        bgGradient: 'from-orange-50 to-red-50',
        accentColor: 'bg-orange-100',
        showConfetti: true,
    },
    badge: {
        icon: Award,
        color: 'text-purple-600',
        bgGradient: 'from-purple-50 to-pink-50',
        accentColor: 'bg-purple-100',
        showConfetti: true,
    },
    avatar: {
        icon: Sparkles,
        color: 'text-indigo-600',
        bgGradient: 'from-indigo-50 to-blue-50',
        accentColor: 'bg-indigo-100',
        showConfetti: true,
    },
    mission: {
        icon: Target,
        color: 'text-emerald-600',
        bgGradient: 'from-emerald-50 to-teal-50',
        accentColor: 'bg-emerald-100',
        showConfetti: true,
    },
    mastery: {
        icon: Trophy,
        color: 'text-blue-600',
        bgGradient: 'from-blue-50 to-cyan-50',
        accentColor: 'bg-blue-100',
        showConfetti: false,
    },
    assessment: {
        icon: Zap,
        color: 'text-green-600',
        bgGradient: 'from-green-50 to-emerald-50',
        accentColor: 'bg-green-100',
        showConfetti: false,
    },
    milestone: {
        icon: PartyPopper,
        color: 'text-pink-600',
        bgGradient: 'from-pink-50 to-rose-50',
        accentColor: 'bg-pink-100',
        showConfetti: true,
    },
};

const STREAK_MILESTONES = [7, 14, 30, 60, 100];

// Storage key for seen celebrations
const SEEN_STORAGE_KEY = 'elevated_celebrations_seen';

// ============================================================================
// Helpers
// ============================================================================

function getSeenCelebrations(): Set<string> {
    try {
        const stored = localStorage.getItem(SEEN_STORAGE_KEY);
        if (!stored) return new Set();
        return new Set(JSON.parse(stored));
    } catch {
        return new Set();
    }
}

function markCelebrationSeen(id: string): void {
    try {
        const seen = getSeenCelebrations();
        seen.add(id);
        // Keep only last 100 to avoid bloat
        const arr = Array.from(seen).slice(-100);
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
    } catch {
        // Ignore storage errors
    }
}

function getCta(kind: CelebrationKind): { label: string; type: string } {
    switch (kind) {
        case 'level':
        case 'streak':
        case 'mission':
            return { label: 'Start your next lesson', type: 'start_lesson' };
        case 'avatar':
            return { label: 'View my avatar', type: 'avatar' };
        case 'badge':
            return { label: 'See my badges', type: 'badges' };
        case 'mastery':
        case 'assessment':
            return { label: 'Keep learning', type: 'continue' };
        default:
            return { label: 'Continue', type: 'continue' };
    }
}

// ============================================================================
// Sub-components
// ============================================================================

const CelebrationCard: React.FC<CelebrationCardProps> = ({
    celebration,
    onClose,
    onCta,
    isModal = false,
}) => {
    const config = CELEBRATION_CONFIG[celebration.kind] || CELEBRATION_CONFIG.milestone;
    const Icon = config.icon;
    const cta = getCta(celebration.kind);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: isModal ? 0 : -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: isModal ? 0 : -20 }}
            className={`relative overflow-hidden rounded-2xl shadow-xl ${isModal ? 'w-full max-w-md' : 'w-80'
                }`}
        >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} opacity-90`} />

            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-xl" />

            {/* Content */}
            <div className="relative z-10 p-6">
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-white/50"
                    aria-label="Close celebration"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className={`w-16 h-16 ${config.accentColor} rounded-2xl flex items-center justify-center mb-4 shadow-sm`}>
                    <Icon className={`w-8 h-8 ${config.color}`} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{celebration.title}</h3>

                {/* Description */}
                <p className="text-slate-600 mb-4">{celebration.description}</p>

                {/* Prompt (next goal) */}
                {celebration.prompt && (
                    <div className="flex items-start gap-2 mb-4 p-3 bg-white/60 rounded-xl">
                        <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">{celebration.prompt}</p>
                    </div>
                )}

                {/* CTA */}
                <button
                    type="button"
                    onClick={() => onCta(cta.type)}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                >
                    {cta.label}
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
};

// ============================================================================
// Toast Banner (non-modal)
// ============================================================================

interface CelebrationToastProps {
    celebration: CelebrationMoment;
    onClose: () => void;
    onCta: (ctaType: string) => void;
}

const CelebrationToast: React.FC<CelebrationToastProps> = ({
    celebration,
    onClose,
    onCta,
}) => {
    const config = CELEBRATION_CONFIG[celebration.kind] || CELEBRATION_CONFIG.milestone;
    const Icon = config.icon;
    const cta = getCta(celebration.kind);

    // Auto-dismiss after 6s
    useEffect(() => {
        const timer = setTimeout(onClose, 6000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-20 right-4 z-50"
            onMouseEnter={(e) => e.currentTarget.dataset.paused = 'true'}
            onMouseLeave={(e) => delete e.currentTarget.dataset.paused}
        >
            <div className={`relative overflow-hidden rounded-xl shadow-lg bg-gradient-to-r ${config.bgGradient} border border-white/50 p-4 max-w-sm`}>
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${config.accentColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{celebration.title}</p>
                        <p className="text-sm text-slate-600 line-clamp-2">{celebration.description}</p>
                        <button
                            type="button"
                            onClick={() => onCta(cta.type)}
                            className={`mt-2 text-sm font-medium ${config.color} hover:underline inline-flex items-center gap-1`}
                        >
                            {cta.label} <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const CelebrationSystem: React.FC<CelebrationSystemProps> = ({
    celebrations = [],
    currentLevel,
    currentStreak,
    onDismiss,
    onCtaClick,
}) => {
    const navigate = useNavigate();
    const [queue, setQueue] = useState<CelebrationMoment[]>([]);
    const [activeCelebration, setActiveCelebration] = useState<CelebrationMoment | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    // Filter out already-seen celebrations and limit to 2 per load
    useEffect(() => {
        const seen = getSeenCelebrations();
        const unseen = celebrations
            .filter((c) => !seen.has(c.id))
            .slice(0, 2); // Cap at 2 per load

        if (unseen.length > 0) {
            setQueue(unseen);
            setActiveCelebration(unseen[0]);

            // Check if should show confetti
            const config = CELEBRATION_CONFIG[unseen[0].kind];
            if (config?.showConfetti) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);
            }

            // Mark as seen
            unseen.forEach((c) => markCelebrationSeen(c.id));
        }
    }, [celebrations]);

    // Handle dismiss
    const handleDismiss = useCallback(
        (reason: 'auto' | 'close' | 'cta') => {
            if (!activeCelebration) return;

            trackEvent('celebration_dismissed', {
                kind: activeCelebration.kind,
                id: activeCelebration.id,
                reason,
            });

            onDismiss?.(activeCelebration.id, reason);

            // Move to next in queue
            const currentIndex = queue.findIndex((c) => c.id === activeCelebration.id);
            if (currentIndex < queue.length - 1) {
                const next = queue[currentIndex + 1];
                setActiveCelebration(next);

                // Check confetti for next
                const config = CELEBRATION_CONFIG[next.kind];
                if (config?.showConfetti) {
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 3000);
                }
            } else {
                setActiveCelebration(null);
            }
        },
        [activeCelebration, queue, onDismiss]
    );

    // Handle CTA click
    const handleCtaClick = useCallback(
        (ctaType: string) => {
            if (!activeCelebration) return;

            trackEvent('celebration_cta_clicked', {
                kind: activeCelebration.kind,
                id: activeCelebration.id,
                cta: ctaType,
            });

            onCtaClick?.(activeCelebration, ctaType);

            // Navigate based on CTA type
            switch (ctaType) {
                case 'start_lesson':
                    navigate('/dashboard');
                    break;
                case 'avatar':
                    navigate('/avatar-lab');
                    break;
                case 'badges':
                    navigate('/profile#badges');
                    break;
                case 'continue':
                default:
                    // Just dismiss
                    break;
            }

            handleDismiss('cta');
        },
        [activeCelebration, navigate, onCtaClick, handleDismiss]
    );

    // Track when shown
    useEffect(() => {
        if (activeCelebration) {
            trackEvent('celebration_shown', {
                kind: activeCelebration.kind,
                id: activeCelebration.id,
                level: currentLevel,
                streak_days: currentStreak,
            });
        }
    }, [activeCelebration, currentLevel, currentStreak]);

    // Determine if should show as modal (level-up, major milestones) or toast
    const isModal = activeCelebration?.kind === 'level' || activeCelebration?.kind === 'avatar';

    return (
        <>
            {/* Confetti */}
            {showConfetti && <Confetti />}

            {/* Modal backdrop */}
            <AnimatePresence>
                {activeCelebration && isModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => handleDismiss('close')}
                    >
                        <div onClick={(e) => e.stopPropagation()}>
                            <CelebrationCard
                                celebration={activeCelebration}
                                onClose={() => handleDismiss('close')}
                                onCta={handleCtaClick}
                                isModal
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {activeCelebration && !isModal && (
                    <CelebrationToast
                        celebration={activeCelebration}
                        onClose={() => handleDismiss('auto')}
                        onCta={handleCtaClick}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default CelebrationSystem;

// Export helpers
export { STREAK_MILESTONES, getSeenCelebrations, markCelebrationSeen };
