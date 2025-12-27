/**
 * SafetyTransparencySection - Privacy & Safety Information for Parents
 * 
 * Feature: C.5 Safety & Transparency Surfaces
 * 
 * Provides parents with clear information about:
 * - What the AI tutor does and doesn't do
 * - Data storage summary
 * - Privacy policy links
 * - "Report a concern" workflow
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Lock,
    Eye,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
    ExternalLink,
    CheckCircle,
    XCircle,
    Database,
    UserCheck,
    Bell,
    FileText,
    Send,
    Loader2,
    Flag,
    Info,
} from 'lucide-react';
import { submitConcernReport } from '../../services/concernService';
import type { ConcernCategory } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface SafetyTransparencySectionProps {
    parentId: string;
    studentId?: string | null;
    studentName?: string;
}

interface AccordionItemProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

const AccordionItem: React.FC<AccordionItemProps> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="text-slate-500">{icon}</div>
                    <span className="font-medium text-slate-900">{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-white">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CapabilityItem: React.FC<{ text: string; allowed: boolean }> = ({ text, allowed }) => (
    <div className="flex items-start gap-3 py-2">
        {allowed ? (
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        ) : (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <span className={`text-sm ${allowed ? 'text-slate-700' : 'text-slate-500'}`}>{text}</span>
    </div>
);

// ============================================================================
// Report Concern Modal
// ============================================================================

interface ReportConcernModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentId: string;
    studentId?: string | null;
}

const CONCERN_CATEGORIES: { id: ConcernCategory; label: string; description: string }[] = [
    { id: 'safety', label: 'Safety Concern', description: 'Something that could harm my child' },
    { id: 'content', label: 'Content Issue', description: 'Inappropriate or incorrect content' },
    { id: 'data', label: 'Data & Privacy', description: 'How our data is being used' },
    { id: 'account', label: 'Account Issue', description: 'Problems with our account' },
    { id: 'other', label: 'Other', description: 'Something else' },
];

const ReportConcernModal: React.FC<ReportConcernModalProps> = ({
    isOpen,
    onClose,
    parentId,
    studentId,
}) => {
    const [category, setCategory] = useState<ConcernCategory | null>(null);
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [caseId, setCaseId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async () => {
        if (!category || !description.trim()) {
            setError('Please select a category and describe your concern.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const report = await submitConcernReport({
                requesterId: parentId,
                studentId: studentId ?? undefined,
                category,
                description: description.trim(),
                contactEmail: email.trim() || undefined,
                metadata: {
                    source: 'parent_safety_section',
                },
            });

            setCaseId(report.caseId);
            setSubmitted(true);
        } catch (err) {
            console.error('[ReportConcern] Submit failed:', err);
            setError('Failed to submit your concern. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [category, description, email, parentId, studentId]);

    const handleClose = useCallback(() => {
        setCategory(null);
        setDescription('');
        setEmail('');
        setSubmitted(false);
        setCaseId(null);
        setError(null);
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-xl z-50 max-h-[80vh] overflow-auto"
            >
                <div className="p-6">
                    {!submitted ? (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Flag className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">Report a Concern</h2>
                                    <p className="text-sm text-slate-500">We take all concerns seriously</p>
                                </div>
                            </div>

                            {/* Category Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    What's your concern about?
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {CONCERN_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`flex items-center gap-3 p-3 text-left rounded-xl border transition-all ${category === cat.id
                                                ? 'border-amber-400 bg-amber-50'
                                                : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div
                                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${category === cat.id
                                                    ? 'border-amber-500 bg-amber-500'
                                                    : 'border-slate-300'
                                                    }`}
                                            >
                                                {category === cat.id && (
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{cat.label}</p>
                                                <p className="text-sm text-slate-500">{cat.description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label htmlFor="concern-desc" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Please describe your concern <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="concern-desc"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell us what happened..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                                />
                            </div>

                            {/* Email */}
                            <div className="mb-4">
                                <label htmlFor="concern-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Your email (for follow-up)
                                </label>
                                <input
                                    type="email"
                                    id="concern-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-3 text-slate-700 font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting || !category || !description.trim()}
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
                                            Submit
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                                Concern Reported
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Our team will review this and reach out if needed.
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
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const SafetyTransparencySection: React.FC<SafetyTransparencySectionProps> = ({
    parentId,
    studentId,
    studentName,
}) => {
    const [showConcernModal, setShowConcernModal] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Safety & Privacy</h3>
                        <p className="text-sm text-slate-500">How we protect {studentName || 'your learner'}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                {/* What the AI Tutor Does */}
                <AccordionItem
                    title="What Our AI Tutor Does"
                    icon={<MessageSquare className="w-5 h-5" />}
                    defaultOpen
                >
                    <div className="space-y-1">
                        <CapabilityItem text="Answers questions about lesson content" allowed />
                        <CapabilityItem text="Explains concepts in different ways" allowed />
                        <CapabilityItem text="Provides hints and encouragement" allowed />
                        <CapabilityItem text="Adapts to your child's learning style" allowed />
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                        <CapabilityItem text="Never gives personal advice" allowed={false} />
                        <CapabilityItem text="Never discusses inappropriate topics" allowed={false} />
                        <CapabilityItem text="Never asks for personal information" allowed={false} />
                        <CapabilityItem text="Never communicates outside the platform" allowed={false} />
                    </div>
                </AccordionItem>

                {/* Data Storage */}
                <AccordionItem
                    title="How We Handle Data"
                    icon={<Database className="w-5 h-5" />}
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <Lock className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                                <p className="font-medium text-slate-900">Encrypted & Secure</p>
                                <p className="text-sm text-slate-600">All data is encrypted in transit and at rest</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <UserCheck className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                                <p className="font-medium text-slate-900">COPPA Compliant</p>
                                <p className="text-sm text-slate-600">We follow children's privacy regulations</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Eye className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                                <p className="font-medium text-slate-900">You're In Control</p>
                                <p className="text-sm text-slate-600">Request data export or deletion anytime</p>
                            </div>
                        </div>
                    </div>
                </AccordionItem>

                {/* Notifications & Alerts */}
                <AccordionItem
                    title="Safety Notifications"
                    icon={<Bell className="w-5 h-5" />}
                >
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                            We'll notify you if:
                        </p>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                Your child tries to share personal information
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                Unusual usage patterns are detected
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                Content concerns are flagged for review
                            </li>
                        </ul>
                        <p className="text-sm text-slate-500 pt-2">
                            Manage notifications in <a href="/settings" className="text-teal-600 hover:underline">Settings</a>
                        </p>
                    </div>
                </AccordionItem>

                {/* Policy Links */}
                <AccordionItem
                    title="Privacy & Terms"
                    icon={<FileText className="w-5 h-5" />}
                >
                    <div className="space-y-3">
                        <a
                            href="/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <span className="font-medium text-slate-900">Privacy Policy</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                        <a
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <span className="font-medium text-slate-900">Terms of Service</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                        <a
                            href="/coppa"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <span className="font-medium text-slate-900">COPPA Notice</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                    </div>
                </AccordionItem>

                {/* Report a Concern CTA */}
                <div className="pt-4">
                    <button
                        type="button"
                        onClick={() => setShowConcernModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-700 font-medium transition-colors"
                    >
                        <AlertTriangle className="w-5 h-5" />
                        Report a Concern
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-2">
                        We take all concerns seriously and will respond promptly
                    </p>
                </div>

                {/* Help tip */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-medium">Have questions?</p>
                        <p className="text-blue-600">
                            Contact us at <a href="mailto:support@elevated.com" className="underline">support@elevated.com</a> or visit our <a href="/help" className="underline">Help Center</a>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Report Concern Modal */}
            <ReportConcernModal
                isOpen={showConcernModal}
                onClose={() => setShowConcernModal(false)}
                parentId={parentId}
                studentId={studentId}
            />
        </motion.div>
    );
};

export default SafetyTransparencySection;
