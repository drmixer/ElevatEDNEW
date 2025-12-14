/**
 * Offline Cache Utilities - Phase 8.2
 * 
 * Provides local caching for resilience when offline.
 * Uses localStorage for persistence with expiry support.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T;
    cachedAt: string;
    expiresAt: string;
}

type CacheKey =
    | 'current_lesson'
    | 'learning_path'
    | 'student_profile'
    | 'dashboard_data'
    | 'pending_events';

// ─────────────────────────────────────────────────────────────
// Cache Operations
// ─────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'elevatED_cache_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Store data in cache
 */
export const cacheSet = <T>(
    key: CacheKey,
    data: T,
    ttlMs: number = DEFAULT_TTL_MS,
): void => {
    try {
        const entry: CacheEntry<T> = {
            data,
            cachedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        };
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
        console.warn('[Cache] Failed to store:', key, error);
    }
};

/**
 * Get data from cache (returns null if expired or missing)
 */
export const cacheGet = <T>(key: CacheKey): T | null => {
    try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);

        // Check expiry
        if (new Date(entry.expiresAt) < new Date()) {
            localStorage.removeItem(`${CACHE_PREFIX}${key}`);
            return null;
        }

        return entry.data;
    } catch (error) {
        console.warn('[Cache] Failed to read:', key, error);
        return null;
    }
};

/**
 * Get cached data with metadata (including stale check)
 */
export const cacheGetWithMeta = <T>(
    key: CacheKey,
): { data: T; isStale: boolean; cachedAt: Date } | null => {
    try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);
        const isStale = new Date(entry.expiresAt) < new Date();

        return {
            data: entry.data,
            isStale,
            cachedAt: new Date(entry.cachedAt),
        };
    } catch (error) {
        console.warn('[Cache] Failed to read with meta:', key, error);
        return null;
    }
};

/**
 * Remove item from cache
 */
export const cacheRemove = (key: CacheKey): void => {
    try {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
        console.warn('[Cache] Failed to remove:', key, error);
    }
};

/**
 * Clear all cache entries
 */
export const cacheClearAll = (): void => {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.warn('[Cache] Failed to clear all:', error);
    }
};

// ─────────────────────────────────────────────────────────────
// Event Queue for Offline Sync
// ─────────────────────────────────────────────────────────────

interface QueuedEvent {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    queuedAt: string;
    attempts: number;
}

const EVENTS_KEY = 'pending_events';

/**
 * Queue an event for later sync
 */
export const queueEvent = (
    type: string,
    payload: Record<string, unknown>,
): void => {
    try {
        const existing = cacheGet<QueuedEvent[]>(EVENTS_KEY) ?? [];
        const newEvent: QueuedEvent = {
            id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            type,
            payload,
            queuedAt: new Date().toISOString(),
            attempts: 0,
        };

        // Keep only last 50 events to prevent storage bloat
        const updated = [...existing.slice(-49), newEvent];
        cacheSet(EVENTS_KEY, updated, 24 * 60 * 60 * 1000); // 24 hour TTL
    } catch (error) {
        console.warn('[EventQueue] Failed to queue event:', error);
    }
};

/**
 * Get all queued events
 */
export const getQueuedEvents = (): QueuedEvent[] => {
    return cacheGet<QueuedEvent[]>(EVENTS_KEY) ?? [];
};

/**
 * Remove a successfully synced event
 */
export const removeQueuedEvent = (id: string): void => {
    const events = getQueuedEvents();
    const filtered = events.filter(e => e.id !== id);
    cacheSet(EVENTS_KEY, filtered, 24 * 60 * 60 * 1000);
};

/**
 * Mark an event as attempted (for retry logic)
 */
export const markEventAttempted = (id: string): void => {
    const events = getQueuedEvents();
    const updated = events.map(e =>
        e.id === id ? { ...e, attempts: e.attempts + 1 } : e
    );
    cacheSet(EVENTS_KEY, updated, 24 * 60 * 60 * 1000);
};

/**
 * Get count of pending events
 */
export const getPendingEventCount = (): number => {
    return getQueuedEvents().length;
};

// ─────────────────────────────────────────────────────────────
// Freshness Indicator Helper
// ─────────────────────────────────────────────────────────────

/**
 * Get a human-readable freshness string
 */
export const describeFreshness = (cachedAt: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - cachedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 5) return 'A few minutes ago';
    if (diffMins < 30) return `${diffMins} min ago`;
    if (diffMins < 60) return 'About an hour ago';

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return 'More than a day ago';
};
