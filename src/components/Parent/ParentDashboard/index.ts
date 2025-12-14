/**
 * ParentDashboard Module
 * 
 * This barrel export provides access to all ParentDashboard submodules.
 * The main ParentDashboard component is still in ParentDashboard.tsx at the parent level,
 * but can be gradually migrated to use these extracted modules.
 * 
 * Directory structure:
 * - components/  - Shared UI components (SkeletonCard, PlanTag, LockedFeature)
 * - hooks/       - Custom hooks (useAlertManagement, useDiagnosticManagement)
 * - modals/      - Modal components (AddLearnerModal)
 * - sections/    - Major UI sections (DashboardHeader)
 * - utils/       - Helper functions and style constants
 */

// Components
export * from './components';

// Hooks
export * from './hooks';

// Modals
export * from './modals';

// Sections
export * from './sections';

// Utilities
export * from './utils';

