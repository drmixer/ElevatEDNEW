import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import type { Student } from '../../types';
import {
  fetchStudentPaths,
  fetchPreferences,
  listAvatars,
  listTutorPersonas,
  savePlacementProgress,
  startPlacement,
  submitPlacement,
  type PlacementItem,
  type PlacementResponseInput,
  type PlacementStartResponse,
  type StudentPathEntry,
  type StudentSubjectPath,
  type SubjectPlacementKey,
  updatePreferences,
} from '../../services/onboardingService';
import trackEvent from '../../lib/analytics';

type Step = 1 | 2 | 3 | 4;

type OnboardingFlowProps = {
  onComplete: (result?: { pathEntries?: StudentPathEntry[]; subjectPaths?: StudentSubjectPath[] } | null) => void;
};

type SubjectPlacementResult = {
  subject: SubjectPlacementKey;
  expectedLevel: number;
  workingLevel: number;
  levelConfidence: number;
  masteryPct: number;
  entries: StudentPathEntry[];
};

const SUBJECT_ORDER: SubjectPlacementKey[] = ['math', 'english'];

const SUBJECT_LABELS: Record<SubjectPlacementKey, string> = {
  math: 'Math',
  english: 'ELA',
};

const defaultAvatarPalette = { background: '#EEF2FF', accent: '#6366F1', text: '#1F2937' };

const parseAvatarPalette = (metadata?: Record<string, unknown> | null) => {
  const palette = (metadata?.palette as { background?: string; accent?: string; text?: string } | undefined) ?? undefined;
  return {
    background: palette?.background ?? defaultAvatarPalette.background,
    accent: palette?.accent ?? defaultAvatarPalette.accent,
    text: palette?.text ?? defaultAvatarPalette.text,
  };
};

const deriveGradeBandFromGrade = (grade: number | null | undefined): string => {
  if (grade == null || !Number.isFinite(grade)) return '6-8';
  if (grade <= 2) return 'K-2';
  if (grade <= 5) return '3-5';
  if (grade <= 8) return '6-8';
  return '9-12';
};

const summarizePath = (entries: StudentPathEntry[]): StudentPathEntry[] => entries.slice(0, 3);

const confidenceLabel = (confidence: number): string => {
  if (confidence >= 0.8) return 'High confidence';
  if (confidence >= 0.6) return 'Good confidence';
  return 'Low confidence';
};

const subjectExplanation = (result: SubjectPlacementResult): string => {
  if (result.workingLevel === result.expectedLevel) {
    return `Started near Level ${result.expectedLevel} and the diagnostic confirmed that fit.`;
  }
  if (result.workingLevel > result.expectedLevel) {
    return `Started near Level ${result.expectedLevel}, but the diagnostic showed readiness above that starting point.`;
  }
  return `Started near Level ${result.expectedLevel}, and the diagnostic found that a lower working level is the better starting point right now.`;
};

const UpNextList: React.FC<{ entries: StudentPathEntry[]; subjectLabel?: string | null }> = ({ entries, subjectLabel }) => {
  if (!entries.length) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center space-x-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-slate-800">
          {subjectLabel ? `${subjectLabel} up next` : 'Up Next from your path'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map((entry) => {
          const meta = (entry.metadata ?? {}) as Record<string, unknown>;
          const title =
            (meta.module_title as string | undefined) ??
            (meta.module_slug as string | undefined) ??
            `Module ${entry.position}`;
          return (
            <div
              key={entry.id}
              className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-start space-x-3"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center text-sky-700 font-semibold">
                {entry.position}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {entry.type.replace('_', ' ')} · {entry.status === 'not_started' ? 'Ready to start' : entry.status}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { user, refreshUser } = useAuth();
  const student = (user as Student) ?? null;

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState<string>(student?.name ?? '');
  const [ageYears, setAgeYears] = useState<string>('');
  const [currentGrade, setCurrentGrade] = useState<string>(student?.grade != null ? String(student.grade) : '');
  const [optInAi, setOptInAi] = useState<boolean>(true);

  const [avatars, setAvatars] = useState<
    Array<{ id: string; name: string; image_url: string | null; metadata?: Record<string, unknown> | null }>
  >([]);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string; tone?: string | null }>>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('avatar-starter');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [placementItems, setPlacementItems] = useState<PlacementItem[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Map<number, PlacementResponseInput>>(new Map());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [subjectResults, setSubjectResults] = useState<Partial<Record<SubjectPlacementKey, SubjectPlacementResult>>>({});
  const [subjectPaths, setSubjectPaths] = useState<StudentSubjectPath[]>([]);

  const currentSubject = SUBJECT_ORDER[currentSubjectIndex] ?? null;
  const parsedAgeYears =
    ageYears.trim().length > 0 && Number.isFinite(Number(ageYears)) ? Math.round(Number(ageYears)) : null;
  const parsedCurrentGrade =
    currentGrade.trim().length > 0 && Number.isFinite(Number(currentGrade)) ? Math.round(Number(currentGrade)) : null;
  const gradeBand = deriveGradeBandFromGrade(parsedCurrentGrade ?? student?.grade ?? null);

  useEffect(() => {
    setError(null);
    Promise.all([fetchPreferences(), listAvatars('student'), listTutorPersonas(), fetchStudentPaths().catch(() => [])])
      .then(([prefs, avatarList, personaList, paths]) => {
        setOptInAi(prefs.opt_in_ai ?? true);
        setSelectedAvatar(prefs.avatar_id ?? 'avatar-starter');
        setSelectedPersona(prefs.tutor_persona_id ?? null);
        setAvatars(
          avatarList.map((avatar) => ({
            id: avatar.id,
            name: avatar.name,
            image_url: avatar.image_url,
            metadata: avatar.metadata,
          })),
        );
        setPersonas(personaList.map((persona) => ({ id: persona.id, name: persona.name, tone: persona.tone })));
        setSubjectPaths(paths);
      })
      .catch((err) => {
        console.warn('[Onboarding] failed to prime data', err);
        const message = err instanceof Error ? err.message : '';
        if (message.includes('returned HTML') || message.includes('Unexpected token')) {
          setError('This deployment is missing the /api/v1 backend. Please configure the API server/proxy and retry.');
          return;
        }
        setError('Unable to load personalization options right now.');
      });
  }, []);

  const placementProgressPct = useMemo(() => {
    if (!placementItems.length) return 0;
    return Math.round((responses.size / placementItems.length) * 100);
  }, [placementItems.length, responses.size]);

  const subjectCompletionPct = useMemo(() => {
    return Math.round((Object.keys(subjectResults).length / SUBJECT_ORDER.length) * 100);
  }, [subjectResults]);

  const goToStep = (next: Step) => {
    setStep(next);
    setError(null);
  };

  const resetPlacementSession = () => {
    setPlacementItems([]);
    setAttemptId(null);
    setAssessmentId(null);
    setResponses(new Map());
    setCurrentIndex(0);
    setQuestionStartedAt(null);
  };

  const hydrateExistingResponses = (existing: PlacementStartResponse['existingResponses']) => {
    const map = new Map<number, PlacementResponseInput>();
    existing.forEach((resp) => {
      map.set(resp.questionId, {
        bankQuestionId: resp.questionId,
        optionId: resp.selectedOptionId,
        timeSpentSeconds: null,
      });
    });
    setResponses(map);
    setCurrentIndex(existing.length);
  };

  const handleProfileContinue = () => {
    trackEvent('onboarding_profile_saved', {
      age_years: parsedAgeYears,
      grade_level: parsedCurrentGrade,
      grade_band: gradeBand,
      opt_in_ai: optInAi,
    });
    goToStep(2);
  };

  const handlePreferencesSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({
        avatarId: selectedAvatar,
        tutorPersonaId: selectedPersona,
        optInAi,
      });
      goToStep(3);
    } catch (prefError) {
      console.error('[Onboarding] preferences save failed', prefError);
      setError('Could not save your avatar or tutor preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartPlacement = async () => {
    if (!student || !currentSubject) return;
    setLoading(true);
    setError(null);
    try {
      const placement = await startPlacement({
        subject: currentSubject,
        ageYears: parsedAgeYears,
        gradeLevel: parsedCurrentGrade,
        gradeBand,
        fullName,
        optInAi,
        avatarId: selectedAvatar,
        tutorPersonaId: selectedPersona,
      });
      setPlacementItems(placement.items);
      setAttemptId(placement.attemptId);
      setAssessmentId(placement.assessmentId);
      hydrateExistingResponses(placement.existingResponses);
      setQuestionStartedAt(Date.now());
      setStep(3);
      trackEvent('placement_started', {
        assessment_id: placement.assessmentId,
        attempt_id: placement.attemptId,
        grade_band: placement.gradeBand,
        subject: currentSubject,
        expected_level: placement.expectedLevel,
        resume: placement.existingResponses.length > 0,
      });
    } catch (err) {
      console.error('[Onboarding] placement start failed', err);
      const message = err instanceof Error ? err.message : '';
      const normalized = message.toLowerCase();
      if (normalized.includes('missing sections') || normalized.includes('no questions')) {
        setError('We’re updating the placement assessment content right now. Please try again soon.');
      } else if (normalized.includes('content is incomplete') || normalized.includes('content is invalid')) {
        setError('We’re updating the placement assessment content right now. Please try again soon.');
      } else if (normalized.includes('no placement assessment')) {
        setError(`We don’t have a ${SUBJECT_LABELS[currentSubject]} placement assessment available yet. Please try again soon.`);
      } else {
        setError('We could not start your placement assessment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const finalizePlacement = async (answerMap: Map<number, PlacementResponseInput>) => {
    if (!assessmentId || !attemptId || !currentSubject) return;
    setLoading(true);
    setError(null);
    const responseList = Array.from(answerMap.values());
    try {
      const result = await submitPlacement({
        assessmentId,
        attemptId,
        responses: responseList,
        subject: currentSubject,
        ageYears: parsedAgeYears,
        gradeLevel: parsedCurrentGrade,
        gradeBand,
        fullName,
        optInAi,
        avatarId: selectedAvatar,
        tutorPersonaId: selectedPersona,
      });

      setSubjectResults((prev) => ({
        ...prev,
        [currentSubject]: {
          subject: currentSubject,
          expectedLevel: result.expectedLevel,
          workingLevel: result.workingLevel,
          levelConfidence: result.levelConfidence,
          masteryPct: result.masteryPct,
          entries: result.entries,
        },
      }));

      trackEvent('placement_completed', {
        assessment_id: assessmentId,
        attempt_id: attemptId,
        subject: currentSubject,
        mastery_pct: result.masteryPct,
        expected_level: result.expectedLevel,
        working_level: result.workingLevel,
      });

      const nextIndex = currentSubjectIndex + 1;
      if (nextIndex < SUBJECT_ORDER.length) {
        resetPlacementSession();
        setCurrentSubjectIndex(nextIndex);
      } else {
        const refreshedPaths = await fetchStudentPaths().catch(() => []);
        const flattenedEntries = refreshedPaths.flatMap((entry) => entry.path?.entries ?? []);
        setSubjectPaths(refreshedPaths);
        setStep(4);
        await refreshUser().catch(() => undefined);
        onComplete?.({
          pathEntries: flattenedEntries,
          subjectPaths: refreshedPaths,
        });
      }
    } catch (submitError) {
      console.error('[Onboarding] placement submit failed', submitError);
      setError('We could not finish your placement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResponse = async (optionId: number | null) => {
    if (!assessmentId || !attemptId || !placementItems[currentIndex] || !currentSubject) return;
    setSaving(true);
    setError(null);
    const elapsedSeconds = questionStartedAt ? Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)) : 1;
    const item = placementItems[currentIndex];
    try {
      const result = await savePlacementProgress({
        assessmentId,
        attemptId,
        bankQuestionId: item.bankQuestionId,
        optionId,
        timeSpentSeconds: elapsedSeconds,
      });
      const nextMap = new Map(responses);
      nextMap.set(item.bankQuestionId, {
        bankQuestionId: item.bankQuestionId,
        optionId,
        timeSpentSeconds: elapsedSeconds,
      });
      setResponses(nextMap);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= placementItems.length) {
        await finalizePlacement(nextMap);
      } else {
        setCurrentIndex(nextIndex);
        setQuestionStartedAt(Date.now());
      }
      trackEvent('placement_response_saved', {
        question_id: item.bankQuestionId,
        is_correct: result.isCorrect,
        subject: currentSubject,
      });
    } catch (respError) {
      console.error('[Onboarding] save response failed', respError);
      setError("We couldn't save that one. Let's try again!");
    } finally {
      setSaving(false);
    }
  };

  const currentQuestion = placementItems[currentIndex] ?? null;

  const renderStepHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Welcome</p>
        <h2 className="text-2xl font-bold text-slate-900">Let&apos;s personalize your learning path</h2>
      </div>
      <div className="flex items-center space-x-2">
        {[1, 2, 3].map((value) => (
          <div
            key={value}
            className={`h-2 w-16 rounded-full ${step >= value ? 'bg-gradient-to-r from-sky-500 to-emerald-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
    </div>
  );

  const renderProfileStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100"
    >
      {renderStepHeader()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-semibold text-slate-800 flex items-center space-x-2">
            <User className="h-4 w-4 text-sky-500" />
            <span>Preferred name</span>
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-sky-400 focus:outline-none"
            placeholder="What should we call you?"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-800 flex items-center space-x-2">
            <Brain className="h-4 w-4 text-emerald-500" />
            <span>Age</span>
          </label>
          <input
            value={ageYears}
            onChange={(e) => setAgeYears(e.target.value.replace(/[^\d]/g, ''))}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-sky-400 focus:outline-none"
            placeholder="How old are you?"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-800 flex items-center space-x-2">
            <Brain className="h-4 w-4 text-emerald-500" />
            <span>Current grade</span>
          </label>
          <input
            value={currentGrade}
            onChange={(e) => setCurrentGrade(e.target.value.replace(/[^\d]/g, ''))}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-sky-400 focus:outline-none"
            placeholder="Optional"
            inputMode="numeric"
          />
          <p className="mt-2 text-xs text-slate-500">
            We use age and current grade as a starting prior. The diagnostics decide the final working levels.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Expected launch window</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{gradeBand}</p>
          <p className="mt-1 text-xs text-slate-500">This is just the starting band for Math and ELA placement.</p>
        </div>
      </div>
      <div className="mt-4 flex items-center space-x-3 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">AI tutor support</p>
          <p className="text-xs text-slate-500">Toggle access to hints and explanations during practice.</p>
        </div>
        <button
          onClick={() => setOptInAi((prev) => !prev)}
          className={`w-14 h-8 rounded-full p-1 transition ${optInAi ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <div className={`h-6 w-6 bg-white rounded-full shadow-sm transform transition ${optInAi ? 'translate-x-6' : ''}`} />
        </button>
      </div>
      <div className="mt-6 flex justify-between items-center">
        <div className="text-xs text-slate-500">Step 1 of 3</div>
        <button
          onClick={handleProfileContinue}
          className="inline-flex items-center bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow hover:shadow-md transition"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </motion.div>
  );

  const renderPreferencesStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100"
    >
      {renderStepHeader()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Choose an avatar</p>
          <div className="grid grid-cols-2 gap-2">
            {avatars.map((avatar) => {
              const metadata = (avatar.metadata ?? {}) as Record<string, unknown>;
              const palette = parseAvatarPalette(metadata);
              const icon = typeof metadata.icon === 'string' ? metadata.icon : '⭐️';
              const description =
                typeof metadata.description === 'string' && metadata.description.trim().length
                  ? metadata.description
                  : 'Starter look';
              const isSelected = selectedAvatar === avatar.id;
              return (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  aria-pressed={isSelected}
                  className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    isSelected ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center border"
                      style={{ backgroundColor: palette.background, borderColor: palette.accent }}
                    >
                      {avatar.image_url ? (
                        <img
                          src={avatar.image_url}
                          alt={`${avatar.name} avatar`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-2xl" style={{ color: palette.text }} aria-hidden>
                          {icon}
                        </span>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-sky-600" aria-hidden />}
                  </div>
                  <p className="mt-2 font-semibold text-slate-900">{avatar.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{description}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Tutor persona</p>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setSelectedPersona(persona.id)}
                className={`rounded-xl border px-3 py-3 text-left ${
                  selectedPersona === persona.id
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{persona.name}</p>
                <p className="text-xs text-slate-500 capitalize">{persona.tone ?? 'Supportive'} tone</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() => goToStep(1)}
          className="inline-flex items-center text-slate-600 hover:text-slate-800 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <button
          onClick={handlePreferencesSave}
          disabled={saving}
          className="inline-flex items-center bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow hover:shadow-md transition disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue to check-in
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderPlacementStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100"
    >
      {renderStepHeader()}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-600">Subject placement</p>
          <p className="text-xs text-slate-500">
            Deterministic first pass: Math and ELA each get their own short check-in.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{subjectCompletionPct}% complete</p>
          <p className="text-xs text-slate-500">{Object.keys(subjectResults).length} of {SUBJECT_ORDER.length} subjects finished</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {SUBJECT_ORDER.map((subjectKey, index) => {
          const result = subjectResults[subjectKey];
          const isCurrent = currentSubject === subjectKey;
          return (
            <div
              key={subjectKey}
              className={`rounded-2xl border px-4 py-4 ${
                result
                  ? 'border-emerald-200 bg-emerald-50'
                  : isCurrent
                    ? 'border-sky-200 bg-sky-50'
                    : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{SUBJECT_LABELS[subjectKey]}</p>
                {result ? (
                  <span className="text-xs font-semibold text-emerald-700">Placed</span>
                ) : isCurrent ? (
                  <span className="text-xs font-semibold text-sky-700">Current</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">Up next</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {result
                  ? `Working level ${result.workingLevel}`
                  : index < currentSubjectIndex
                    ? 'Completed'
                    : 'Not started yet'}
              </p>
            </div>
          );
        })}
      </div>

      {!placementItems.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700 font-semibold mb-2">
            {currentSubject ? `Ready for your ${SUBJECT_LABELS[currentSubject]} check-in?` : 'Wrapping up your results'}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            {currentSubject
              ? 'No pressure. This helps us choose the best starting point, not judge performance.'
              : 'We are saving your placement results.'}
          </p>
          {currentSubject && (
            <button
              onClick={handleStartPlacement}
              disabled={loading}
              className="inline-flex items-center bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow hover:shadow-md transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading questions...
                </>
              ) : (
                <>
                  Start {SUBJECT_LABELS[currentSubject]}
                  <Play className="h-4 w-4 ml-2" />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {SUBJECT_LABELS[currentSubject ?? 'math']} check-in ({currentIndex + 1} of {placementItems.length})
              </p>
              <h3 className="text-lg font-semibold text-slate-900 mt-1">{currentQuestion?.prompt}</h3>
            </div>
            <div className="text-xs text-slate-500">{placementProgressPct}% complete</div>
          </div>
          <div className="mt-4 space-y-2">
            {currentQuestion?.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSaveResponse(option.id)}
                disabled={saving}
                className="w-full text-left border border-slate-200 rounded-xl px-4 py-3 hover:border-sky-400 hover:bg-sky-50 transition disabled:opacity-60"
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() => goToStep(2)}
          className="inline-flex items-center text-slate-600 hover:text-slate-800 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <div className="text-xs text-slate-500">Step 3 of 3</div>
      </div>
    </motion.div>
  );

  const renderCompletion = () => {
    const completedResults = SUBJECT_ORDER.map((subject) => subjectResults[subject]).filter(
      (value): value is SubjectPlacementResult => Boolean(value),
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-emerald-700 font-semibold">Placement complete</p>
            <h3 className="text-xl font-bold text-slate-900">You&apos;re all set to start learning</h3>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Nice work, {fullName || 'learner'}! We&apos;ve set separate starting points for Math and ELA so your first paths are useful and explainable.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedResults.map((result) => (
            <div key={result.subject} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{SUBJECT_LABELS[result.subject]}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">Working level {result.workingLevel}</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                  {confidenceLabel(result.levelConfidence)}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{subjectExplanation(result)}</p>
              <p className="mt-2 text-xs text-slate-500">Diagnostic score: {result.masteryPct}%</p>
              <UpNextList entries={summarizePath(result.entries)} subjectLabel={SUBJECT_LABELS[result.subject]} />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-3">
            <Brain className="h-4 w-4 text-sky-500" />
            <p className="text-sm font-semibold text-slate-800">What happens next</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900">Separate by subject</p>
              <p className="text-xs text-slate-600">Math and ELA can move at different levels. We won&apos;t force one global grade guess.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900">Deterministic first</p>
              <p className="text-xs text-slate-600">These starting paths come from age, grade, and diagnostic results, not opaque AI judgments.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900">Start small</p>
              <p className="text-xs text-slate-600">The first lessons are chosen to be understandable and trustworthy, then we can tune from there.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => onComplete?.({
              pathEntries: subjectPaths.flatMap((entry) => entry.path?.entries ?? []),
              subjectPaths,
            })}
            className="inline-flex items-center bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow hover:shadow-md transition"
          >
            Let&apos;s start learning!
            <ArrowRight className="h-4 w-4 ml-2" />
          </button>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    if (step === 1) return renderProfileStep();
    if (step === 2) return renderPreferencesStep();
    if (step === 3) return renderPlacementStep();
    return renderCompletion();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-5xl w-full">
        <div className="mb-4 flex items-center space-x-2 text-slate-600 text-sm">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Getting to know you</span>
        </div>
        <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        {error && (
          <div className="mt-4 border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingFlow;
