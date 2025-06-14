import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Clock, CheckCircle, Brain, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Assessment, Question, Answer, Subject } from '../../types';

interface AssessmentFlowProps {
  onComplete: () => void;
}

const AssessmentFlow: React.FC<AssessmentFlowProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<'intro' | 'assessment' | 'results'>('intro');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Mock questions for the assessment
  const mockQuestions: Question[] = [
    {
      id: '1',
      type: 'multiple_choice',
      question: 'What is 12 × 15?',
      options: ['160', '180', '200', '220'],
      correctAnswer: '180',
      explanation: '12 × 15 = 180. Break it down: 12 × 10 = 120, 12 × 5 = 60, so 120 + 60 = 180.',
      difficulty: 5,
      concept: 'multiplication'
    },
    {
      id: '2',
      type: 'multiple_choice',
      question: 'Which sentence is grammatically correct?',
      options: [
        'Me and my friend went to the store.',
        'My friend and I went to the store.',
        'My friend and me went to the store.',
        'I and my friend went to the store.'
      ],
      correctAnswer: 'My friend and I went to the store.',
      explanation: 'Use "I" when it\'s the subject of the sentence. A good test is to remove the other person and see if it still sounds correct.',
      difficulty: 4,
      concept: 'grammar'
    },
    {
      id: '3',
      type: 'multiple_choice',
      question: 'What happens to water when it freezes?',
      options: [
        'It becomes denser',
        'It becomes less dense',
        'Its density stays the same',
        'It turns into a gas'
      ],
      correctAnswer: 'It becomes less dense',
      explanation: 'When water freezes, it expands and becomes less dense. This is why ice floats on water.',
      difficulty: 3,
      concept: 'states of matter'
    },
    {
      id: '4',
      type: 'multiple_choice',
      question: 'The American Revolution ended in which year?',
      options: ['1776', '1781', '1783', '1787'],
      correctAnswer: '1783',
      explanation: 'The American Revolution officially ended with the Treaty of Paris in 1783, although fighting largely ceased after the Battle of Yorktown in 1781.',
      difficulty: 4,
      concept: 'american history'
    }
  ];

  useEffect(() => {
    if (currentStep === 'assessment' && !assessment) {
      setAssessment({
        id: 'diagnostic-1',
        subject: 'math',
        questions: mockQuestions,
        currentQuestionIndex: 0,
        answers: [],
        adaptiveDifficulty: 5,
        timeSpent: 0
      });
      setStartTime(new Date());
    }
  }, [currentStep]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentStep === 'assessment' && startTime) {
      interval = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, startTime]);

  const handleAnswer = (answer: string) => {
    if (!assessment) return;

    const currentQuestion = assessment.questions[assessment.currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;
    
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      userAnswer: answer,
      isCorrect,
      timeSpent: 15 // Mock time spent on question
    };

    const updatedAssessment = {
      ...assessment,
      answers: [...assessment.answers, newAnswer],
      currentQuestionIndex: assessment.currentQuestionIndex + 1,
      adaptiveDifficulty: isCorrect ? 
        Math.min(10, assessment.adaptiveDifficulty + 1) : 
        Math.max(1, assessment.adaptiveDifficulty - 1)
    };

    setAssessment(updatedAssessment);

    if (updatedAssessment.currentQuestionIndex >= updatedAssessment.questions.length) {
      setCurrentStep('results');
    }
  };

  const formatTime = (seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const calculateResults = () => {
    if (!assessment) return { score: 0, strengths: [], weaknesses: [] };
    
    const correctAnswers = assessment.answers.filter(a => a.isCorrect).length;
    const score = Math.round((correctAnswers / assessment.answers.length) * 100);
    
    return {
      score,
      strengths: ['Multiplication', 'Grammar'],
      weaknesses: ['States of Matter', 'American History']
    };
  };

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
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Diagnostic Assessment
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              This adaptive assessment will help us understand your current knowledge level 
              across Math, English, Science, and Social Studies. Based on your answers, 
              we'll create a personalized learning path just for you!
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

            <div className="space-y-4">
              <button
                onClick={() => setCurrentStep('assessment')}
                className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center"
              >
                Start Assessment
                <ArrowRight className="ml-2 h-5 w-5" />
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

  if (currentStep === 'assessment' && assessment) {
    const currentQuestion = assessment.questions[assessment.currentQuestionIndex];
    const progress = (assessment.currentQuestionIndex / assessment.questions.length) * 100;

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-brand-light-blue rounded-full flex items-center justify-center">
                  <Brain className="h-5 w-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnostic Assessment</h2>
                  <p className="text-sm text-gray-600">
                    Question {assessment.currentQuestionIndex + 1} of {assessment.questions.length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-brand-blue">{formatTime(timeSpent)}</div>
                <div className="text-sm text-gray-600">Time elapsed</div>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-8 shadow-sm"
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-8">
              {currentQuestion.question}
            </h3>

            <div className="space-y-4">
              {currentQuestion.options?.map((option, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-brand-teal hover:bg-brand-light-teal transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-700">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (currentStep === 'results') {
    const results = calculateResults();
    
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
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Assessment Complete!
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Great job! We've analyzed your responses and created a personalized learning path.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-brand-light-blue p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-blue mb-2">{results.score}%</div>
                <div className="text-sm text-gray-600">Overall Score</div>
              </div>
              
              <div className="bg-brand-light-teal p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-teal mb-2">{formatTime(timeSpent)}</div>
                <div className="text-sm text-gray-600">Time Taken</div>
              </div>
              
              <div className="bg-brand-light-violet p-6 rounded-2xl">
                <div className="text-3xl font-bold text-brand-violet mb-2">8</div>
                <div className="text-sm text-gray-600">Learning Level</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="text-left">
                <h3 className="font-semibold text-green-600 mb-3">💪 Your Strengths</h3>
                <ul className="space-y-2">
                  {results.strengths.map((strength, index) => (
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
                  {results.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-gray-700">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

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