import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, CheckCircle, Brain, Target, Loader2, AlertTriangle, Sparkles, SkipForward, Heart, Star, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import type { Student } from '../../types';
import {
  type AssessmentAnswer,
  type AssessmentOption,
  type AssessmentResult,
  type LoadedAssessment,
  finalizeAssessmentAttempt,
  loadDiagnosticAssessment,
  recordAssessmentResponse,
} from '../../services/assessmentService';

interface AssessmentFlowProps {
  onComplete: (result?: AssessmentResult | null) => void;
}

type Step = 'intro' | 'assessment' | 'results';

// Encouraging messages shown between questions
const ENCOURAGEMENT_MESSAGES = [
  "You're doing great! 🌟",
  "Keep going, you've got this! 💪",
  "Nice work! Every answer helps us learn about you.",
  "Awesome! Let's see what's next.",
  "You're making progress! ✨",
  "Great effort! There are no wrong answers here.",
  "Perfect! We're learning together.",
  "Wonderful! You're helping us understand you better.",
];

const getEncouragementMessage = (index: number): string => {
  return ENCOURAGEMENT_MESSAGES[index % ENCOURAGEMENT_MESSAGES.length];
};

const AssessmentFlow: React.FC<AssessmentFlowProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const student = (user as Student) ?? null;

  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [assessment, setAssessment] = useState<LoadedAssessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionStart, setQuestionStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState('');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentStep === 'assessment' && startTime) {
      interval = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, startTime]);

  const seedExistingResponses = (loaded: LoadedAssessment): AssessmentAnswer[] => {
    if (!loaded.existingResponses.size) return [];
    return loaded.questions
      .map((question) => {
        const existing = loaded.existingResponses.get(question.bankQuestionId);
        if (!existing || existing.selectedOptionId == null) return null;
        return {
          questionId: question.id,
          bankQuestionId: question.bankQuestionId,
          optionId: existing.selectedOptionId,
          isCorrect: Boolean(existing.isCorrect),
          timeSpent: 0,
          weight: question.weight,
          concept: question.concept,
          skillIds: question.skillIds,
        } as AssessmentAnswer;
      })
      .filter((answer): answer is AssessmentAnswer => answer !== null);
  };

  const handleStartAssessment = async () => {
    if (!student) return;
    setError(null);
    setLoading(true);
    setResult(null);
    setAnswers([]);
    setSkippedQuestions(new Set());
    setAssessment(null);
    setCurrentQuestionIndex(0);
    setTimeSpent(0);
    setQuestionStart(null);
    try {
      const preferredSubject =
        student.learningPreferences?.focusSubject && student.learningPreferences.focusSubject !== 'balanced'
          ? student.learningPreferences.focusSubject
          : null;
      const loaded = await loadDiagnosticAssessment(student.id, {
        grade: student.grade,
        subject: preferredSubject,
      });
      const seededAnswers = seedExistingResponses(loaded);
      setAssessment(loaded);
      setAnswers(seededAnswers);
      setCurrentQuestionIndex(seededAnswers.length);
      const now = new Date();
      setStartTime(now);
      setQuestionStart(Date.now());
      setCurrentStep('assessment');
    } catch (err) {
      console.error('[assessment] failed to load diagnostic', err);
      setError('We couldn\'t load the questions right now. Please try again in a moment.');
      setCurrentStep('intro');
    } finally {
      setLoading(false);
    }
  };

  const moveToNextQuestion = useCallback(async (isCorrect?: boolean) => {
    if (!assessment) return;

    // Show encouragement briefly
    setEncouragementMessage(getEncouragementMessage(answers.length));
    setLastAnswerCorrect(isCorrect ?? null);
    setShowEncouragement(true);

    await new Promise(resolve => setTimeout(resolve, 800));
    setShowEncouragement(false);

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= assessment.questions.length) {
      // Check if we need to go back to any skipped questions
      if (skippedQuestions.size > 0) {
        const firstSkipped = Array.from(skippedQuestions).sort((a, b) => a - b)[0];
        setCurrentQuestionIndex(firstSkipped);
        setQuestionStart(Date.now());
        return;
      }

      // All done - finalize
      const summary = await finalizeAssessmentAttempt({
        studentId: student!.id,
        assessment,
        answers,
        startedAt: startTime ?? new Date(),
        grade: student?.grade,
      });
      setResult(summary);
      setCurrentStep('results');
    } else {
      setCurrentQuestionIndex(nextIndex);
      setQuestionStart(Date.now());
      // Difficulty adaptation happens server-side
    }
  }, [assessment, answers, currentQuestionIndex, skippedQuestions, startTime, student]);

  const handleAnswer = async (option: AssessmentOption) => {
    if (!student || !assessment) return;
    const question = assessment.questions[currentQuestionIndex];
    if (!question) return;

    setSaving(true);
    setError(null);
    const elapsedSeconds = questionStart ? Math.max(1, Math.round((Date.now() - questionStart) / 1000)) : 1;

    try {
      const { isCorrect } = await recordAssessmentResponse({
        studentId: student.id,
        attemptId: assessment.attemptId,
        assessmentId: assessment.assessmentId,
        question,
        optionId: option.id,
        timeSpentSeconds: elapsedSeconds,
      });

      const newAnswer: AssessmentAnswer = {
        questionId: question.id,
        bankQuestionId: question.bankQuestionId,
        optionId: option.id,
        isCorrect,
        timeSpent: elapsedSeconds,
        weight: question.weight,
        concept: question.concept,
        skillIds: question.skillIds,
      };

      // Remove from skipped if it was skipped before
      if (skippedQuestions.has(currentQuestionIndex)) {
        const newSkipped = new Set(skippedQuestions);
        newSkipped.delete(currentQuestionIndex);
        setSkippedQuestions(newSkipped);
      }

      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);

      await moveToNextQuestion(isCorrect);
    } catch (err) {
      console.error('[assessment] failed to handle answer', err);
      setError('We couldn\'t save that answer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!assessment) return;

    // Mark this question as skipped
    const newSkipped = new Set(skippedQuestions);
    newSkipped.add(currentQuestionIndex);
    setSkippedQuestions(newSkipped);

    // Move to next
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= assessment.questions.length) {
      // If all questions are either answered or skipped, go to first skipped
      if (newSkipped.size > 0) {
        const firstSkipped = Array.from(newSkipped).sort((a, b) => a - b)[0];
        setCurrentQuestionIndex(firstSkipped);
        setQuestionStart(Date.now());
      }
    } else {
      setCurrentQuestionIndex(nextIndex);
      setQuestionStart(Date.now());
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const currentQuestion = useMemo(() => {
    if (!assessment) return null;
    return assessment.questions[currentQuestionIndex] ?? null;
  }, [assessment, currentQuestionIndex]);

  const progress = assessment ? (answers.length / Math.max(1, assessment.questions.length)) * 100 : 0;

  // Calculate unanswered questions (not in answers, not the current one)
  const answeredQuestionIds = useMemo(() => new Set(answers.map(a => a.questionId)), [answers]);
  const remainingCount = assessment
    ? assessment.questions.filter((q, i) => !answeredQuestionIds.has(q.id) && i !== currentQuestionIndex).length + 1
    : 0;

  if (currentStep === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-light-blue to-brand-light-teal flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <div className="w-20 h-20 bg-gradient-to-r from-brand-teal to-brand-blue rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10 text-white" />
            </div>

            {/* Friendlier title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Let's See Where You Are! 🌟</h1>

            {/* Reassuring messaging */}
            <p className="text-lg text-gray-600 mb-4 leading-relaxed">
              We're going to ask you a few questions to understand what you already know.
              This helps us find the <span className="font-semibold text-brand-teal">perfect lessons just for you</span>.
            </p>

            {/* Key reassurance */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8">
              <p className="text-emerald-800 font-medium">
                ✨ There's no failing here—just learning! Every answer helps us understand you better.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-brand-light-teal p-4 rounded-2xl">
                <Star className="h-8 w-8 text-brand-blue mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Go at Your Pace</h3>
                <p className="text-sm text-gray-600">Take your time—no rush at all</p>
              </div>

              <div className="bg-brand-light-violet p-4 rounded-2xl">
                <Target className="h-8 w-8 text-brand-violet mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Just Do Your Best</h3>
                <p className="text-sm text-gray-600">If you're unsure, that's okay!</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div className="text-left text-sm">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleStartAssessment}
                disabled={loading || !student}
                className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Getting ready…
                  </>
                ) : (
                  <>
                    Let's Get Started!
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => onComplete(null)}
                className="w-full text-gray-600 py-2 rounded-xl hover:text-gray-800 transition-colors"
              >
                Skip for now (we'll find lessons for your grade)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (currentStep === 'assessment') {
    const isLoadingState = loading || !assessment || !currentQuestion;
    const isSkippedQuestion = skippedQuestions.has(currentQuestionIndex);

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header - softer presentation */}
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-brand-light-blue rounded-full flex items-center justify-center">
                  <Brain className="h-5 w-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Finding Your Starting Point</h2>
                  <p className="text-sm text-gray-600">
                    {remainingCount} {remainingCount === 1 ? 'question' : 'questions'} to go • Take your time!
                  </p>
                </div>
              </div>
              {/* Time indicator is now subtle and secondary */}
              <div className="text-right opacity-60 hover:opacity-100 transition-opacity">
                <div className="text-sm text-gray-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatTime(timeSpent)}
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div className="text-left text-sm">{error}</div>
              </div>
            )}

            {/* Progress bar with encouraging labels */}
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress > 0 && (
                <div className="absolute -top-6 right-0 text-xs text-brand-teal font-medium">
                  {Math.round(progress)}% complete!
                </div>
              )}
            </div>
          </div>

          {/* Encouragement overlay */}
          <AnimatePresence>
            {showEncouragement && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
              >
                <div className={`px-8 py-4 rounded-2xl shadow-xl ${lastAnswerCorrect === true
                  ? 'bg-emerald-500 text-white'
                  : lastAnswerCorrect === false
                    ? 'bg-amber-500 text-white'
                    : 'bg-brand-blue text-white'
                  }`}>
                  <p className="text-xl font-semibold">{encouragementMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoadingState ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm flex items-center justify-center">
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Finding the right question for you…</span>
              </div>
            </div>
          ) : (
            <motion.div
              key={currentQuestion?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl p-8 shadow-sm"
            >
              {/* Removed difficulty tuning display - too test-like */}
              {isSkippedQuestion && (
                <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  You skipped this one earlier. Give it another try, or skip again if you're not sure.
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-8">{currentQuestion?.prompt}</h3>

              <div className="space-y-4">
                {currentQuestion?.options.map((option, index) => (
                  <motion.button
                    key={option.id}
                    onClick={() => handleAnswer(option)}
                    disabled={saving}
                    className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-brand-teal hover:bg-brand-light-teal transition-all duration-200 disabled:opacity-70"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-700">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="text-lg">{option.text}</span>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Skip option - friendly and non-judgmental */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={handleSkipQuestion}
                  disabled={saving}
                  className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>Not sure? Skip this one for now</span>
                </button>
              </div>

              {saving && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving…</span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 'results' && result) {
    const strengths = result.strengths.length ? result.strengths : ['We found areas where you\'re already strong!'];
    const growthAreas = result.weaknesses.length ? result.weaknesses : ['We\'ve identified some great areas to explore'];

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-light-teal to-brand-light-violet flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            {/* Celebration first! */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gradient-to-r from-brand-teal to-brand-blue rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Rocket className="h-12 w-12 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-gray-900 mb-2"
            >
              You Did It! 🎉
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-gray-600 mb-8"
            >
              Thanks for sharing what you know with us. Now we can create learning that's perfect for <span className="font-semibold text-brand-teal">you</span>!
            </motion.p>

            {/* What we learned - strengths FIRST and prominently */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 text-left"
            >
              <h3 className="font-semibold text-emerald-700 mb-3 flex items-center">
                <Star className="h-5 w-5 mr-2 text-emerald-600" />
                What You're Already Great At
              </h3>
              <ul className="space-y-2">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Growth areas - framed positively */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-brand-light-blue/50 border border-brand-blue/20 rounded-2xl p-6 mb-8 text-left"
            >
              <h3 className="font-semibold text-brand-blue mb-3 flex items-center">
                <Target className="h-5 w-5 mr-2 text-brand-blue" />
                What We'll Explore Together
              </h3>
              <ul className="space-y-2">
                {growthAreas.map((area, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-brand-teal flex-shrink-0" />
                    <span className="text-gray-700">{area}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* First recommendations */}
            {result.planMessages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-gradient-to-r from-brand-light-teal to-brand-light-violet rounded-2xl p-5 mb-8 text-left"
              >
                <div className="flex items-center space-x-2 text-brand-violet mb-3">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-semibold">Your First Lessons Are Ready!</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {result.planMessages.slice(0, 3).map((tip, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-brand-teal font-bold">{idx + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              onClick={() => onComplete(result)}
              className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center"
            >
              <Rocket className="h-5 w-5 mr-2" />
              Start Learning!
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default AssessmentFlow;
