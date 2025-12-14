/**
 * TutorToneSelector - UI component for selecting tutor tone/persona
 * Phase 5.1: Clear Tone Options with previews
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { TUTOR_TONES, type TutorToneOption } from '../../lib/tutorTones';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface TutorToneSelectorProps {
    selectedToneId?: string | null;
    onSelect: (toneId: string) => void;
    disabled?: boolean;
    showPreviews?: boolean;
    compact?: boolean;
    label?: string;
    description?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const TutorToneSelector: React.FC<TutorToneSelectorProps> = ({
    selectedToneId,
    onSelect,
    disabled = false,
    showPreviews = true,
    compact = false,
    label = 'Choose your tutor style',
    description = 'Select how your AI tutor communicates. You can change this anytime.',
}) => {
    const [previewToneId, setPreviewToneId] = useState<string | null>(null);
    const [expandedPreview, setExpandedPreview] = useState<'correct' | 'incorrect' | 'hint' | null>(null);

    const selectedTone = TUTOR_TONES.find(t => t.id === selectedToneId) ?? TUTOR_TONES[0];
    const previewTone = previewToneId ? TUTOR_TONES.find(t => t.id === previewToneId) : null;

    const handleSelect = (tone: TutorToneOption) => {
        if (!disabled) {
            onSelect(tone.id);
        }
    };

    if (compact) {
        // Compact dropdown mode
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-semibold text-slate-800">{label}</label>
                )}
                <select
                    value={selectedToneId ?? ''}
                    onChange={(e) => onSelect(e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
                >
                    {TUTOR_TONES.map((tone) => (
                        <option key={tone.id} value={tone.id}>
                            {tone.icon} {tone.name}
                        </option>
                    ))}
                </select>
                {selectedTone && (
                    <p className="text-xs text-slate-600">{selectedTone.description}</p>
                )}
            </div>
        );
    }

    // Full card mode with previews
    return (
        <div className="space-y-4">
            {/* Header */}
            {(label || description) && (
                <div className="space-y-1">
                    {label && (
                        <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
                    )}
                    {description && (
                        <p className="text-sm text-slate-600">{description}</p>
                    )}
                </div>
            )}

            {/* Tone Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TUTOR_TONES.map((tone) => {
                    const isSelected = tone.id === selectedToneId;

                    return (
                        <motion.button
                            key={tone.id}
                            type="button"
                            onClick={() => handleSelect(tone)}
                            onMouseEnter={() => setPreviewToneId(tone.id)}
                            onMouseLeave={() => setPreviewToneId(null)}
                            disabled={disabled}
                            className={`relative text-left p-4 rounded-xl border-2 transition-all ${isSelected
                                ? 'border-brand-blue bg-brand-blue/5 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            whileHover={{ scale: disabled ? 1 : 1.01 }}
                            whileTap={{ scale: disabled ? 1 : 0.99 }}
                        >
                            {/* Selected indicator */}
                            {isSelected && (
                                <div className="absolute top-3 right-3">
                                    <div className="h-5 w-5 rounded-full bg-brand-blue text-white flex items-center justify-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                </div>
                            )}

                            {/* Tone header */}
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">{tone.icon}</span>
                                <div>
                                    <p className={`font-semibold ${isSelected ? 'text-brand-blue' : 'text-slate-900'}`}>
                                        {tone.name}
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-slate-600">{tone.description}</p>
                        </motion.button>
                    );
                })}
            </div>

            {/* Preview Panel */}
            {showPreviews && (
                <AnimatePresence mode="wait">
                    {(previewTone || selectedTone) && (
                        <motion.div
                            key={previewTone?.id ?? selectedTone.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3"
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <MessageCircle className="h-4 w-4 text-brand-blue" />
                                Preview: {(previewTone ?? selectedTone).name}
                            </div>

                            {/* Sample responses */}
                            <div className="space-y-2">
                                {(['correct', 'incorrect', 'hint'] as const).map((type) => {
                                    const sample = (previewTone ?? selectedTone).sampleResponses[type];
                                    const isExpanded = expandedPreview === type;
                                    const labels = {
                                        correct: '✓ When you get it right',
                                        incorrect: '✗ When you need help',
                                        hint: '💡 When giving hints',
                                    };

                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setExpandedPreview(isExpanded ? null : type)}
                                            className="w-full text-left"
                                        >
                                            <div className={`rounded-lg border px-3 py-2 transition-colors ${type === 'correct'
                                                ? 'border-emerald-200 bg-emerald-50/50'
                                                : type === 'incorrect'
                                                    ? 'border-amber-200 bg-amber-50/50'
                                                    : 'border-blue-200 bg-blue-50/50'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-slate-700">
                                                        {labels[type]}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                                    ) : (
                                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                                    )}
                                                </div>
                                                {isExpanded && (
                                                    <motion.p
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-2 text-sm text-slate-800 italic"
                                                    >
                                                        "{sample}"
                                                    </motion.p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};

export default TutorToneSelector;
