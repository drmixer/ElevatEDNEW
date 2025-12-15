/**
 * ParentTutorControls - Phase 5.3
 * 
 * Parent controls for configuring their child's AI tutor settings.
 * Includes: tutor tone selection, chat mode, lesson-only mode, and daily limits.
 */

import React, { useState } from 'react';
import { Bot, MessageSquare, Lock, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TUTOR_TONES, getTutorToneById, type TutorToneOption } from '../../lib/tutorTones';
import type { LearningPreferences } from '../../types';

export interface ParentTutorControlsProps {
    childName: string;
    preferences: LearningPreferences;
    onSave: (updates: Partial<LearningPreferences>) => Promise<void>;
    saving?: boolean;
}

const ParentTutorControls: React.FC<ParentTutorControlsProps> = ({
    childName,
    preferences,
    onSave,
    saving = false,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [localTone, setLocalTone] = useState<string | null>(preferences.tutorToneId ?? null);
    const [localChatMode, setLocalChatMode] = useState(preferences.chatMode ?? 'free');
    const [localLessonOnly, setLocalLessonOnly] = useState(preferences.tutorLessonOnly ?? false);
    const [localDailyLimit, setLocalDailyLimit] = useState<number | null>(preferences.tutorDailyLimit ?? null);
    const [dirty, setDirty] = useState(false);

    const currentTone = getTutorToneById(localTone);

    const handleToneChange = (toneId: string) => {
        setLocalTone(toneId);
        setDirty(true);
    };

    const handleChatModeChange = (mode: 'guided_only' | 'guided_preferred' | 'free') => {
        setLocalChatMode(mode);
        setDirty(true);
    };

    const handleLessonOnlyToggle = () => {
        setLocalLessonOnly((prev) => !prev);
        setDirty(true);
    };

    const handleDailyLimitChange = (value: string) => {
        const parsed = parseInt(value, 10);
        if (value === '' || value === '0') {
            setLocalDailyLimit(null);
        } else if (!isNaN(parsed) && parsed > 0) {
            setLocalDailyLimit(parsed);
        }
        setDirty(true);
    };

    const handleSave = async () => {
        await onSave({
            tutorToneId: localTone,
            chatMode: localChatMode,
            chatModeLocked: true, // Parent sets = locked
            tutorLessonOnly: localLessonOnly,
            tutorDailyLimit: localDailyLimit,
            tutorSettingsUpdatedAt: new Date().toISOString(),
            tutorSettingsUpdatedBy: 'parent',
        });
        setDirty(false);
    };

    const chatModeOptions = [
        { id: 'guided_only', label: 'Guided Only', description: 'Tutor always asks clarifying questions' },
        { id: 'guided_preferred', label: 'Guided Preferred', description: 'Starts guided, allows follow-ups' },
        { id: 'free', label: 'Free Chat', description: 'Open conversation with guardrails' },
    ] as const;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-slate-900">AI Tutor Settings</p>
                        <p className="text-sm text-slate-500">
                            {currentTone ? currentTone.name : 'Default'} · {localChatMode === 'guided_only' ? 'Guided' : localChatMode === 'guided_preferred' ? 'Guided Preferred' : 'Free Chat'}
                        </p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </motion.div>
            </button>

            {/* Expandable Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-100"
                    >
                        <div className="p-5 space-y-6">
                            {/* Tutor Tone Selection */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare className="h-4 w-4 text-violet-500" />
                                    <p className="text-sm font-semibold text-slate-800">Tutor Personality</p>
                                </div>
                                <p className="text-xs text-slate-500 mb-3">
                                    Choose how the AI tutor communicates with {childName}.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {TUTOR_TONES.map((tone: TutorToneOption) => {
                                        const isSelected = localTone === tone.id;
                                        return (
                                            <button
                                                key={tone.id}
                                                onClick={() => handleToneChange(tone.id)}
                                                className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-400 ${isSelected
                                                        ? 'border-violet-500 bg-violet-50 shadow-sm'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg">{tone.icon}</span>
                                                    <span className="font-semibold text-slate-900 text-sm">{tone.shortName}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2">{tone.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                                {currentTone && (
                                    <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-700 mb-1">Sample response:</p>
                                        <p className="text-xs text-slate-600 italic">"{currentTone.sampleResponses.hint}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Chat Mode */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lock className="h-4 w-4 text-amber-500" />
                                    <p className="text-sm font-semibold text-slate-800">Chat Mode</p>
                                </div>
                                <p className="text-xs text-slate-500 mb-3">
                                    Control how much structure the tutor provides.
                                </p>
                                <div className="space-y-2">
                                    {chatModeOptions.map((option) => {
                                        const isSelected = localChatMode === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                onClick={() => handleChatModeChange(option.id)}
                                                className={`w-full rounded-xl border p-3 text-left transition ${isSelected
                                                        ? 'border-amber-500 bg-amber-50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <p className="font-semibold text-slate-900 text-sm">{option.label}</p>
                                                <p className="text-xs text-slate-500">{option.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Additional Controls */}
                            <div className="space-y-4">
                                {/* Lesson Only Toggle */}
                                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Lesson-Only Mode</p>
                                        <p className="text-xs text-slate-500">Tutor only helps with active lessons</p>
                                    </div>
                                    <button
                                        onClick={handleLessonOnlyToggle}
                                        className={`w-12 h-7 rounded-full p-1 transition ${localLessonOnly ? 'bg-violet-500' : 'bg-slate-300'
                                            }`}
                                    >
                                        <div
                                            className={`h-5 w-5 bg-white rounded-full shadow-sm transform transition ${localLessonOnly ? 'translate-x-5' : ''
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Daily Limit */}
                                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-slate-500" />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Daily Chat Limit</p>
                                            <p className="text-xs text-slate-500">Max tutor conversations per day</p>
                                        </div>
                                    </div>
                                    <select
                                        value={localDailyLimit ?? ''}
                                        onChange={(e) => handleDailyLimitChange(e.target.value)}
                                        className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                                    >
                                        <option value="">No limit</option>
                                        <option value="5">5 chats</option>
                                        <option value="10">10 chats</option>
                                        <option value="15">15 chats</option>
                                        <option value="20">20 chats</option>
                                        <option value="30">30 chats</option>
                                    </select>
                                </div>
                            </div>

                            {/* Save Button */}
                            {dirty && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="pt-2"
                                >
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-3 rounded-xl font-semibold shadow hover:shadow-md transition disabled:opacity-60"
                                    >
                                        {saving ? 'Saving...' : 'Save Tutor Settings'}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ParentTutorControls;
