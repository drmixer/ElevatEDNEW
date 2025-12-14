/**
 * Experience Copy Constants - Phase 7.1
 * 
 * Encouraging, stress-free copy to replace negative language across the app.
 * This centralizes student-facing copy to ensure consistency.
 */

// ─────────────────────────────────────────────────────────────
// Error Messages (Non-blaming, Actionable)
// ─────────────────────────────────────────────────────────────

export const FRIENDLY_ERRORS = {
    // Network/Loading errors
    loadFailed: "Hmm, something went sideways. Let's give it another try!",
    saveFailed: "We couldn't save that one. Let's try again!",
    connectionLost: "Connection hiccuped! We'll try again in a moment.",
    timeout: "That took a bit longer than expected. Want to try again?",

    // Action errors
    submitFailed: "We couldn't send that right now. Give it another shot?",
    uploadFailed: "The upload got stuck. Let's try that again!",

    // Generic fallback
    generic: "Oops, something unexpected happened. Let's try again!",

    // Validation (non-blaming)
    missingField: "Looks like we're missing something. Can you fill that in?",
    invalidInput: "That doesn't quite look right. Want to double-check?",
};

// ─────────────────────────────────────────────────────────────
// Encouragement Messages
// ─────────────────────────────────────────────────────────────

export const ENCOURAGEMENT = {
    // After errors
    afterError: [
        "No worries, these things happen!",
        "That's okay! Let's keep going.",
        "Totally fine! Let's try again.",
    ],

    // After incorrect answers (DO NOT USE "wrong" or "incorrect")
    afterMiss: [
        "Good try! Let's look at this together.",
        "Almost there! Here's a hint...",
        "Nice thinking! Let's explore this more.",
        "Close! Want to try again?",
        "Great effort! Let's break this down.",
    ],

    // Progress encouragement
    keepGoing: [
        "You're doing great!",
        "Keep it up!",
        "Awesome progress!",
        "You've got this!",
        "Nice work so far!",
    ],

    // After correct answers
    correct: [
        "Exactly right! 🎉",
        "Nailed it! 🌟",
        "Perfect! ✨",
        "You got it! 👏",
        "Spot on! 🔥",
    ],
};

// ─────────────────────────────────────────────────────────────
// Loading States (Friendly, Never Rushed)
// ─────────────────────────────────────────────────────────────

export const LOADING_MESSAGES = {
    lesson: "Finding your next adventure...",
    dashboard: "Getting your learning journey ready...",
    assessment: "Preparing some fun questions...",
    path: "Building your personalized path...",
    tutor: "Thinking...",
    saving: "Saving your progress...",
    general: "Loading...",
};

// ─────────────────────────────────────────────────────────────
// Empty States (Encouraging, Never Sad)
// ─────────────────────────────────────────────────────────────

export const EMPTY_STATES = {
    noLessons: {
        title: "Ready when you are!",
        subtitle: "Your next lesson is just a click away.",
    },
    noProgress: {
        title: "A fresh start!",
        subtitle: "Every expert was once a beginner. Let's learn something new!",
    },
    noStreak: {
        title: "Start your streak today!",
        subtitle: "Complete a lesson to begin building momentum.",
    },
    noGoals: {
        title: "Set your first goal!",
        subtitle: "Goals help you track progress and celebrate wins.",
    },
    noReflections: {
        title: "What did you learn today?",
        subtitle: "Taking a moment to reflect helps learning stick.",
    },
};

// ─────────────────────────────────────────────────────────────
// Words to Avoid → Better Alternatives
// ─────────────────────────────────────────────────────────────

export const WORD_ALTERNATIVES = {
    // Avoid → Use instead
    test: "check-in",
    exam: "assessment",
    fail: "miss",
    failed: "didn't quite work",
    wrong: "not quite",
    incorrect: "close, but",
    mistake: "learning moment",
    error: "hiccup",
    problem: "challenge",
    difficult: "tricky",
    hard: "challenging",
    bad: "needs practice",
    poor: "developing",
    weak: "growing area",
    weakness: "growth opportunity",
    punishment: "feedback",
    penalty: "adjustment",
};

/**
 * Get a random item from an array
 */
export const pickRandom = <T>(items: T[]): T => {
    return items[Math.floor(Math.random() * items.length)];
};

/**
 * Get a random encouragement message for a miss
 */
export const getEncouragementForMiss = (): string => {
    return pickRandom(ENCOURAGEMENT.afterMiss);
};

/**
 * Get a random encouragement for correct answer
 */
export const getEncouragementForCorrect = (): string => {
    return pickRandom(ENCOURAGEMENT.correct);
};

/**
 * Get a random keep going message
 */
export const getKeepGoingMessage = (): string => {
    return pickRandom(ENCOURAGEMENT.keepGoing);
};

/**
 * Get a random after error message
 */
export const getAfterErrorMessage = (): string => {
    return pickRandom(ENCOURAGEMENT.afterError);
};

/**
 * Get friendly error message by type
 */
export const getFriendlyError = (type: keyof typeof FRIENDLY_ERRORS): string => {
    return FRIENDLY_ERRORS[type] ?? FRIENDLY_ERRORS.generic;
};

/**
 * Get friendly loading message by context
 */
export const getLoadingMessage = (context: keyof typeof LOADING_MESSAGES): string => {
    return LOADING_MESSAGES[context] ?? LOADING_MESSAGES.general;
};

/**
 * Get empty state content by type
 */
export const getEmptyState = (type: keyof typeof EMPTY_STATES) => {
    return EMPTY_STATES[type];
};

/**
 * Convert negative word to friendly alternative
 */
export const friendlyWord = (word: string): string => {
    const lower = word.toLowerCase();
    return WORD_ALTERNATIVES[lower as keyof typeof WORD_ALTERNATIVES] ?? word;
};

/**
 * Get a contextual feedback message based on streak
 */
export const getStreakFeedback = (streak: number): string => {
    if (streak === 0) return "Let's get started!";
    if (streak === 1) return "Great start! Streak of 1 🔥";
    if (streak < 5) return `${streak} day streak! Keep it up! 🔥`;
    if (streak < 10) return `Amazing ${streak} day streak! 🔥🔥`;
    if (streak < 30) return `On fire! ${streak} days strong! 🔥🔥🔥`;
    return `Legendary ${streak} day streak! 👑🔥`;
};

/**
 * Get a progress message based on percentage
 */
export const getProgressFeedback = (percent: number): string => {
    if (percent === 0) return "Ready to begin!";
    if (percent < 25) return "Just getting started! You've got this.";
    if (percent < 50) return "Making progress! Keep going.";
    if (percent < 75) return "Over halfway there! Nice work.";
    if (percent < 100) return "Almost done! The finish line is in sight.";
    return "Complete! Amazing work! 🎉";
};
