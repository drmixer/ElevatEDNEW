/**
 * AddLearnerModal - Modal for creating and linking a new learner
 * Extracted from ParentDashboard for maintainability
 */

import React from 'react';
import { Mail, X } from 'lucide-react';
import type { Subject } from '../../../../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AddLearnerFormState {
    name: string;
    email: string;
    grade: number;
    age: string;
    focusSubject: Subject | 'balanced';
    sendInvite: boolean;
    consentAttested: boolean;
}

export interface AddLearnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    formState: AddLearnerFormState;
    onFormChange: (updates: Partial<AddLearnerFormState>) => void;
    onSubmit: (event: React.FormEvent) => void;
    isLoading: boolean;
    error: string | null;
    success: string | null;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const AddLearnerModal: React.FC<AddLearnerModalProps> = ({
    isOpen,
    onClose,
    formState,
    onFormChange,
    onSubmit,
    isLoading,
    error,
    success,
}) => {
    if (!isOpen) return null;

    const isUnder13 = formState.age.trim() !== '' && Number.parseInt(formState.age, 10) < 13;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-slate-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-blue">
                            Add learner
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">Create and link a learner</h2>
                        <p className="text-sm text-slate-600">
                            We'll create the learner account, link it to your family, and generate a Family Link
                            code. Email invites are only sent for learners 13+.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-800"
                        aria-label="Close add learner modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Name and Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-800">Learner name</label>
                            <input
                                type="text"
                                value={formState.name}
                                onChange={(event) => onFormChange({ name: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                                placeholder="Alex Rivera"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                Learner email <Mail className="h-4 w-4 text-slate-500" />
                            </label>
                            <input
                                type="email"
                                value={formState.email}
                                onChange={(event) => onFormChange({ email: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                                placeholder="learner@example.com"
                                required
                            />
                            <p className="text-[11px] text-slate-600">
                                We keep this private and only use it for login.
                            </p>
                        </div>
                    </div>

                    {/* Grade, Age, Focus */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-800">Grade</label>
                            <select
                                value={formState.grade}
                                onChange={(event) => onFormChange({ grade: Number(event.target.value) })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                            >
                                {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                                    <option key={grade} value={grade}>
                                        Grade {grade}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-800">Age</label>
                            <input
                                type="number"
                                min={5}
                                max={18}
                                value={formState.age}
                                onChange={(event) => onFormChange({ age: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                                placeholder="11"
                            />
                            <p className="text-[11px] text-slate-600">
                                Required for under-13 consent; optional otherwise.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-800">Focus (optional)</label>
                            <select
                                value={formState.focusSubject}
                                onChange={(event) =>
                                    onFormChange({ focusSubject: event.target.value as Subject | 'balanced' })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                            >
                                <option value="balanced">Balanced</option>
                                <option value="math">Math first</option>
                                <option value="english">Reading & Writing first</option>
                                <option value="science">Science first</option>
                            </select>
                        </div>
                    </div>

                    {/* Consent & Options */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-800">
                            <input
                                type="checkbox"
                                checked={formState.sendInvite}
                                onChange={(event) => onFormChange({ sendInvite: event.target.checked })}
                                className="h-4 w-4 text-brand-blue focus:ring-brand-blue border-slate-300 rounded"
                                disabled={isUnder13}
                            />
                            Send a sign-in email (13+ only)
                        </label>
                        <label className="flex items-start gap-2 text-sm text-slate-800">
                            <input
                                type="checkbox"
                                checked={formState.consentAttested}
                                onChange={(event) => onFormChange({ consentAttested: event.target.checked })}
                                className="mt-1 h-4 w-4 text-brand-blue focus:ring-brand-blue border-slate-300 rounded"
                            />
                            <span>
                                I am the parent/guardian for this learner and approve creating their account.
                                Required if age is under 13.
                            </span>
                        </label>
                        <p className="text-[11px] text-slate-600">
                            Under-13: no outbound emails. You'll share the Family Link code yourself. 13+: we can
                            email the sign-in link.
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                            {success}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60"
                        >
                            {isLoading ? 'Creating…' : 'Create learner'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddLearnerModal;
