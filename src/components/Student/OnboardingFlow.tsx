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

type PlacementSessionState = {
  subject: SubjectPlacementKey;
  assessmentId: number;
  attemptId: number;
  items: PlacementItem[];
  responses: Map<number, PlacementResponseInput>;
  currentIndex: number;
  questionStartedAt: number | null;
  expectedLevel: number | null;
};

type MixedPlacementQuestion = {
  subject: SubjectPlacementKey;
  item: PlacementItem;
  itemIndex: number;
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
    return 'The check-in confirmed this subject is starting in a good place.';
  }
  if (result.workingLevel > result.expectedLevel) {
    return 'The check-in found room to move a little faster in this subject.';
  }
  return 'The check-in found this subject will feel better with more support at the start.';
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

  const [placementSessions, setPlacementSessions] = useState<Partial<Record<SubjectPlacementKey, PlacementSessionState>>>(
    {},
  );
  const [subjectResults, setSubjectResults] = useState<Partial<Record<SubjectPlacementKey, SubjectPlacementResult>>>({});
  const [subjectPaths, setSubjectPaths] = useState<StudentSubjectPath[]>([]);

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

  const mixedPlacementProgress = useMemo(() => {
    const sessions = SUBJECT_ORDER.map((subject) => placementSessions[subject]).filter(
      (value): value is PlacementSessionState => Boolean(value),
    );
    const totalItems = sessions.reduce((sum, session) => sum + session.items.length, 0);
    const answeredItems = sessions.reduce((sum, session) => sum + session.responses.size, 0);
    return {
      totalItems,
      answeredItems,
      progressPct: totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0,
    };
  }, [placementSessions]);

  const subjectCompletionPct = useMemo(() => {
    return Math.round((Object.keys(subjectResults).length / SUBJECT_ORDER.length) * 100);
  }, [subjectResults]);

  const pendingQuestions = useMemo(() => {
    const sessions = SUBJECT_ORDER.map((subject) => placementSessions[subject]).filter(
      (value): value is PlacementSessionState => Boolean(value),
    );
    if (!sessions.length) return [] as MixedPlacementQuestion[];
    const maxLength = sessions.reduce((max, session) => Math.max(max, session.items.length), 0);
    const mixed: MixedPlacementQuestion[] = [];
    for (let itemIndex = 0; itemIndex < maxLength; itemIndex += 1) {
      SUBJECT_ORDER.forEach((subject) => {
        const session = placementSessions[subject];
        if (!session) return;
        const item = session.items[itemIndex];
        if (!item || itemIndex < session.currentIndex) return;
        mixed.push({ subject, item, itemIndex });
      });
    }
    return mixed;
  }, [placementSessions]);

  const currentMixedQuestion = pendingQuestions[0] ?? null;
  const currentSubject = currentMixedQuestion?.subject ?? null;
  const currentSession = currentSubject ? placementSessions[currentSubject] ?? null : null;

  const goToStep = (next: Step) => {
    setStep(next);
    setError(null);
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
    return {
      responses: map,
      currentIndex: existing.length,
    };
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
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const placements = await Promise.all(
        SUBJECT_ORDER.map(async (subject) => {
          const placement = await startPlacement({
            subject,
            ageYears: parsedAgeYears,
            gradeLevel: parsedCurrentGrade,
            gradeBand,
            fullName,
            optInAi,
            avatarId: selectedAvatar,
            tutorPersonaId: selectedPersona,
          });
          const hydrated = hydrateExistingResponses(placement.existingResponses);
          trackEvent('placement_started', {
            assessment_id: placement.assessmentId,
            attempt_id: placement.attemptId,
            grade_band: placement.gradeBand,
            subject,
            expected_level: placement.expectedLevel,
            resume: placement.existingResponses.length > 0,
          });
          return [
            subject,
            {
              subject,
              assessmentId: placement.assessmentId,
              attemptId: placement.attemptId,
              items: placement.items,
              responses: hydrated.responses,
              currentIndex: hydrated.currentIndex,
              questionStartedAt: placement.items[hydrated.currentIndex] ? Date.now() : null,
              expectedLevel: placement.expectedLevel,
            } satisfies PlacementSessionState,
          ] as const;
        }),
      );
      setPlacementSessions(Object.fromEntries(placements));
      setStep(3);
    } catch (err) {
      console.error('[Onboarding] placement start failed', err);
      const message = err instanceof Error ? err.message : '';
      const normalized = message.toLowerCase();
      if (normalized.includes('missing sections') || normalized.includes('no questions')) {
        setError('We’re updating the placement assessment content right now. Please try again soon.');
      } else if (normalized.includes('content is incomplete') || normalized.includes('content is invalid')) {
        setError('We’re updating the placement assessment content right now. Please try again soon.');
      } else if (normalized.includes('no placement assessment')) {
        setError('We don’t have the mixed placement assessment content ready for this grade band yet. Please try again soon.');
      } else {
        setError('We could not start your placement assessment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const finalizePlacement = async (subject: SubjectPlacementKey, answerMap: Map<number, PlacementResponseInput>) => {
    const session = placementSessions[subject];
    if (!session) return false;
    const responseList = Array.from(answerMap.values());
    const result = await submitPlacement({
      assessmentId: session.assessmentId,
      attemptId: session.attemptId,
      responses: responseList,
      subject,
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
      [subject]: {
        subject,
        expectedLevel: result.expectedLevel,
        workingLevel: result.workingLevel,
        levelConfidence: result.levelConfidence,
        masteryPct: result.masteryPct,
        entries: result.entries,
      },
    }));

    trackEvent('placement_completed', {
      assessment_id: session.assessmentId,
      attempt_id: session.attemptId,
      subject,
      mastery_pct: result.masteryPct,
      expected_level: result.expectedLevel,
      working_level: result.workingLevel,
    });

    const completedSubjects = new Set([...Object.keys(subjectResults), subject]);
    if (completedSubjects.size >= SUBJECT_ORDER.length) {
      const refreshedPaths = await fetchStudentPaths().catch(() => []);
      const flattenedEntries = refreshedPaths.flatMap((entry) => entry.path?.entries ?? []);
      setSubjectPaths(refreshedPaths);
      setStep(4);
      await Promise.resolve(refreshUser()).catch(() => undefined);
      onComplete?.({
        pathEntries: flattenedEntries,
        subjectPaths: refreshedPaths,
      });
      return true;
    }

    return false;
  };

  const handleSaveResponse = async (optionId: number | null) => {
    if (!currentMixedQuestion || !currentSession) return;
    setSaving(true);
    setError(null);
    const elapsedSeconds = currentSession.questionStartedAt
      ? Math.max(1, Math.round((Date.now() - currentSession.questionStartedAt) / 1000))
      : 1;
    const item = currentMixedQuestion.item;
    try {
      const result = await savePlacementProgress({
        assessmentId: currentSession.assessmentId,
        attemptId: currentSession.attemptId,
        bankQuestionId: item.bankQuestionId,
        optionId,
        timeSpentSeconds: elapsedSeconds,
      });
      const nextMap = new Map(currentSession.responses);
      nextMap.set(item.bankQuestionId, {
        bankQuestionId: item.bankQuestionId,
        optionId,
        timeSpentSeconds: elapsedSeconds,
      });
      const nextIndex = currentMixedQuestion.itemIndex + 1;
      const nextItem = currentSession.items[nextIndex] ?? null;
      setPlacementSessions((prev) => ({
        ...prev,
        [currentMixedQuestion.subject]: {
          ...currentSession,
          responses: nextMap,
          currentIndex: nextIndex,
          questionStartedAt: nextItem ? Date.now() : null,
        },
      }));
      if (nextIndex >= currentSession.items.length) {
        setLoading(true);
        try {
          await finalizePlacement(currentMixedQuestion.subject, nextMap);
        } finally {
          setLoading(false);
        }
      }
      trackEvent('placement_response_saved', {
        question_id: item.bankQuestionId,
        is_correct: result.isCorrect,
        subject: currentMixedQuestion.subject,
      });
    } catch (respError) {
      console.error('[Onboarding] save response failed', respError);
      setError("We couldn't save that one. Let's try again!");
    } finally {
      setSaving(false);
    }
  };

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
          <p className="text-sm font-semibold text-slate-800">Personalized starting point</p>
          <p className="mt-2 text-lg font-bold text-slate-900">We&apos;ll tune this after the check-in</p>
          <p className="mt-1 text-xs text-slate-500">Math and ELA will each start at a level that feels appropriately challenging.</p>
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
            One short mixed check-in, with Math and ELA scored separately underneath.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{subjectCompletionPct}% complete</p>
          <p className="text-xs text-slate-500">{Object.keys(subjectResults).length} of {SUBJECT_ORDER.length} subjects finished</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {SUBJECT_ORDER.map((subjectKey) => {
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
                ) : isCurrent || placementSessions[subjectKey] ? (
                  <span className="text-xs font-semibold text-sky-700">In progress</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">Ready</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {result
                  ? 'Starting path ready'
                  : placementSessions[subjectKey]
                    ? `${placementSessions[subjectKey]?.responses.size ?? 0} of ${placementSessions[subjectKey]?.items.length ?? 0} answered`
                    : 'Not started yet'}
              </p>
            </div>
          );
        })}
      </div>

      {!Object.keys(placementSessions).length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700 font-semibold mb-2">
            Ready for one adaptive check-in?
          </p>
          <p className="text-sm text-slate-500 mb-4">
            This interleaves Math and ELA so the experience feels like one flow, while we still calibrate each subject separately.
          </p>
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
                Start mixed assessment
                <Play className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {SUBJECT_LABELS[currentSubject ?? 'math']} question {currentMixedQuestion ? currentMixedQuestion.itemIndex + 1 : 0} of {currentSession?.items.length ?? 0}
              </p>
              <h3 className="text-lg font-semibold text-slate-900 mt-1">{currentMixedQuestion?.item.prompt}</h3>
            </div>
            <div className="text-xs text-slate-500">{mixedPlacementProgress.progressPct}% complete</div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            We alternate subjects to keep the flow natural, but Math and ELA still get separate working levels.
          </p>
          <div className="mt-4 space-y-2">
            {currentMixedQuestion?.item.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSaveResponse(option.id)}
                disabled={saving || loading}
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
          Nice work, {fullName || 'learner'}! That mixed check-in set separate starting points for Math and ELA so your first paths feel just right without turning learning into a grade-level label.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedResults.map((result) => (
            <div key={result.subject} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{SUBJECT_LABELS[result.subject]}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">Personalized starting path</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                  {confidenceLabel(result.levelConfidence)}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{subjectExplanation(result)}</p>
              <p className="mt-2 text-xs text-slate-500">First lessons are ready in this subject.</p>
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
              <p className="text-xs text-slate-600">Math and ELA can move at different paces, even though the check-in felt like one flow.</p>
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
