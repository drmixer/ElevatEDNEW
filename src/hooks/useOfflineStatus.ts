/**
 * useOfflineStatus - Phase 8.2
 * 
 * React hook for tracking online/offline status with UI components.
 */

import { useState, useEffect } from 'react';
import { checkIsOffline, onOfflineChange } from '../monitoring';

interface OfflineStatus {
    isOffline: boolean;
    wasRecentlyOffline: boolean;
}

/**
 * Hook to track online/offline status
 */
export const useOfflineStatus = (): OfflineStatus => {
    const [isOffline, setIsOffline] = useState(checkIsOffline());
    const [wasRecentlyOffline, setWasRecentlyOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = onOfflineChange((offline) => {
            setIsOffline(offline);

            // When coming back online, keep indicator briefly
            if (!offline && isOffline) {
                setWasRecentlyOffline(true);
                const timeout = setTimeout(() => {
                    setWasRecentlyOffline(false);
                }, 3000);
                return () => clearTimeout(timeout);
            }
        });

        return unsubscribe;
    }, [isOffline]);

    return { isOffline, wasRecentlyOffline };
};

export default useOfflineStatus;
