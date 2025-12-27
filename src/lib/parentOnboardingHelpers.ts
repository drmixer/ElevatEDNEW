/**
 * Parent Onboarding Helpers
 * 
 * Helper functions for managing parent onboarding state in localStorage.
 */

const ONBOARDING_KEY_PREFIX = 'elevated_parent_onboarding_';

/**
 * Check if parent onboarding should be shown for a given parent
 */
export function shouldShowParentOnboarding(parentId: string): boolean {
    if (typeof window === 'undefined') return false;
    const key = `${ONBOARDING_KEY_PREFIX}${parentId}`;
    return localStorage.getItem(key) !== 'done';
}

/**
 * Mark parent onboarding as completed
 */
export function markParentOnboardingDone(parentId: string): void {
    if (typeof window === 'undefined') return;
    const key = `${ONBOARDING_KEY_PREFIX}${parentId}`;
    localStorage.setItem(key, 'done');
}

/**
 * Reset parent onboarding (for re-running from settings)
 */
export function resetParentOnboarding(parentId: string): void {
    if (typeof window === 'undefined') return;
    const key = `${ONBOARDING_KEY_PREFIX}${parentId}`;
    localStorage.removeItem(key);
}
