import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, Lightbulb, Target, BookOpen, Info, MessageSquare, Sparkles, ShieldCheck, Flag, Wand2, Layers, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage, Student, Subject } from '../../types';
import getTutorResponse from '../../services/getTutorResponse';
import trackEvent from '../../lib/analytics';
import { TUTOR_AVATARS } from '../../../shared/avatarManifests';
import { updateLearningPreferences } from '../../services/profileService';
import { tutorControlsCopy } from '../../lib/tutorControlsCopy';
import { fetchReflections } from '../../services/reflectionService';
import { submitTutorAnswerReport, type TutorReportReason } from '../../services/tutorReportService';
import { useStudentPath, useTutorPersona } from '../../hooks/useStudentData';
import { findCuratedAlternate } from '../../data/curatedAlternates';
import { TUTOR_GUARDRAILS } from '../../lib/tutorTones';

const defaultPalette = { background: '#EEF2FF', accent: '#6366F1', text: '#1F2937' };

const resolvePalette = (metadata?: Record<string, unknown> | null) => {
  const palette = (metadata?.palette as { background?: string; accent?: string; text?: string } | undefined) ?? undefined;
  return {
    background: palette?.background ?? defaultPalette.background,
    accent: palette?.accent ?? defaultPalette.accent,
    text: palette?.text ?? defaultPalette.text,
  };
};

const humanizeStandard = (code?: string | null): string | null => {
  if (!code) return null;
  const trimmed = code.toString().trim();
  if (!trimmed.length) return null;
  const withoutFramework = trimmed.includes(':') ? trimmed.split(':').pop() ?? trimmed : trimmed;
  const cleaned = withoutFramework.replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned.length) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const alternateExplanationTemplate = (subject?: Subject | string | null, focus?: string | null) => {
  const focusLabel = focus ?? 'this concept';
  const normalized = subject ? subject.toString().toLowerCase() : '';
  if (normalized.includes('math')) {
    return `Offer an alternate explanation for ${focusLabel} using a concrete math example (e.g., a number line or simple fraction like 1/4 vs 1/2). Keep it under 4 sentences, include one quick self-check the learner can try, and avoid giving a full solution.`;
  }
  if (normalized.includes('english') || normalized.includes('ela') || normalized.includes('reading')) {
    return `Explain ${focusLabel} another way using a short text or sentence frame. Show one model sentence, underline the key move (like citing evidence), and invite the learner to try their own in one sentence. Keep it concise.`;
  }
  return `Explain ${focusLabel} with a different angle or analogy in under 4 sentences. Include one quick check so the learner can test their understanding.`;
};

type HintLevel = 'hint' | 'break_down' | 'another_way';
type MessageMetadata = { source?: 'card' | 'free' | 'scaffold'; cardId?: string; hintLevel?: HintLevel };

const LearningAssistant: React.FC = () => {
  const { user } = useAuth();
  const student = user as Student;
  const { persona: tutorPersona } = useTutorPersona(student?.id);
  const pathQuery = useStudentPath(student?.id);
  const tutorAvatar = useMemo(
    () => TUTOR_AVATARS.find((avatar) => avatar.id === student.tutorAvatarId) ?? TUTOR_AVATARS[0],
    [student.tutorAvatarId],
  );
  const personaPalette = useMemo(
    () => (tutorPersona ? resolvePalette((tutorPersona.metadata ?? {}) as Record<string, unknown>) : null),
    [tutorPersona],
  );
  const tutorPalette = personaPalette ?? tutorAvatar?.palette ?? defaultPalette;
  const pathMetadata = useMemo(
    () => ((pathQuery.path?.metadata ?? {}) as Record<string, unknown> | null | undefined),
    [pathQuery.path?.metadata],
  );
  const defaultLessonContext = useMemo(() => {
    const targetEntry = pathQuery.next ?? pathQuery.entries?.[0] ?? null;
    if (!targetEntry) return null;
    const meta = (targetEntry.metadata ?? {}) as Record<string, unknown>;
    const lessonTitle =
      typeof meta.lesson_title === 'string'
        ? meta.lesson_title
        : typeof meta.module_title === 'string'
          ? meta.module_title
          : null;
    const subject = typeof meta.subject === 'string' ? meta.subject : null;
    return {
      lessonId: targetEntry.lesson_id ?? targetEntry.id ?? null,
      lessonTitle,
      moduleTitle: typeof meta.module_title === 'string' ? meta.module_title : null,
      subject,
    };
  }, [pathQuery.entries, pathQuery.next]);
  const adaptiveMisconceptions = useMemo(() => {
    const adaptive =
      (pathMetadata?.adaptive_state as Record<string, unknown> | null | undefined) ??
      ((pathMetadata?.adaptive as Record<string, unknown> | null | undefined) ?? {});
    const list = Array.isArray(adaptive.misconceptions)
      ? adaptive.misconceptions.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return list;
  }, [pathMetadata]);
  const strongestSubject = useMemo(() => humanizeStandard(student.strengths[0] ?? null), [student.strengths]);
  const adaptivePromptHint = useMemo(() => {
    const pieces: string[] = [];
    if (adaptiveMisconceptions.length) {
      const label = humanizeStandard(adaptiveMisconceptions[0]) ?? 'your recent focus';
      pieces.push(
        `Roughly one in three replies, start with a quick nod like "You've been working on ${label}; let's tackle it in small steps." Keep it one short sentence.`,
      );
    }
    if (strongestSubject) {
      pieces.push(
        `When it helps, use ${strongestSubject} as an analogy for tougher ideas, but keep it brief so it doesn't distract.`,
      );
    }
    return pieces.join(' ');
  }, [adaptiveMisconceptions, strongestSubject]);

  const tutorDisplayName = student.tutorName?.trim() || 'Learning Assistant';
  const personaTone = tutorPersona?.tone ?? tutorAvatar?.tone;
  const personaIdForEvents = tutorPersona?.id ?? tutorAvatar?.id ?? null;
  const tutorIcon =
    typeof ((tutorPersona?.metadata ?? {}) as Record<string, unknown>).icon === 'string'
      ? (((tutorPersona?.metadata ?? {}) as Record<string, unknown>).icon as string)
      : tutorAvatar.icon;
  const tutorLabel = tutorPersona?.name ?? tutorAvatar.label;
  const autoChatMode: 'guided_only' | 'guided_preferred' | 'free' =
    student.grade <= 3 ? 'guided_only' : student.grade <= 5 ? 'guided_preferred' : 'free';
  const tutorDisabled = student.learningPreferences.allowTutor === false;
  const lessonOnlyMode =
    student.learningPreferences.tutorLessonOnly ??
    (student.grade > 0 && student.grade < 13 ? true : false);
  const [chatMode, setChatMode] = useState<'guided_only' | 'guided_preferred' | 'free'>(
    student.learningPreferences.chatMode ?? autoChatMode,
  );
  const chatModeLocked = student.learningPreferences.chatModeLocked ?? false;
  const [guidedCardUsed, setGuidedCardUsed] = useState(false);
  const tutorToneDescriptor = useMemo(() => {
    switch (personaTone) {
      case 'calm':
        return 'I keep answers calm and patient.';
      case 'bold':
        return 'Expect upbeat energy and quick encouragement.';
      case 'structured':
        return 'I guide you step by step with clear checkpoints.';
      case 'concise':
        return 'I stay crisp and to the point with minimal fluff.';
      default:
        return 'I’ll cheer you on with short encouragement.';
    }
  }, [personaTone]);
  const buildIntroMessage = useCallback(() => {
    const preferredName = student.tutorName?.trim();
    const introName =
      preferredName && preferredName.length ? `${preferredName}, your personal learning guide` : 'your personal learning assistant';
    const strengths = student.strengths[0] || 'your current subjects';
    const safetyLine = 'I stay school-safe, will not help with cheating, and I do not replace your teacher';
    const personaStyleHint = tutorPersona?.prompt_snippet ?? tutorToneDescriptor;
    return `Hi there! I'm ${introName}. I can help with ${strengths}, study tips, or motivation. ${personaStyleHint} ${safetyLine}. What would you like to work on today?`;
  }, [student.strengths, student.tutorName, tutorPersona?.prompt_snippet, tutorToneDescriptor]);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: '1',
      content: buildIntroMessage(),
      isUser: false,
      timestamp: new Date(),
      role: 'assistant',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<'hint' | 'solution'>('hint');
  const [planUsage, setPlanUsage] = useState<{ limit: number | 'unlimited' | null; remaining: number | null; plan: string | null }>({
    limit: null,
    remaining: null,
    plan: null,
  });
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [lessonContext, setLessonContext] = useState<{
    lessonId?: number | string | null;
    lessonTitle?: string | null;
    moduleTitle?: string | null;
    subject?: Subject | string | null;
  } | null>(null);
  const [homeLessonContext, setHomeLessonContext] = useState<{
    lessonId?: number | string | null;
    lessonTitle?: string | null;
    moduleTitle?: string | null;
    subject?: Subject | string | null;
  } | null>(null);
  const conversationId = useRef<string>(`conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const assistantWindowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chatModeSaving, setChatModeSaving] = useState(false);
  const [explainerSource, setExplainerSource] = useState<'first_run' | 'header' | 'guardrail' | null>(null);
  const [quizChoice, setQuizChoice] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [recentReflections, setRecentReflections] = useState<
    Array<{ id: string; responseText: string; createdAt: Date }>
  >([]);
  const [hintMessages, setHintMessages] = useState(0);
  const [confusionCount, setConfusionCount] = useState(0);
  const [reflectionPrompted, setReflectionPrompted] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ messageId?: string; answer: string } | null>(null);
  const [reportReason, setReportReason] = useState<TutorReportReason>('incorrect');
  const [reportNotes, setReportNotes] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const clarifierChips = useMemo(() => {
    const base = ['Which step is tricky?', 'Do you want a hint or full answer?', 'Any words or vocab that confuse you?'];
    const subject = lessonContext?.subject?.toString().toLowerCase() ?? '';
    const lessonTitle = lessonContext?.lessonTitle;
    const contextual: string[] = [];
    if (lessonTitle) {
      contextual.push(`I’m stuck on "${lessonTitle}"`);
    }
    if (contextHint) {
      contextual.push(`Can you check this part: "${contextHint}"?`);
    }
    if (subject.includes('math')) {
      contextual.push('Show me a similar example', 'Where should I start with this problem?');
    }
    if (subject.includes('english')) {
      contextual.push('What kind of writing is it?', 'Can you suggest a sentence starter?');
    }
    if (subject.includes('science')) {
      contextual.push('Which concept is unclear?', 'Can you link it to a real-world example?');
    }
    return [...base, ...contextual].slice(0, 6);
  }, [contextHint, lessonContext]);

  const scaffoldTopic = useMemo(
    () =>
      lessonContext?.lessonTitle ??
      contextHint ??
      (adaptiveMisconceptions.length ? humanizeStandard(adaptiveMisconceptions[0]) : null) ??
      'this problem',
    [adaptiveMisconceptions, contextHint, lessonContext?.lessonTitle],
  );
  const subjectTagLabel = lessonContext?.subject ?? 'General';
  const conceptTagLabel = useMemo(() => {
    const focusLabel =
      lessonContext?.lessonTitle ??
      contextHint ??
      (lessonContext?.subject ? humanizeStandard(lessonContext.subject.toString()) : null) ??
      (adaptiveMisconceptions.length ? humanizeStandard(adaptiveMisconceptions[0]) : null);
    return focusLabel ?? 'concept';
  }, [adaptiveMisconceptions, contextHint, lessonContext]);

  const scaffoldActions: Array<{
    id: HintLevel;
    label: string;
    helper: string;
    prompt: string;
    icon: React.ComponentType<{ className?: string }>;
  }> =
    useMemo(
      () => [
        {
          id: 'hint',
          label: 'Show hint',
          helper: '1-2 sentence nudge',
          prompt: `Give me one short hint for ${scaffoldTopic}.`,
          icon: Wand2,
        },
        {
          id: 'break_down',
          label: 'Break it down',
          helper: 'Step-by-step',
          prompt: `Break ${scaffoldTopic} into 3-4 clear steps.`,
          icon: Layers,
        },
        {
          id: 'another_way',
          label: 'Explain another way',
          helper: 'New angle',
          prompt: `Explain ${scaffoldTopic} another way with a quick example.`,
          icon: Repeat,
        },
      ],
      [scaffoldTopic],
    );

  const guardrailContextLabel = lessonContext?.lessonTitle ?? lessonContext?.moduleTitle ?? contextHint ?? 'On-task';
  const guardrailPillText = useMemo(
    () => `School-safe${guardrailContextLabel ? ` · Lesson: ${guardrailContextLabel}` : ''}`,
    [guardrailContextLabel],
  );
  const canReturnToLesson = Boolean(homeLessonContext ?? defaultLessonContext);

  const quickActions = [
    { icon: Lightbulb, text: 'Get a study tip', action: 'study-tip' },
    { icon: Target, text: 'Review weak areas', action: 'review-weak' },
    { icon: BookOpen, text: 'Explain a concept', action: 'explain-concept' }
  ];

  useEffect(() => {
    if (tutorDisabled) {
      setAssistantError(tutorControlsCopy.studentDisabledMessage);
    } else {
      setAssistantError(null);
    }
  }, [tutorDisabled]);

  const guidedCards = useMemo(
    () => {
      const base = [
        { id: 'explain-problem', label: 'Explain this problem', prompt: 'Explain this problem in simple steps.' },
        { id: 'practice-weak', label: 'Practice my weak area', prompt: 'Help me practice my weak areas.' },
        { id: 'study-tip', label: 'Give me a study tip', prompt: 'Give me a study tip for my class.' },
        { id: 'check-steps', label: 'Check my steps', prompt: 'Check my steps and point out mistakes.' },
        { id: 'quiz-me', label: 'Ask me a quiz', prompt: 'Quiz me on what I just learned.' },
        { id: 'safety', label: 'Something feels off', prompt: 'Something feels off. What should I do?' },
      ];
      const contextual: { id: string; label: string; prompt: string }[] = [];
      if (lessonContext?.lessonTitle) {
        contextual.push({
          id: 'lesson-help',
          label: `Help with ${lessonContext.lessonTitle}`,
          prompt: `Help me with ${lessonContext.lessonTitle}.`,
        });
      }
      if (lessonContext?.subject) {
        contextual.push({
          id: 'subject-basics',
          label: `Review ${lessonContext.subject} basics`,
          prompt: `Review ${lessonContext.subject} basics with me.`,
        });
      }
      return [...contextual, ...base];
    },
    [lessonContext],
  );


  const detectGuardrail = (message: string): string | null => {
    const lower = message.toLowerCase();
    const piiPattern = /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b|@\w+/;
    if (piiPattern.test(lower)) return 'pii';
    if (lower.includes('cheat') || lower.includes('test answer') || lower.includes('answer key')) return 'cheating';
    if (lower.includes('address') || lower.includes('phone number') || lower.includes('email')) return 'pii';
    return null;
  };

  const maybePromptReflection = (reason: 'confusion' | 'hint_count' | 'end_of_lesson' | 'long_session') => {
    if (reflectionPrompted) return;
    setReflectionPrompted(true);
    window.dispatchEvent(new CustomEvent('reflection:prompt', { detail: { reason, questionId: 'what_learned' } }));
  };


  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      if (first.isUser) return prev;
      const intro = buildIntroMessage();
      if (first.content === intro) return prev;
      return [{ ...first, content: intro }, ...rest];
    });
  }, [buildIntroMessage]);

  useEffect(() => {
    if (!defaultLessonContext) return;
    setHomeLessonContext(defaultLessonContext);
    if (!lessonContext) {
      setLessonContext(defaultLessonContext);
    }
  }, [defaultLessonContext, lessonContext]);

  const explainerDismissKey = useMemo(() => `tutor-explainer-dismissed-${student.id}`, [student.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(explainerDismissKey);
    if (!dismissed) {
      setShowExplainModal(true);
      setExplainerSource('first_run');
      trackEvent('tutor_explainer_viewed', { source: 'first_run', grade_band: student.grade });
    }
  }, [explainerDismissKey, isOpen, student.grade]);

  useEffect(() => {
    fetchReflections(3)
      .then((rows) => {
        setRecentReflections(
          rows.map((row) => ({
            id: row.id,
            responseText: row.responseText,
            createdAt: row.createdAt,
          })),
        );
      })
      .catch((err) => console.warn('[LearningAssistant] Unable to load reflections', err));
  }, []);

  const getContextualResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();

    if (message.includes('help') || message.includes('stuck')) {
      return `I can see you're working on ${student.strengths[0] || 'several topics'}. When you're stuck, try breaking the problem into smaller steps. What specific part is challenging you? I can walk you through it step by step! 🤔`;
    }

    if (message.includes('motivation') || message.includes('tired') || message.includes('give up')) {
      return `You're doing amazing! You've already earned ${student.xp} XP and you're on a ${student.streakDays}-day streak! 🔥 Remember, every expert was once a beginner. What you're learning today is building your future success. Take a short break if you need one, then come back strong! 💪`;
    }

    if (message.includes('math') || message.includes('algebra') || message.includes('equation')) {
      return `Great choice focusing on math! I can see algebra is one of your strengths. For equations, remember the golden rule: whatever you do to one side, do to the other. Would you like me to walk through a specific type of problem with you? 📊`;
    }

    if (message.includes('english') || message.includes('writing') || message.includes('grammar')) {
      return `English skills are so important! For writing, I always recommend the 3-step approach: Plan (outline your ideas), Draft (write without worrying about perfection), and Revise (polish your work). What type of writing are you working on? 📝`;
    }

    if (message.includes('science') || message.includes('experiment') || message.includes('biology')) {
      return `Science is all about curiosity and discovery! The key is to understand the 'why' behind concepts, not just memorize facts. Try connecting what you learn to real-world examples. What science topic are you exploring? 🔬`;
    }

    if (message.includes('study tip') || message.includes('how to study')) {
      return `Here's a personalized study tip for you: Since ${student.weaknesses[0] || 'some areas'} need more practice, try the Feynman Technique - explain the concept in simple terms as if teaching a friend. This reveals gaps in understanding! Also, take breaks every 25 minutes (Pomodoro technique). 🧠`;
    }

    if (message.includes('weak') || message.includes('difficult') || message.includes('struggle')) {
      return `I notice you're working on improving in ${student.weaknesses[0] || 'certain areas'}. That's totally normal! Everyone has topics that challenge them more. The key is consistent practice and not being afraid to ask questions. Would you like some specific strategies for this topic? 🎯`;
    }

    return `That's a great question! Based on your learning profile (Level ${student.level}, strong in ${student.strengths[0] || 'multiple areas'}), I can help you tackle this. Can you tell me more about what you're working on so I can give you the most helpful guidance? 🤝`;
  };

  const handleReportSubmit = async () => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    setReportError(null);
    setReportSuccess(false);
    try {
      await submitTutorAnswerReport({
        answer: reportTarget.answer,
        reason: reportReason,
        notes: reportNotes,
        messageId: reportTarget.messageId,
        conversationId: conversationId.current,
        lessonId: lessonContext?.lessonId ?? null,
        subject: lessonContext?.subject ?? null,
      });
      trackEvent('learning_assistant_report_submitted', {
        message_id: reportTarget.messageId,
        conversation_id: conversationId.current,
        reason: reportReason,
        has_notes: Boolean(reportNotes.trim()),
        lesson_id: lessonContext?.lessonId ?? null,
        subject: lessonContext?.subject ?? null,
      });
      setReportSuccess(true);
      setReportNotes('');
    } catch (error) {
      console.error('[LearningAssistant] Failed to submit tutor report', error);
      setReportError(error instanceof Error ? error.message : 'Unable to send report right now.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const openExplainer = (source: 'header' | 'guardrail' | 'first_run') => {
    setShowExplainModal(true);
    setExplainerSource(source);
    trackEvent('tutor_explainer_viewed', { source, grade_band: student.grade });
  };

  const closeExplainer = (reason: 'got_it' | 'x' | 'backdrop') => {
    setShowExplainModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(explainerDismissKey, 'true');
    }
    trackEvent('tutor_explainer_closed', { source: explainerSource ?? 'header', reason });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{
        prompt?: string;
        source?: string;
        lesson?: {
          lessonId?: number | string | null;
          lessonTitle?: string | null;
          moduleTitle?: string | null;
          subject?: Subject | string | null;
        };
      }>).detail ?? {};
      setIsOpen(true);
      if (detail.prompt) {
        setInputMessage(detail.prompt);
        setContextHint(detail.lesson?.lessonTitle ?? detail.source ?? 'Lesson context');
      } else {
        setContextHint(detail.lesson?.lessonTitle ?? detail.source ?? null);
      }
      setLessonContext(detail.lesson ?? null);
      trackEvent('learning_assistant_context_open', {
        studentId: student.id,
        source: detail.source ?? 'unknown',
        hasPrompt: Boolean(detail.prompt),
        lessonId: detail.lesson?.lessonId,
        lessonSubject: detail.lesson?.subject,
      });
    };

    window.addEventListener('learning-assistant:open', handleOpen as EventListener);
    return () => {
      window.removeEventListener('learning-assistant:open', handleOpen as EventListener);
    };
  }, [student.id]);

  const handleReturnToLesson = () => {
    const targetContext = homeLessonContext ?? defaultLessonContext ?? lessonContext;
    if (!targetContext) {
      return;
    }
    setLessonContext(targetContext);
    setContextHint(targetContext.lessonTitle ?? targetContext.moduleTitle ?? 'Current lesson');
    setSelectedCardId(null);
    setGuidedCardUsed(false);
    trackEvent('learning_assistant_return_to_lesson', {
      lesson_id: targetContext.lessonId ?? null,
      subject: targetContext.subject ?? null,
    });
  };

  const handleChatModeChange = async (mode: 'guided_only' | 'guided_preferred' | 'free') => {
    if (chatMode === mode) return;
    if (chatModeLocked && mode !== 'guided_only') {
      return;
    }
    setChatMode(mode);
    setChatModeSaving(true);
    trackEvent('chat_mode_set', {
      mode,
      source: 'student',
      grade_band: student.grade <= 5 ? 'g3-5' : student.grade <= 8 ? 'g6-8' : 'g9-plus',
    });
    try {
      await updateLearningPreferences(student.id, {
        ...student.learningPreferences,
        chatMode: mode,
      });
    } catch (error) {
      console.warn('[LearningAssistant] Failed to persist chat mode', error);
    } finally {
      setChatModeSaving(false);
    }
  };

  const handleQuickAction = (action: string) => {
    let message = '';
    switch (action) {
      case 'study-tip':
        message = 'Can you give me a study tip?';
        break;
      case 'review-weak':
        message = 'Help me review my weak areas';
        break;
      case 'explain-concept':
        message = 'Can you explain a concept to me?';
        break;
    }
    if (message) {
      trackEvent('tutor_onboarding_step_completed', {
        step: 'prompts',
        persona_id: personaIdForEvents,
        avatar_id: personaIdForEvents,
        provided_name: Boolean(student.tutorName?.trim()),
      });
      trackEvent('tutor_onboarding_question_used', {
        question_id: action,
        persona_id: personaIdForEvents,
      });
      void handleSendMessage(message, { source: 'card', cardId: action });
    }
  };

  const handleSendMessage = async (customMessage?: string, metadata?: MessageMetadata) => {
    const messageToSend = (customMessage ?? inputMessage).trim();
    if (!messageToSend.trim()) return;

    if (tutorDisabled) {
      setAssistantError(tutorControlsCopy.studentDisabledMessage);
      return;
    }

    if (lessonOnlyMode && !lessonContext && !contextHint) {
      setAssistantError(tutorControlsCopy.studentLessonOnlyMessage);
      return;
    }

    const lower = messageToSend.toLowerCase();
    if (lower.includes('confused') || lower.includes('stuck') || lower.includes('don’t get') || lower.includes("don't get")) {
      setConfusionCount((prev) => prev + 1);
    }
    if (lessonContext?.lessonId && /done|finished|complete/.test(lower)) {
      maybePromptReflection('end_of_lesson');
    }
    if (metadata?.hintLevel && responseMode !== 'hint') {
      setResponseMode('hint');
    }

    const guardrailReason = detectGuardrail(messageToSend);
    const now = Date.now();
    const guardrailCooldownKey = `tutor-guardrail-last-${student.id}`;
    if (guardrailReason) {
      const last = typeof window !== 'undefined' ? Number(localStorage.getItem(guardrailCooldownKey) ?? 0) : 0;
      const withinCooldown = now - last < 10 * 60 * 1000;
      const reminder =
        'Reminder: I stay school-safe and cannot help with that. Try a guided prompt or ask a trusted adult.';
      setAssistantError(reminder);
      trackEvent('chat_guided_guardrail_triggered', { reason: guardrailReason });
      if (!withinCooldown) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(guardrailCooldownKey, `${now}`);
        }
        setShowExplainModal(true);
        setExplainerSource('guardrail');
        trackEvent('tutor_explainer_viewed', { source: 'guardrail', grade_band: student.grade });
      } else {
        trackEvent('tutor_explainer_closed', { source: 'guardrail', reason: 'guardrail_auto_close' });
      }
      return;
    }

    const modeInstruction =
      responseMode === 'hint'
        ? 'Provide a scaffolded hint without giving away the full answer unless I ask for it.'
        : 'Share the full worked solution with reasoning after a short hint reminder.';
    const hintLevelInstruction =
      metadata?.hintLevel === 'break_down'
        ? 'Break the solution into 3-4 clear, numbered steps with a short encouragement to try after each step.'
        : metadata?.hintLevel === 'another_way'
          ? alternateExplanationTemplate(lessonContext?.subject ?? lessonContext?.moduleTitle ?? null, conceptTagLabel)
          : metadata?.hintLevel === 'hint'
            ? 'Give one brief hint (1-2 sentences) without revealing the full answer.'
            : '';
    const curatedAlternate =
      metadata?.hintLevel === 'another_way'
        ? findCuratedAlternate(subjectTagLabel, conceptTagLabel)
        : null;
    const decoratedMessage = `${messageToSend}\n\n${modeInstruction}${hintLevelInstruction ? ` ${hintLevelInstruction}` : ''}`;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: messageToSend,
      isUser: true,
      timestamp: new Date(),
      role: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    setAssistantError(null);
    if (metadata?.source === 'card') {
      setGuidedCardUsed(true);
    }
    if (metadata?.hintLevel) {
      trackEvent('learning_assistant_scaffold_used', {
        studentId: student.id,
        hint_level: metadata.hintLevel,
        subject: lessonContext?.subject ?? null,
        concept: conceptTagLabel ?? lessonContext?.lessonTitle ?? null,
        curated_alternate: Boolean(curatedAlternate),
      });
    }
    trackEvent(metadata?.source === 'card' ? 'chat_prompt_card_sent' : 'learning_assistant_message_sent', {
      studentId: student.id,
      length: messageToSend.length,
      responseMode,
      contextSource: contextHint ?? lessonContext?.lessonTitle ?? 'direct',
      card_id: metadata?.cardId,
      mode: chatMode,
      subject: lessonContext?.subject ?? null,
      lesson_id: lessonContext?.lessonId ?? null,
      hint_level: metadata?.hintLevel ?? null,
    });
    if (metadata?.source !== 'card') {
      trackEvent('chat_free_text_used', {
        mode: chatMode,
        length: messageToSend.length,
        after_card: guidedCardUsed,
      });
    }

    try {
      const promptEntries = [...messages, { ...userMessage, content: decoratedMessage }];
      const contextWindow = promptEntries
        .slice(-6)
        .map((entry) => `${entry.isUser ? 'Student' : 'Assistant'}: ${entry.content}`)
        .join('\n');

      const promptForModel = `${contextWindow}\nAssistant:`.slice(-1100);
      const personaName = student.tutorName?.trim();
      const personaStyle =
        tutorPersona?.prompt_snippet ??
        (personaTone === 'calm'
          ? 'calm, patient tone'
          : personaTone === 'structured'
            ? 'structured, step-by-step coaching tone'
            : personaTone === 'bold'
              ? 'upbeat, high-energy tone'
              : personaTone === 'concise'
                ? 'concise, to-the-point tone'
                : 'encouraging, warm tone');
      const planIntensity = student.learningPreferences?.weeklyPlanIntensity ?? 'normal';
      const planIntent = student.learningPreferences?.weeklyIntent ?? 'balanced';
      const planTone =
        planIntensity === 'light'
          ? 'Keep encouragement gentle and celebrate small wins.'
          : planIntensity === 'challenge'
            ? 'Use a bit more upbeat motivation and suggest one extra stretch step.'
            : 'Use a balanced encouragement tone.';
      const intentCoaching =
        planIntent === 'precision'
          ? 'Prioritize accuracy and careful checks; slow the pace slightly and praise correct steps.'
          : planIntent === 'speed'
            ? 'Keep answers brisk and confidence-building; avoid over-long hints.'
            : planIntent === 'stretch'
              ? 'Offer a small extension or challenge when the learner seems ready.'
              : 'Balance accuracy and pace.';
      const focusLabel = adaptiveMisconceptions.length
        ? humanizeStandard(adaptiveMisconceptions[0]) ?? adaptiveMisconceptions[0]
        : null;
      const chatModePrompt =
        chatMode === 'guided_only'
          ? 'You are in guided-only mode. Ask 1-2 clarifying questions before longer answers. Keep responses short (2-3 steps). Decline off-topic or personal requests and suggest picking another prompt.'
          : chatMode === 'guided_preferred'
            ? 'You are in guided-preferred mode. Start with a short answer and one clarifying question. Keep answers concise and redirect if off-topic.'
            : 'Standard chat mode. Keep answers school-safe and concise.';
      const conceptTag = conceptTagLabel ?? 'concept';
      const subjectTag = subjectTagLabel ?? 'General';
      const tagInstruction = `Start each answer with a short tag like "[${subjectTag} • ${conceptTag}]" to remind the learner of the subject and focus, then give the help. Keep tags short.`;
      const baseGuardrails = lessonContext
        ? `You are an in-lesson tutor. Stay focused on "${lessonContext.lessonTitle ?? 'this lesson'}" in ${lessonContext.subject ?? 'this subject'
        }. Keep answers concise (2-3 steps), avoid unrelated tangents, and remind the learner to try before giving full solutions. You are a helper, not a teacher, so keep it light and encouraging.`
        : 'You are ElevatED tutor. Stay concise, age-appropriate, and prioritize small next steps over long answers. You are a helper, not a teacher, and you never assist with cheating or collecting personal info.';
      // Phase 5.2: Add standardized guardrails from tutorTones.ts
      const coreGuardrails = TUTOR_GUARDRAILS.systemPromptAdditions.slice(0, 4).join(' ');
      const personaGuardrails = `${personaName ? `The student calls you "${personaName}".` : 'You have a chosen tutor persona.'} Keep a ${personaStyle} and use that name when referring to yourself. ${tutorPersona?.constraints ?? ''
        } ${planTone} ${chatModePrompt} Never assist with cheating, personal data, or off-topic requests; politely decline and redirect to a trusted adult if needed.`;
      const lessonOnlyGuardrail = lessonOnlyMode
        ? 'The learner is restricted to lesson-only tutoring. If a request feels unrelated to the active lesson, decline and remind them to return to their current module.'
        : '';
      const guardrails = `${baseGuardrails} ${coreGuardrails} ${personaGuardrails} ${lessonOnlyGuardrail} ${intentCoaching} ${adaptivePromptHint} ${tagInstruction}`.trim();
      const knowledgeContext = [
        lessonContext?.moduleTitle ? `Module: ${lessonContext.moduleTitle}` : null,
        lessonContext?.lessonTitle ? `Lesson: ${lessonContext.lessonTitle}` : null,
        lessonContext?.subject ? `Subject: ${lessonContext.subject}` : null,
        contextHint ? `Context: ${contextHint}` : null,
        focusLabel ? `Current focus: ${focusLabel}` : null,
        conceptTag ? `Focus concept: ${conceptTag}` : null,
        metadata?.hintLevel ? `Hint level: ${metadata.hintLevel}` : null,
        planIntent !== 'balanced' ? `Weekly intent: ${planIntent}` : null,
        curatedAlternate ? `Curated alternate: ${curatedAlternate}` : null,
        recentReflections.length
          ? `Recent reflections: ${recentReflections
            .map((entry) => entry.responseText.trim())
            .slice(0, 3)
            .join(' | ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const response = await getTutorResponse(promptForModel, {
        mode: 'learning',
        systemPrompt: guardrails,
        knowledge: knowledgeContext || undefined,
      });
      if (recentReflections.length) {
        trackEvent('reflection_referenced_in_tutor', {
          lesson_id: lessonContext?.lessonId,
          subject: lessonContext?.subject ?? null,
        });
      }

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        isUser: false,
        timestamp: new Date(),
        role: 'assistant',
      };

      setMessages((prev) => [...prev, aiResponse]);
      if (responseMode === 'hint') {
        setHintMessages((prev) => prev + 1);
      }
      if (confusionCount >= 2 && !reflectionPrompted) {
        maybePromptReflection('confusion');
      } else if (hintMessages + 1 >= 3 && !reflectionPrompted) {
        maybePromptReflection('hint_count');
      }
      setPlanUsage((prev) => ({
        limit: response.limit ?? prev.limit,
        remaining:
          response.limit === 'unlimited'
            ? null
            : response.remaining ?? response.limit ?? prev.remaining,
        plan: response.plan ?? prev.plan,
      }));
      trackEvent('learning_assistant_message_received', {
        studentId: student.id,
        source: 'openrouter',
        plan: response.plan ?? undefined,
        remaining: response.remaining,
        hint_level: metadata?.hintLevel ?? null,
        subject: lessonContext?.subject ?? null,
        concept: conceptTag,
        curated_alternate: Boolean(curatedAlternate),
      });
    } catch (err) {
      console.error('[LearningAssistant] AI response failed', err);
      const errorMessage =
        err instanceof Error ? err.message : 'The assistant is unavailable right now.';
      setAssistantError(errorMessage);

      if (errorMessage.toLowerCase().includes('limit')) {
        trackEvent('learning_assistant_limit_reached', {
          studentId: student.id,
          plan: planUsage.plan,
        });
        return;
      }

      const lowerMessage = errorMessage.toLowerCase();
      if (
        lowerMessage.includes('school-safe') ||
        lowerMessage.includes('unsafe') ||
        lowerMessage.includes('trusted adult') ||
        lowerMessage.includes('personal')
      ) {
        trackEvent('learning_assistant_blocked', {
          studentId: student.id,
          reason: 'safety_guardrail',
        });
        return;
      }

      const fallbackResponse: ChatMessage = {
        id: (Date.now() + 2).toString(),
        content: getContextualResponse(messageToSend),
        isUser: false,
        timestamp: new Date(),
        role: 'assistant',
      };

      setMessages((prev) => [...prev, fallbackResponse]);
      trackEvent('learning_assistant_message_received', {
        studentId: student.id,
        source: 'rules-engine',
        hint_level: metadata?.hintLevel ?? null,
        subject: lessonContext?.subject ?? null,
        concept: conceptTagLabel ?? 'concept',
        curated_alternate: false,
      });
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (!assistantWindowRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(
        assistantWindowRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return (
    <>
      {/* Assistant Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 focus-ring"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: isOpen ? "0 0 0 4px rgba(151, 28, 181, 0.3)" : "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
        aria-label="Open learning assistant"
        aria-expanded={isOpen}
        aria-controls="learning-assistant-window"
        style={{
          background: `linear-gradient(135deg, ${tutorPalette.accent}, ${tutorPalette.background})`,
          color: tutorPalette.text,
        }}
      >
        <span className="text-xl" aria-hidden>
          {tutorIcon}
        </span>
      </motion.button>

      {/* Assistant Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 left-6 right-6 sm:right-auto sm:w-96 md:w-[28rem] h-[32rem] md:h-[36rem] bg-white rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-assistant-title"
            aria-describedby="learning-assistant-description"
            id="learning-assistant-window"
            tabIndex={-1}
            ref={assistantWindowRef}
          >
            {/* Header - Simplified for clarity */}
            <div
              className="p-3 flex items-center justify-between"
              style={{
                background: `linear-gradient(135deg, ${tutorPalette.accent}, ${tutorPalette.background})`,
                color: tutorPalette.text,
              }}
            >
              {/* Left: Tutor identity */}
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30 text-xl"
                  style={{ color: tutorPalette.text }}
                >
                  {tutorIcon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm" id="learning-assistant-title">
                    {tutorDisplayName}
                  </h3>
                  <p className="text-xs opacity-80" id="learning-assistant-description">
                    {tutorLabel}
                  </p>
                </div>
              </div>

              {/* Right: Info and Close buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openExplainer('header')}
                  className="p-2 bg-white/15 hover:bg-white/25 rounded-full transition-colors focus-ring"
                  aria-label="How ElevatED explains things"
                  title="Info"
                >
                  <Info className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setLessonContext(null);
                    setContextHint(null);
                  }}
                  className="p-2 bg-white/30 hover:bg-red-500 hover:text-white rounded-full transition-colors focus-ring"
                  aria-label="Close learning assistant"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sub-header: Quick status (collapsible info) */}
            <div className="px-3 py-2 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {chatMode === 'guided_only' ? 'Hints only' : chatMode === 'guided_preferred' ? 'Hints first' : 'Free mode'}
                </span>
                {planUsage.limit !== 'unlimited' && planUsage.remaining != null && (
                  <span className="text-slate-500">
                    {planUsage.remaining} chats left
                  </span>
                )}
              </div>
              {canReturnToLesson && (
                <button
                  type="button"
                  onClick={handleReturnToLesson}
                  className="inline-flex items-center gap-1 text-brand-blue hover:text-brand-violet font-medium"
                >
                  <Target className="h-3 w-3" />
                  Back to lesson
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action.action)}
                    className="min-h-[44px] flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-brand-light-violet rounded-lg text-xs transition-colors focus-ring"
                    aria-label={action.text}
                  >
                    <action.icon className="h-3 w-3" />
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
              {(chatMode === 'guided_only' || chatMode === 'guided_preferred') && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {guidedCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => {
                          setSelectedCardId(card.id);
                          trackEvent('chat_prompt_card_selected', {
                            card_id: card.id,
                            mode: chatMode,
                            has_context: Boolean(lessonContext?.lessonId || lessonContext?.subject),
                          });
                          void handleSendMessage(card.prompt, { source: 'card', cardId: card.id });
                        }}
                        className="min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 hover:border-brand-blue/60 text-left p-3 text-sm font-semibold text-gray-800 transition focus-ring"
                      >
                        <span className="block">{card.label}</span>
                        <span className="text-xs text-gray-500">
                          {lessonContext?.subject ? 'Context aware' : 'Quick start'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedCardId && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Quick clarifiers</p>
                      <div className="flex flex-wrap gap-2">
                        {clarifierChips.map((chip) => (
                          <button
                            key={chip}
                            className="min-h-[44px] inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-gray-700 hover:border-brand-blue/60 focus-ring"
                            onClick={() => {
                              trackEvent('chat_prompt_clarifier_selected', {
                                card_id: selectedCardId,
                                mode: chatMode,
                                has_context: Boolean(lessonContext?.lessonId || lessonContext?.subject),
                                clarifier: chip,
                              });
                              const basePrompt = guidedCards.find((c) => c.id === selectedCardId)?.prompt ?? '';
                              void handleSendMessage(`${basePrompt} ${chip}`, {
                                source: 'card',
                                cardId: selectedCardId,
                              });
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {(contextHint || lessonContext) && (
              <div className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-brand-violet" />
                <div className="flex flex-col">
                  <span>Using lesson context: {lessonContext?.lessonTitle ?? contextHint}</span>
                  {lessonContext?.subject && (
                    <span className="text-[11px] text-slate-500">
                      {lessonContext.subject}
                      {lessonContext.moduleTitle ? ` • ${lessonContext.moduleTitle}` : ''}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="ml-auto text-[11px] font-semibold text-brand-violet hover:underline"
                  onClick={() => {
                    setContextHint(null);
                    setLessonContext(null);
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${message.isUser
                      ? 'bg-brand-violet text-white'
                      : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="text-sm leading-relaxed flex-1">{message.content}</p>
                      {!message.isUser && (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 underline-offset-2 hover:underline focus-ring"
                          onClick={() => {
                            setReportTarget({ messageId: message.id, answer: message.content });
                            setReportReason('incorrect');
                            setReportNotes('');
                            setReportError(null);
                            setReportSuccess(false);
                            trackEvent('learning_assistant_report_opened', {
                              message_id: message.id,
                              conversation_id: conversationId.current,
                              lesson_id: lessonContext?.lessonId ?? null,
                              subject: lessonContext?.subject ?? null,
                            });
                          }}
                        >
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {assistantError && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3" role="alert">
                  {assistantError}
                </div>
              )}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 p-3 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-slate-500">Response style:</span>
                <button
                  type="button"
                  onClick={() => setResponseMode('hint')}
                  aria-pressed={responseMode === 'hint'}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors focus-ring ${responseMode === 'hint'
                    ? 'bg-brand-violet text-white'
                    : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                    }`}
                >
                  Give me a hint
                </button>
                <button
                  type="button"
                  onClick={() => setResponseMode('solution')}
                  aria-pressed={responseMode === 'solution'}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors focus-ring ${responseMode === 'solution'
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                    }`}
                >
                  Show full solution
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-slate-500">Need help?</span>
                {scaffoldActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      setResponseMode('hint');
                      void handleSendMessage(action.prompt, { source: 'scaffold', hintLevel: action.id });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:border-brand-blue/60 hover:text-brand-blue focus-ring"
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    {action.label}
                    <span className="text-[10px] text-slate-500 ml-1">{action.helper}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Subject tag: {subjectTagLabel ?? 'General'}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Concept tag: {conceptTagLabel}
                </span>
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Scaffold actions log these tags
                </span>
              </div>
              {(chatMode !== 'guided_only' || guidedCardUsed) && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSendMessage(undefined, { source: 'free' });
                      }
                    }}
                    placeholder={
                      chatMode === 'guided_only'
                        ? 'Ask a follow-up...'
                        : 'Ask me anything about your studies...'
                    }
                    className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet text-sm"
                    aria-label="Message the learning assistant"
                    ref={inputRef}
                  />
                  <button
                    onClick={() => void handleSendMessage(undefined, { source: 'free' })}
                    disabled={!inputMessage.trim()}
                    className="p-2 bg-brand-violet text-white rounded-xl hover:bg-brand-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                    aria-label="Send learning assistant message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              {chatMode === 'guided_only' && !guidedCardUsed && (
                <p className="text-xs text-slate-500">Pick a prompt card to start. Free text unlocks after you send a prompt.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showExplainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tutor safety</p>
                <h4 className="text-xl font-bold text-slate-900">How this tutor works</h4>
                <p className="text-sm text-slate-600">School-safe help, short answers, and reminders to ask an adult if something feels off.</p>
              </div>
              <button
                onClick={() => closeExplainer('x')}
                className="p-1 rounded-full hover:bg-slate-100 focus-ring"
                aria-label="Close explanation modal"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">I can help with…</p>
                <ul className="space-y-1 text-emerald-800">
                  <li>• Explain lessons in short steps</li>
                  <li>• Give hints before answers</li>
                  <li>• Practice or quiz you safely</li>
                </ul>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">I can’t…</p>
                <ul className="space-y-1 text-rose-800">
                  <li>• Give test/quiz answers</li>
                  <li>• Collect personal info</li>
                  <li>• Replace your teacher</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Ask an adult if…</p>
                <ul className="space-y-1 text-amber-800">
                  <li>• Something feels wrong</li>
                  <li>• You see unsafe content</li>
                  <li>• You’re asked for personal info</li>
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Your data</p>
                <ul className="space-y-1 text-slate-800">
                  <li>• Saves lesson context to stay on-topic.</li>
                  <li>• Stores recent tutor chats for safety review.</li>
                  <li>• Keeps progress, goals, and streaks to personalize help.</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Need help?</p>
                <ul className="space-y-1 text-slate-800">
                  <li>• Report answers with the “Report” button in chat.</li>
                  <li>• Ask a parent to visit Safety in the Family Dashboard.</li>
                  <li>• Support responds within 1 business day.</li>
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900">Quick check</p>
              {[
                { id: 'cheating', statement: 'The tutor can give me answers for a test.', correct: false },
                { id: 'adult', statement: 'I should ask an adult if something feels wrong.', correct: true },
              ].map((item) => {
                const selected = quizChoice?.startsWith(item.id) ? quizChoice.split(':')[1] : null;
                const isCorrect = selected ? selected === String(item.correct) : null;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
                    <p className="text-sm text-gray-800">{item.statement}</p>
                    <div className="inline-flex gap-1">
                      {[true, false].map((value) => (
                        <button
                          key={`${item.id}-${value}`}
                          type="button"
                          onClick={() => {
                            setQuizChoice(`${item.id}:${value}`);
                            trackEvent('tutor_explainer_quiz_answered', { correct: value === item.correct });
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border ${selected === String(value)
                            ? value === item.correct
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'border-slate-200 text-gray-700 hover:border-brand-violet/60'
                            }`}
                        >
                          {value ? 'True' : 'False'}
                        </button>
                      ))}
                    </div>
                    {isCorrect !== null && (
                      <span className={`text-[11px] font-semibold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isCorrect ? 'Correct' : 'Try again'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => closeExplainer('backdrop')}
                className="text-sm font-semibold text-gray-600 hover:text-gray-800 focus-ring"
              >
                Ask an adult
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-violet px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue focus-ring"
                onClick={() => {
                  trackEvent('tutor_explainer_completed', {
                    source: explainerSource ?? 'header',
                    quiz_shown: true,
                    quiz_correct: quizChoice?.includes('true') ?? false,
                    grade_band: student.grade,
                  });
                  closeExplainer('got_it');
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Report this answer</p>
                <h4 className="text-xl font-bold text-slate-900">Something felt off?</h4>
                <p className="text-sm text-slate-600">Tell us what was wrong so an adult can review it.</p>
              </div>
              <button
                onClick={() => {
                  setReportTarget(null);
                  setReportNotes('');
                  setReportError(null);
                  setReportSuccess(false);
                }}
                className="p-1 rounded-full hover:bg-slate-100 focus-ring"
                aria-label="Close report dialog"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Tutor answer</p>
              <p className="text-slate-800 whitespace-pre-wrap">{reportTarget.answer}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">What went wrong?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'incorrect', label: 'Incorrect' },
                  { id: 'confusing', label: 'Confusing' },
                  { id: 'unsafe', label: 'Not school-safe' },
                  { id: 'off_topic', label: 'Off-topic' },
                  { id: 'other', label: 'Other' },
                ] satisfies Array<{ id: TutorReportReason; label: string }>).map((option) => {
                  const active = reportReason === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setReportReason(option.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-ring ${active ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-200 text-gray-700 hover:border-brand-blue/60'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Flag className="h-4 w-4" />
                        {option.label}
                      </span>
                      <span className="text-[11px] text-slate-500">{active ? 'Selected' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="report-notes" className="text-sm font-semibold text-gray-900">
                Anything else to add? (optional)
              </label>
              <textarea
                id="report-notes"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                maxLength={500}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus-ring"
                placeholder="Example: It shared personal info or felt unsafe."
              />
              <p className="text-[11px] text-slate-500">We save this chat to review; we do not ask for your personal info.</p>
            </div>
            {reportError && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{reportError}</div>}
            {reportSuccess && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                Thanks. We flagged this for review and will follow up via your parent account if needed.
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportTarget(null);
                  setReportNotes('');
                  setReportError(null);
                  setReportSuccess(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-slate-100 focus-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={() => void handleReportSubmit()}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 focus-ring"
              >
                {reportSubmitting ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LearningAssistant;
