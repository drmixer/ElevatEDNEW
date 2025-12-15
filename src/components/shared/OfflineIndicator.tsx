/**
 * OfflineIndicator - Phase 8.2
 * 
 * UI component that shows when the app is offline.
 * Non-intrusive, informative, and reassuring.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

interface OfflineIndicatorProps {
    position?: 'top' | 'bottom';
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ position = 'bottom' }) => {
    const { isOffline, wasRecentlyOffline } = useOfflineStatus();

    const positionClasses = position === 'top'
        ? 'top-0 left-0 right-0'
        : 'bottom-0 left-0 right-0';

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
                    className={`fixed ${positionClasses} z-50 p-3`}
                >
                    <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                        <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <WifiOff className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800">You're offline</p>
                            <p className="text-xs text-amber-600">
                                Don't worry! Your progress is saved and will sync when you're back online.
                            </p>
                        </div>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                            <RefreshCw className="h-4 w-4 text-amber-400" />
                        </motion.div>
                    </div>
                </motion.div>
            )}

            {!isOffline && wasRecentlyOffline && (
                <motion.div
                    initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
                    className={`fixed ${positionClasses} z-50 p-3`}
                >
                    <div className="max-w-md mx-auto bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                        <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-emerald-800">Back online!</p>
                            <p className="text-xs text-emerald-600">
                                Your progress is syncing now.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OfflineIndicator;
