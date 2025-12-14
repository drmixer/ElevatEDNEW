/**
 * Shared Components Index
 * 
 * Re-exports all shared/reusable components for easy importing.
 */

// Phase 7.3: Friendly states (loading, empty, error)
export {
    FriendlyLoading,
    EmptyState,
    NoLessonsState,
    NoBadgesState,
    NoStreakState,
    BreakTimeState,
    AllDoneState,
    Skeleton,
    SkeletonCard,
    SkeletonLessonCard,
    ErrorState,
} from './FriendlyStates';

// Phase 8.2: Offline indicator
export { default as OfflineIndicator } from './OfflineIndicator';
