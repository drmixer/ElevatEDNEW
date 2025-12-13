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
  fetchPreferences,
  fetchStudentPath,
  listAvatars,
  listTutorPersonas,
  savePlacementProgress,
  startPlacement,
  submitPlacement,
  type PlacementItem,
  type PlacementResponseInput,
  type PlacementStartResponse,
  type StudentPathEntry,
  updatePreferences,
} from '../../services/onboardingService';
import trackEvent from '../../lib/analytics';

type Step = 1 | 2 | 3 | 4;

type OnboardingFlowProps = {
  onComplete: (result?: { pathEntries?: StudentPathEntry[] } | null) => void;
};

const gradeBands = ['K-2', '3-5', '6-8', '9-12'];

const summarizePath = (entries: StudentPathEntry[]): StudentPathEntry[] => entries.slice(0, 4);

const UpNextList: React.FC<{ entries: StudentPathEntry[] }> = ({ entries }) => {
  if (!entries.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center space-x-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-slate-800">Up Next from your path</p>
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
  const [gradeBand, setGradeBand] = useState<string>('6-8');
  const [optInAi, setOptInAi] = useState<boolean>(true);

  const [avatars, setAvatars] = useState<Array<{ id: string; name: string; metadata?: Record<string, unknown> | null }>>(
    [],
  );
  const [personas, setPersonas] = useState<Array<{ id: string; name: string; tone?: string | null }>>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('avatar-starter');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const [placementItems, setPlacementItems] = useState<PlacementItem[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Map<number, PlacementResponseInput>>(new Map());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [pathEntries, setPathEntries] = useState<StudentPathEntry[]>([]);

  useEffect(() => {
    setError(null);
    Promise.all([fetchPreferences(), listAvatars('student'), listTutorPersonas(), fetchStudentPath().catch(() => null)])
      .then(([prefs, avatarList, personaList, path]) => {
        setOptInAi(prefs.opt_in_ai ?? true);
        setSelectedAvatar(prefs.avatar_id ?? 'avatar-starter');
        setSelectedPersona(prefs.tutor_persona_id ?? null);
        const bandFromStudent =
          student?.grade != null
            ? student.grade <= 2
              ? 'K-2'
              : student.grade <= 5
                ? '3-5'
              : student.grade <= 8
                ? '6-8'
                : '9-12'
            : '6-8';
        setGradeBand(bandFromStudent);
        setAvatars(avatarList.map((avatar) => ({ id: avatar.id, name: avatar.name, metadata: avatar.metadata })));
        setPersonas(personaList.map((persona) => ({ id: persona.id, name: persona.name, tone: persona.tone })));
        if (path?.entries?.length) {
          setPathEntries(path.entries as StudentPathEntry[]);
        }
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
  }, [student?.grade]);

  const placementProgressPct = useMemo(() => {
    if (!placementItems.length) return 0;
    return Math.round((responses.size / placementItems.length) * 100);
  }, [placementItems.length, responses.size]);

  const goToStep = (next: Step) => {
    setStep(next);
    setError(null);
  };

  const handleProfileContinue = () => {
    trackEvent('onboarding_profile_saved', { grade_band: gradeBand, opt_in_ai: optInAi });
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

  const handleStartPlacement = async () => {
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const placement = await startPlacement({
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
        resume: placement.existingResponses.length > 0,
      });
    } catch (err) {
      console.error('[Onboarding] placement start failed', err);
      setError('We could not start your placement assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResponse = async (optionId: number | null) => {
    if (!assessmentId || !attemptId || !placementItems[currentIndex]) return;
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
      });
    } catch (respError) {
      console.error('[Onboarding] save response failed', respError);
      setError('Saving your answer failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const finalizePlacement = async (answerMap: Map<number, PlacementResponseInput>) => {
    if (!assessmentId || !attemptId) return;
    setLoading(true);
    setError(null);
    const responseList = Array.from(answerMap.values());
    try {
      const result = await submitPlacement({
        assessmentId,
        attemptId,
        responses: responseList,
        gradeBand,
        fullName,
        optInAi,
        avatarId: selectedAvatar,
        tutorPersonaId: selectedPersona,
      });
      setPathEntries(result.entries);
      setStep(4);
      await refreshUser().catch(() => undefined);
      trackEvent('placement_completed', {
        assessment_id: assessmentId,
        attempt_id: attemptId,
        mastery_pct: result.masteryPct,
      });
      onComplete?.({ pathEntries: result.entries });
    } catch (submitError) {
      console.error('[Onboarding] placement submit failed', submitError);
      setError('We could not finish your placement. Please try again.');
    } finally {
      setLoading(false);
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
            className={`h-2 w-16 rounded-full ${
              step >= value ? 'bg-gradient-to-r from-sky-500 to-emerald-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );

  const renderProfileStep = () => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100">
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
            <span>Grade band</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {gradeBands.map((band) => (
              <button
                key={band}
                onClick={() => setGradeBand(band)}
                className={`rounded-xl px-3 py-2 border ${
                  gradeBand === band
                    ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {band}
              </button>
            ))}
          </div>
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
          className={`w-14 h-8 rounded-full p-1 transition ${
            optInAi ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <div
            className={`h-6 w-6 bg-white rounded-full shadow-sm transform transition ${optInAi ? 'translate-x-6' : ''}`}
          />
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100">
      {renderStepHeader()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Choose an avatar</p>
          <div className="grid grid-cols-2 gap-2">
            {avatars.map((avatar) => {
              const accent = ((avatar.metadata ?? {}) as Record<string, unknown>).palette as
                | { background?: string; accent?: string }
                | undefined;
              return (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={`rounded-xl border px-3 py-3 text-left ${
                    selectedAvatar === avatar.id
                      ? 'border-sky-500 bg-sky-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{avatar.name}</p>
                  {accent?.accent && <p className="text-xs text-slate-500">Accent {accent.accent}</p>}
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
              Continue to placement
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderPlacementStep = () => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100">
      {renderStepHeader()}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-600">Placement assessment</p>
          <p className="text-xs text-slate-500">You can pause anytime — we save your progress.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-700">
          <Brain className="h-4 w-4 text-sky-600" />
          <span>{placementProgressPct}%</span>
        </div>
      </div>
      {!placementItems.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700 font-semibold mb-2">Ready to launch your placement?</p>
          <p className="text-sm text-slate-500 mb-4">We&apos;ll tailor questions to {gradeBand} and build your path.</p>
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
                Start assessment
                <Play className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Question {currentIndex + 1}</p>
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
          <div className="mt-3 text-xs text-slate-500">
            Strand: {currentQuestion?.strand ?? 'General'} · Difficulty {currentQuestion?.difficulty ?? 3}/10
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

  const renderCompletion = () => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100">
      <div className="flex items-center space-x-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm text-emerald-700 font-semibold">Baseline ready</p>
          <h3 className="text-xl font-bold text-slate-900">Your learning plan is set</h3>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Great work! We saved your preferences and built a baseline plan tuned to your answers.
      </p>
      <UpNextList entries={summarizePath(pathEntries)} />
      <div className="mt-6">
        <div className="flex items-center space-x-2 mb-3">
          <Brain className="h-4 w-4 text-sky-500" />
          <p className="text-sm font-semibold text-slate-800">Tutor mini-guide</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <p className="text-sm font-semibold text-slate-900">Start with a hint</p>
            <p className="text-xs text-slate-600">
              Ask your tutor to “show a hint” or “break it down” before jumping to answers.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <p className="text-sm font-semibold text-slate-900">Explain another way</p>
            <p className="text-xs text-slate-600">
              If something feels confusing, try “explain another way” or “give a simpler example.”
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <p className="text-sm font-semibold text-slate-900">Stay honest</p>
            <p className="text-xs text-slate-600">
              Your tutor won’t help you cheat — it’s here to build understanding and confidence.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => onComplete?.({ pathEntries })}
          className="inline-flex items-center bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow hover:shadow-md transition"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </motion.div>
  );

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
          <span>Placement onboarding</span>
        </div>
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
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
