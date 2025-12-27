/**
 * ContentIssueReport - Report Content Issues Button & Modal
 * 
 * Feature: D.3 User Feedback Integration
 * 
 * Allows students and parents to report content issues within lessons.
 * Issue types: Incorrect content, Confusing explanation, Missing information, 
 * Inappropriate content, Technical error, Other
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flag,
    X,
    AlertTriangle,
    FileQuestion,
    BookX,
    ShieldAlert,
    Bug,
    HelpCircle,
    CheckCircle,
    Loader2,
    Send,
} from 'lucide-react';
import { submitConcernReport } from '../../services/concernService';
import type { ConcernCategory } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface ContentIssueReportProps {
    lessonId: number;
    lessonTitle: string;
    subject: string;
    userId: string;
    studentId?: string | null;
    className?: string;
    compact?: boolean;
}

type IssueType = {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    category: ConcernCategory;
};

const ISSUE_TYPES: IssueType[] = [
    {
        id: 'incorrect',
        label: 'Incorrect Content',
        description: 'Facts, answers, or explanations that are wrong',
        icon: <BookX className="w-5 h-5" />,
        category: 'content',
    },
    {
        id: 'confusing',
        label: 'Confusing Explanation',
        description: 'Hard to understand or poorly written',
        icon: <FileQuestion className="w-5 h-5" />,
        category: 'content',
    },
    {
        id: 'missing',
        label: 'Missing Information',
        description: 'Important content is incomplete',
        icon: <HelpCircle className="w-5 h-5" />,
        category: 'content',
    },
    {
        id: 'inappropriate',
        label: 'Inappropriate Content',
        description: 'Not suitable for the grade level or context',
        icon: <ShieldAlert className="w-5 h-5" />,
        category: 'safety',
    },
    {
        id: 'technical',
        label: 'Technical Error',
        description: 'Broken images, links, or display issues',
        icon: <Bug className="w-5 h-5" />,
        category: 'other',
    },
    {
        id: 'other',
        label: 'Other Issue',
        description: 'Something else not listed above',
        icon: <AlertTriangle className="w-5 h-5" />,
        category: 'other',
    },
];

// ============================================================================
// ReportButton Component (Inline trigger)
// ============================================================================

interface ReportButtonProps {
    onClick: () => void;
    compact?: boolean;
}

const ReportButton: React.FC<ReportButtonProps> = ({ onClick, compact }) => (
    <button
        type="button"
        onClick={onClick}
        className={`
            inline-flex items-center gap-1.5 transition-all
            ${compact
                ? 'p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg'
                : 'px-3 py-1.5 text-sm text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-200'
            }
        `}
        title="Report an issue with this content"
    >
        <Flag className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
        {!compact && <span>Report Issue</span>}
    </button>
);

// ============================================================================
// Modal Component
// ============================================================================

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    lessonId: number;
    lessonTitle: string;
    subject: string;
    userId: string;
    studentId?: string | null;
}

const ReportModal: React.FC<ReportModalProps> = ({
    isOpen,
    onClose,
    lessonId,
    lessonTitle,
    subject,
    userId,
    studentId,
}) => {
    const [step, setStep] = useState<'type' | 'details' | 'success'>('type');
    const [selectedType, setSelectedType] = useState<IssueType | null>(null);
    const [description, setDescription] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [caseId, setCaseId] = useState<string | null>(null);

    const handleSelectType = useCallback((issueType: IssueType) => {
        setSelectedType(issueType);
        setStep('details');
    }, []);

    const handleBack = useCallback(() => {
        setStep('type');
        setError(null);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!selectedType || !description.trim()) {
            setError('Please describe the issue.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const report = await submitConcernReport({
                requesterId: userId,
                studentId: studentId ?? undefined,
                category: selectedType.category,
                description: `[${selectedType.label}] ${description.trim()}`,
                contactEmail: contactEmail.trim() || undefined,
                metadata: {
                    source: 'lesson_content_report',
                    lessonId,
                    lessonTitle,
                    subject,
                    issueType: selectedType.id,
                },
            });

            setCaseId(report.caseId);
            setStep('success');
        } catch (err) {
            console.error('[ContentIssueReport] Submit failed:', err);
            setError('Failed to submit your report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [selectedType, description, contactEmail, userId, studentId, lessonId, lessonTitle, subject]);

    const handleClose = useCallback(() => {
        // Reset state on close
        setStep('type');
        setSelectedType(null);
        setDescription('');
        setContactEmail('');
        setError(null);
        setCaseId(null);
        onClose();
    }, [onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Flag className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Report Content Issue</h2>
                                    <p className="text-sm text-slate-500 truncate max-w-[250px]">{lessonTitle}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <AnimatePresence mode="wait">
                                {step === 'type' && (
                                    <motion.div
                                        key="type"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <p className="text-sm text-slate-600 mb-4">
                                            What type of issue did you find?
                                        </p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {ISSUE_TYPES.map((issueType) => (
                                                <button
                                                    key={issueType.id}
                                                    type="button"
                                                    onClick={() => handleSelectType(issueType)}
                                                    className="flex items-center gap-4 p-4 text-left bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                                                >
                                                    <div className="w-10 h-10 bg-white border border-slate-200 group-hover:border-amber-300 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-amber-600 transition-colors">
                                                        {issueType.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-900 group-hover:text-amber-700">
                                                            {issueType.label}
                                                        </p>
                                                        <p className="text-sm text-slate-500 truncate">
                                                            {issueType.description}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {step === 'details' && selectedType && (
                                    <motion.div
                                        key="details"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        {/* Selected type badge */}
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                            {selectedType.icon}
                                            <span className="font-medium text-amber-700">{selectedType.label}</span>
                                            <button
                                                type="button"
                                                onClick={handleBack}
                                                className="ml-1 p-0.5 text-amber-500 hover:text-amber-700"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label htmlFor="issue-description" className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Describe the issue <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                id="issue-description"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Please describe what you found..."
                                                rows={4}
                                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-slate-900 placeholder-slate-400"
                                            />
                                        </div>

                                        {/* Contact email (optional) */}
                                        <div>
                                            <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Email (optional)
                                            </label>
                                            <input
                                                type="email"
                                                id="contact-email"
                                                value={contactEmail}
                                                onChange={(e) => setContactEmail(e.target.value)}
                                                placeholder="your@email.com"
                                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 placeholder-slate-400"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                We'll only use this to follow up if needed.
                                            </p>
                                        </div>

                                        {/* Error message */}
                                        {error && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                {error}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handleBack}
                                                className="flex-1 px-4 py-3 text-slate-700 font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={submitting || !description.trim()}
                                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-white font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-xl transition-colors"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-4 h-4" />
                                                        Submit Report
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-center py-8"
                                    >
                                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-slate-900 mb-2">
                                            Report Submitted!
                                        </h3>
                                        <p className="text-slate-600 mb-4">
                                            Thank you for helping us improve our content.
                                        </p>
                                        {caseId && (
                                            <p className="text-sm text-slate-500 mb-6">
                                                Reference: <span className="font-mono font-medium">{caseId}</span>
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="px-6 py-3 text-white font-medium bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                                        >
                                            Done
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const ContentIssueReport: React.FC<ContentIssueReportProps> = ({
    lessonId,
    lessonTitle,
    subject,
    userId,
    studentId,
    className = '',
    compact = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={className}>
            <ReportButton onClick={() => setIsOpen(true)} compact={compact} />
            <ReportModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                lessonId={lessonId}
                lessonTitle={lessonTitle}
                subject={subject}
                userId={userId}
                studentId={studentId}
            />
        </div>
    );
};

export default ContentIssueReport;
