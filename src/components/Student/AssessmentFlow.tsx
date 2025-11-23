import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, CheckCircle, Brain, Target, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
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
  onComplete: () => void;
}

type Step = 'intro' | 'assessment' | 'results';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AssessmentFlow: React.FC<AssessmentFlowProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const student = (user as Student) ?? null;

  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [assessment, setAssessment] = useState<LoadedAssessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionStart, setQuestionStart] = useState<number | null>(null);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState(5);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentStep === 'assessment' && startTime) {
      interval = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, startTime]);

  const seedExistingResponses = (loaded: LoadedAssessment) => {
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
        } satisfies AssessmentAnswer;
      })
      .filter((answer): answer is AssessmentAnswer => Boolean(answer));
  };

  const handleStartAssessment = async () => {
    if (!student) return;
    setError(null);
    setLoading(true);
    setResult(null);
    setAnswers([]);
    setAssessment(null);
    setCurrentQuestionIndex(0);
    setTimeSpent(0);
    setQuestionStart(null);
    try {
      const loaded = await loadDiagnosticAssessment(student.id);
      const seededAnswers = seedExistingResponses(loaded);
      setAssessment(loaded);
      setAnswers(seededAnswers);
      setCurrentQuestionIndex(seededAnswers.length);
      const difficultyAverage =
        loaded.questions.reduce((sum, question) => sum + (question.difficulty ?? 5), 0) /
        Math.max(1, loaded.questions.length);
      setAdaptiveDifficulty(Math.round(difficultyAverage) || 5);
      const now = new Date();
      setStartTime(now);
      setQuestionStart(Date.now());
      setCurrentStep('assessment');
    } catch (err) {
      console.error('[assessment] failed to load diagnostic', err);
      setError('We could not load the diagnostic right now. Please try again in a moment.');
      setCurrentStep('intro');
    } finally {
      setLoading(false);
    }
  };

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

      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);

      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex >= assessment.questions.length) {
        const summary = await finalizeAssessmentAttempt({
          studentId: student.id,
          assessment,
          answers: updatedAnswers,
          startedAt: startTime ?? new Date(),
        });
        setResult(summary);
        setCurrentStep('results');
      } else {
        setCurrentQuestionIndex(nextIndex);
        setQuestionStart(Date.now());
        setAdaptiveDifficulty((prev) => clamp(prev + (isCorrect ? 1 : -1), 1, 10));
      }
    } catch (err) {
      console.error('[assessment] failed to handle answer', err);
      setError('Saving your response failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const currentQuestion = useMemo(() => {
    if (!assessment) return null;
    return assessment.questions[currentQuestionIndex] ?? null;
  }, [assessment, currentQuestionIndex]);

  const progress = assessment ? (answers.length / Math.max(1, assessment.questions.length)) * 100 : 0;

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
              <Brain className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Diagnostic Assessment</h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              This adaptive assessment will help us understand your current knowledge level across Math, English,
              Science, and Social Studies. Based on your answers, we&apos;ll create a personalized learning path just
              for you!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-brand-light-teal p-4 rounded-2xl">
                <Clock className="h-8 w-8 text-brand-blue mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">15-20 Minutes</h3>
                <p className="text-sm text-gray-600">Typical completion time</p>
              </div>

              <div className="bg-brand-light-violet p-4 rounded-2xl">
                <Target className="h-8 w-8 text-brand-violet mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Adaptive Questions</h3>
                <p className="text-sm text-gray-600">Adjusts to your skill level</p>
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
                    Loading assessment…
                  </>
                ) : (
                  <>
                    Start Assessment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              <button
                onClick={onComplete}
                className="w-full text-gray-600 py-2 rounded-xl hover:text-gray-800 transition-colors"
              >
                Skip for now (start at grade level)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (currentStep === 'assessment') {
    const isLoadingState = loading || !assessment || !currentQuestion;
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-brand-light-blue rounded-full flex items-center justify-center">
                  <Brain className="h-5 w-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnostic Assessment</h2>
                  <p className="text-sm text-gray-600">
                    Question {Math.min(currentQuestionIndex + 1, assessment?.questions.length ?? 0)} of{' '}
                    {assessment?.questions.length ?? 0}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-brand-blue">{formatTime(timeSpent)}</div>
                <div className="text-sm text-gray-600">Time elapsed</div>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div className="text-left text-sm">{error}</div>
              </div>
            )}

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {isLoadingState ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm flex items-center justify-center">
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading questions…</span>
              </div>
            </div>
          ) : (
            <motion.div
              key={currentQuestion?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">
                  Difficulty tuning: {adaptiveDifficulty} • {currentQuestion?.concept}
                </span>
                {saving && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving…</span>
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-8">{currentQuestion?.prompt}</h3>

              <div className="space-y-4">
                {currentQuestion?.options.map((option, index) => (
                  <motion.button
                    key={option.id}
                    onClick={() => handleAnswer(option)}
                    disabled={saving}
                    className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-brand-teal hover:bg-brand-light-teal transition-all duration-200 disabled:opacity-70"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 'results' && result) {
    const strengths = result.strengths.length ? result.strengths : ['Emerging mastery areas identified'];
    const weaknesses = result.weaknesses.length ? result.weaknesses : ['Next focus areas queued'];

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-light-teal to-brand-light-violet flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <div className="w-20 h-20 bg-gradient-to-r from-brand-teal to-brand-blue rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Complete!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Great job! We&apos;ve analyzed your responses and updated your personalized learning path.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-brand-light-blue p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-blue mb-2">{result.score}%</div>
                <div className="text-sm text-gray-600">Overall Score</div>
              </div>

              <div className="bg-brand-light-teal p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-teal mb-2">{formatTime(timeSpent)}</div>
                <div className="text-sm text-gray-600">Time Taken</div>
              </div>

              <div className="bg-brand-light-violet p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-violet mb-2">
                  {result.correct}/{result.total}
                </div>
                <div className="text-sm text-gray-600">Questions Correct</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="text-left">
                <h3 className="font-semibold text-green-600 mb-3">💪 Your Strengths</h3>
                <ul className="space-y-2">
                  {strengths.map((strength, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-left">
                <h3 className="font-semibold text-orange-600 mb-3">🎯 Focus Areas</h3>
                <ul className="space-y-2">
                  {weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-gray-700">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.planMessages.length > 0 && (
              <div className="bg-brand-light-blue/40 rounded-2xl p-4 mb-6 text-left">
                <div className="flex items-center space-x-2 text-brand-blue mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-semibold">Fresh recommendations</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                  {result.planMessages.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg transition-all duration-300"
            >
              Start Your Learning Journey
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default AssessmentFlow;
