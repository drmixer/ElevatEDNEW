/**
 * ParentAssignmentControls - Sprint 4 (Phase C.4)
 * 
 * Parent controls for assigning lessons to children:
 * - Assign lessons from subject card
 * - Weekly lesson target stepper
 * - Assignment states (Not started / In progress / Completed)
 * - Guardrails (within 1 unit of adaptive path - handled by backend)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BookOpen,
    X,
    ChevronUp,
    ChevronDown,
    CheckCircle2,
    Clock,
    CircleDashed,
    Send,
    Loader2,
    Target,
    Plus,
    Calendar,
    AlertCircle,
} from 'lucide-react';
import type { Subject, AssignmentSummary, CatalogModule } from '../../types';
import { formatSubjectLabel } from '../../lib/subjects';
import { assignModuleToStudents, fetchChildAssignments } from '../../services/assignmentService';
import { fetchCatalogModules } from '../../services/catalogService';
import trackEvent from '../../lib/analytics';

// ============================================================================
// Types
// ============================================================================

interface ParentAssignmentControlsProps {
    childId: string;
    childName: string;
    childGrade: number;
    subject?: Subject;
    onClose?: () => void;
}

interface WeeklyTargetStepperProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label?: string;
}

interface AssignmentCardProps {
    assignment: AssignmentSummary;
}

interface ModuleSelectorProps {
    subject?: Subject;
    grade: number;
    onSelect: (module: CatalogModule) => void;
    selectedModuleId?: number;
}

// ============================================================================
// Sub-components
// ============================================================================

const WeeklyTargetStepper: React.FC<WeeklyTargetStepperProps> = ({
    value,
    onChange,
    min = 1,
    max = 10,
    label = 'Weekly lessons target',
}) => {
    const increment = useCallback(() => {
        if (value < max) onChange(value + 1);
    }, [value, max, onChange]);

    const decrement = useCallback(() => {
        if (value > min) onChange(value - 1);
    }, [value, min, onChange]);

    return (
        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                    <p className="font-medium text-slate-900 text-sm">{label}</p>
                    <p className="text-xs text-slate-500">Lessons per week</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={decrement}
                    disabled={value <= min}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease target"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-bold text-lg text-slate-900">
                    {value}
                </span>
                <button
                    type="button"
                    onClick={increment}
                    disabled={value >= max}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase target"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const statusConfig = {
    not_started: {
        label: 'Not started',
        icon: CircleDashed,
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
    },
    in_progress: {
        label: 'In progress',
        icon: Clock,
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    completed: {
        label: 'Completed',
        icon: CheckCircle2,
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
    },
};

const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment }) => {
    const config = statusConfig[assignment.status] ?? statusConfig.not_started;
    const StatusIcon = config.icon;

    const dueDate = assignment.dueAt ? new Date(assignment.dueAt) : null;
    const isOverdue = dueDate && dueDate < new Date() && assignment.status !== 'completed';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${config.border} ${config.bg} transition-all hover:shadow-sm`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 text-sm truncate">
                        {assignment.title}
                    </h4>
                    {assignment.moduleTitle && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {assignment.moduleTitle}
                        </p>
                    )}
                </div>
                <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                >
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                </span>
            </div>

            {dueDate && (
                <div className={`mt-2 flex items-center gap-1.5 text-xs ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                    <Calendar className="w-3 h-3" />
                    <span>
                        {isOverdue ? 'Overdue: ' : 'Due: '}
                        {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>
            )}
        </motion.div>
    );
};

const ModuleSelector: React.FC<ModuleSelectorProps> = ({
    subject,
    grade,
    onSelect,
    selectedModuleId,
}) => {
    const { data: modules, isLoading } = useQuery({
        queryKey: ['parent-modules', subject, grade],
        queryFn: async () => {
            // Convert grade number to grade band string
            const gradeBand = grade <= 2 ? 'K-2' : grade <= 5 ? '3-5' : grade <= 8 ? '6-8' : '9-12';
            const result = await fetchCatalogModules({
                subject: subject ?? undefined,
                grade: gradeBand,
                pageSize: 20,
            });
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-blue/60" />
            </div>
        );
    }

    if (!modules?.length) {
        return (
            <div className="text-center py-8 text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No modules available for this subject and grade.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-64 overflow-y-auto">
            {modules.map((module) => (
                <button
                    key={module.id}
                    type="button"
                    onClick={() => onSelect(module)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedModuleId === module.id
                        ? 'border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/30'
                        : 'border-slate-200 bg-white hover:border-brand-blue/40 hover:bg-slate-50'
                        }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedModuleId === module.id ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-slate-900 text-sm truncate">
                                {module.title}
                            </h5>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {module.subject} • {module.gradeBand}
                            </p>
                        </div>
                        {selectedModuleId === module.id && (
                            <CheckCircle2 className="w-5 h-5 text-brand-blue flex-shrink-0" />
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const ParentAssignmentControls: React.FC<ParentAssignmentControlsProps> = ({
    childId,
    childName,
    childGrade,
    subject,
    onClose,
}) => {
    const queryClient = useQueryClient();
    const firstName = childName.split(' ')[0];

    // State
    const [weeklyTarget, setWeeklyTarget] = useState(3);
    const [selectedModule, setSelectedModule] = useState<CatalogModule | null>(null);
    const [dueDate, setDueDate] = useState<string>('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [step, setStep] = useState<'list' | 'assign'>('list');

    // Fetch existing assignments
    const { data: assignments, isLoading: loadingAssignments } = useQuery({
        queryKey: ['child-assignments', childId],
        queryFn: () => fetchChildAssignments(childId),
        staleTime: 2 * 60 * 1000,
        enabled: Boolean(childId),
    });

    // Assignment mutation
    const assignMutation = useMutation({
        mutationFn: async () => {
            if (!selectedModule) throw new Error('No module selected');

            return assignModuleToStudents({
                moduleId: selectedModule.id,
                studentIds: [childId],
                dueAt: dueDate || null,
                title: `${selectedModule.title} focus`,
            });
        },
        onSuccess: (result) => {
            setShowSuccess(true);
            setSelectedModule(null);
            setDueDate('');
            setStep('list');

            trackEvent('parent_module_assigned', {
                child_id: childId,
                module_id: selectedModule?.id,
                assignment_id: result.assignmentId,
            });

            // Refresh assignments list
            queryClient.invalidateQueries({ queryKey: ['child-assignments', childId] });

            // Auto-hide success message
            setTimeout(() => setShowSuccess(false), 3000);
        },
        onError: (error) => {
            trackEvent('parent_assignment_error', {
                child_id: childId,
                module_id: selectedModule?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        },
    });

    // Summary calculations
    const assignmentSummary = useMemo(() => {
        if (!assignments?.length) return { notStarted: 0, inProgress: 0, completed: 0, total: 0 };
        return assignments.reduce(
            (acc, a) => {
                acc.total += 1;
                if (a.status === 'not_started') acc.notStarted += 1;
                else if (a.status === 'in_progress') acc.inProgress += 1;
                else if (a.status === 'completed') acc.completed += 1;
                return acc;
            },
            { notStarted: 0, inProgress: 0, completed: 0, total: 0 },
        );
    }, [assignments]);

    const handleAssign = useCallback(() => {
        if (selectedModule) {
            assignMutation.mutate();
        }
    }, [selectedModule, assignMutation]);

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-blue/5 to-brand-violet/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">
                                {firstName}'s Assignments
                            </h2>
                            <p className="text-xs text-slate-500">
                                {subject ? formatSubjectLabel(subject) : 'All subjects'}
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Success Banner */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-emerald-50 border-b border-emerald-100 px-6 py-3"
                    >
                        <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Assignment created successfully!</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                    {step === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {/* Weekly Target Stepper */}
                            <WeeklyTargetStepper
                                value={weeklyTarget}
                                onChange={setWeeklyTarget}
                                label={`${firstName}'s weekly target`}
                            />

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <CircleDashed className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                                    <p className="text-lg font-bold text-slate-900">{assignmentSummary.notStarted}</p>
                                    <p className="text-xs text-slate-500">Not started</p>
                                </div>
                                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-200">
                                    <Clock className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                                    <p className="text-lg font-bold text-slate-900">{assignmentSummary.inProgress}</p>
                                    <p className="text-xs text-slate-500">In progress</p>
                                </div>
                                <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                                    <p className="text-lg font-bold text-slate-900">{assignmentSummary.completed}</p>
                                    <p className="text-xs text-slate-500">Completed</p>
                                </div>
                            </div>

                            {/* Create Assignment Button */}
                            <button
                                type="button"
                                onClick={() => setStep('assign')}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-violet transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Assign New Module
                            </button>

                            {/* Existing Assignments */}
                            <div>
                                <h3 className="font-medium text-slate-900 mb-3">Current Assignments</h3>
                                {loadingAssignments ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-brand-blue/60" />
                                    </div>
                                ) : assignments?.length ? (
                                    <div className="space-y-2">
                                        {assignments.slice(0, 5).map((assignment) => (
                                            <AssignmentCard key={assignment.id} assignment={assignment} />
                                        ))}
                                        {assignments.length > 5 && (
                                            <p className="text-center text-xs text-slate-500 py-2">
                                                +{assignments.length - 5} more assignments
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-500">
                                        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No assignments yet.</p>
                                        <p className="text-xs">Assign a module to get started!</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="assign"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            {/* Back button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setStep('list');
                                    setSelectedModule(null);
                                }}
                                className="text-sm text-brand-blue hover:text-brand-violet font-medium flex items-center gap-1"
                            >
                                ← Back to assignments
                            </button>

                            {/* Module Selector */}
                            <div>
                                <h3 className="font-medium text-slate-900 mb-3">Select a Module</h3>
                                <ModuleSelector
                                    subject={subject}
                                    grade={childGrade}
                                    onSelect={setSelectedModule}
                                    selectedModuleId={selectedModule?.id}
                                />
                            </div>

                            {/* Due Date (optional) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    Due Date (optional)
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                />
                            </div>

                            {/* Error Message */}
                            {assignMutation.isError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>
                                        {assignMutation.error instanceof Error
                                            ? assignMutation.error.message
                                            : 'Failed to create assignment. Please try again.'}
                                    </span>
                                </div>
                            )}

                            {/* Assign Button */}
                            <button
                                type="button"
                                onClick={handleAssign}
                                disabled={!selectedModule || assignMutation.isPending}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-violet disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {assignMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Assign to {firstName}
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ParentAssignmentControls;
