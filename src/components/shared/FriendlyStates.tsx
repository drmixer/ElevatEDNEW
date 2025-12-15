/**
 * FriendlyStates - Phase 7.3
 * 
 * Reusable components for loading and empty states that feel calm and encouraging.
 * These replace generic "Loading..." text with personality-filled experiences.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, BookOpen, Target, Heart, Coffee, Rocket, Star } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Loading States
// ─────────────────────────────────────────────────────────────

interface FriendlyLoadingProps {
    message?: string;
    variant?: 'default' | 'lesson' | 'dashboard' | 'tutor';
    size?: 'sm' | 'md' | 'lg';
}

const LOADING_MESSAGES = {
    default: 'Getting things ready...',
    lesson: 'Finding your next adventure...',
    dashboard: 'Loading your learning journey...',
    tutor: 'Thinking...',
};

const LOADING_ICONS = {
    default: Sparkles,
    lesson: BookOpen,
    dashboard: Rocket,
    tutor: Heart,
};

export const FriendlyLoading: React.FC<FriendlyLoadingProps> = ({
    message,
    variant = 'default',
    size = 'md',
}) => {
    const IconComponent = LOADING_ICONS[variant];
    const displayMessage = message ?? LOADING_MESSAGES[variant];

    const sizeClasses = {
        sm: { container: 'py-4', icon: 'h-5 w-5', text: 'text-sm' },
        md: { container: 'py-8', icon: 'h-6 w-6', text: 'text-base' },
        lg: { container: 'py-16', icon: 'h-8 w-8', text: 'text-lg' },
    };

    const styles = sizeClasses[size];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex flex-col items-center justify-center ${styles.container}`}
        >
            <div className="relative">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="text-violet-400"
                >
                    <Loader2 className={styles.icon} />
                </motion.div>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="absolute -top-1 -right-1"
                >
                    <IconComponent className="h-3 w-3 text-amber-400" />
                </motion.div>
            </div>
            <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`mt-3 text-slate-600 font-medium ${styles.text}`}
            >
                {displayMessage}
            </motion.p>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Empty States
// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: 'default' | 'success' | 'encouragement';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    subtitle,
    icon,
    action,
    variant = 'default',
}) => {
    const variantStyles = {
        default: {
            bg: 'bg-gradient-to-br from-slate-50 to-violet-50',
            iconBg: 'bg-violet-100',
            iconColor: 'text-violet-500',
            border: 'border-violet-100',
        },
        success: {
            bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-500',
            border: 'border-emerald-100',
        },
        encouragement: {
            bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-500',
            border: 'border-amber-100',
        },
    };

    const styles = variantStyles[variant];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl ${styles.bg} border ${styles.border} p-8 text-center`}
        >
            {icon ? (
                <div className={`w-16 h-16 ${styles.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <div className={styles.iconColor}>{icon}</div>
                </div>
            ) : (
                <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className={`w-16 h-16 ${styles.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}
                >
                    <Star className={`h-8 w-8 ${styles.iconColor}`} />
                </motion.div>
            )}
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
            {subtitle && <p className="text-sm text-slate-600 mb-4 max-w-xs mx-auto">{subtitle}</p>}
            {action && (
                <button
                    onClick={action.onClick}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                    {action.label}
                </button>
            )}
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Preset Empty States
// ─────────────────────────────────────────────────────────────

export const NoLessonsState: React.FC<{ onExplore?: () => void }> = ({ onExplore }) => (
    <EmptyState
        title="Ready when you are!"
        subtitle="Your next lesson is just a click away. Explore the catalog to find something exciting."
        icon={<BookOpen className="h-8 w-8" />}
        action={onExplore ? { label: 'Explore Catalog', onClick: onExplore } : undefined}
    />
);

export const NoBadgesState: React.FC = () => (
    <EmptyState
        title="Badges are waiting!"
        subtitle="Complete lessons and challenges to earn your first badge. You've got this!"
        icon={<Target className="h-8 w-8" />}
        variant="encouragement"
    />
);

export const NoStreakState: React.FC = () => (
    <EmptyState
        title="Start your streak today!"
        subtitle="Complete a lesson to begin building momentum. Every day counts."
        icon={<Rocket className="h-8 w-8" />}
        variant="encouragement"
    />
);

export const BreakTimeState: React.FC<{ onContinue?: () => void }> = ({ onContinue }) => (
    <EmptyState
        title="Take a breather! ☕"
        subtitle="You're doing great. Rest your brain for a moment, then come back fresh."
        icon={<Coffee className="h-8 w-8" />}
        action={onContinue ? { label: 'Ready to Continue', onClick: onContinue } : undefined}
        variant="success"
    />
);

export const AllDoneState: React.FC<{ message?: string }> = ({ message }) => (
    <EmptyState
        title="All caught up! 🎉"
        subtitle={message ?? "You've completed everything for now. Check back later for new content."}
        icon={<Sparkles className="h-8 w-8" />}
        variant="success"
    />
);

// ─────────────────────────────────────────────────────────────
// Skeleton Loader (for content placeholders)
// ─────────────────────────────────────────────────────────────

interface SkeletonProps {
    className?: string;
    animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', animate = true }) => (
    <div
        className={`bg-slate-200 rounded-lg ${animate ? 'animate-pulse' : ''} ${className}`}
    />
);

export const SkeletonCard: React.FC = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
        </div>
    </div>
);

export const SkeletonLessonCard: React.FC = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
    </div>
);

// ─────────────────────────────────────────────────────────────
// Error State (Non-blaming)
// ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = "Oops, something went sideways!",
    message = "Don't worry, it's not you. Let's try that again.",
    onRetry,
}) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 p-6 text-center"
    >
        <motion.div
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
            <span className="text-2xl">🙈</span>
        </motion.div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4 max-w-xs mx-auto">{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors shadow-sm"
            >
                <Sparkles className="h-4 w-4" />
                Try Again
            </button>
        )}
    </motion.div>
);
