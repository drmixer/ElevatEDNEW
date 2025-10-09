import React, { useState } from 'react';
import {
  CheckCircle,
  ArrowRight,
  Brain,
  Lightbulb,
  Target,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  BookOpen,
  Globe2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LessonPreview: React.FC = () => {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const lessons = [
    {
      subject: 'Math',
      grade: 'Grade 3',
      focus: 'Multiplication Basics',
      steps: [
        {
          type: 'intro' as const,
          title: 'Multiplication Basics',
          subtitle: 'Understanding Products',
          content: 'Today we\'ll learn the fundamentals of multiplication. It\'s a key skill for everyday math!',
          icon: Brain,
          emoji: '✖️'
        },
        {
          type: 'concept' as const,
          title: 'Multiplication as Repeated Addition',
          subtitle: 'A simple way to think about it',
          content: 'Multiplication is a quick way to do repeated addition. For example, 3 × 4 means adding 3 four times: 3 + 3 + 3 + 3 = 12.',
          explanation: 'This concept helps us understand why multiplication works and makes it easier to solve problems.',
          icon: Lightbulb,
          visual: '3 × 4 = 3 + 3 + 3 + 3 = 12'
        },
        {
          type: 'practice' as const,
          title: 'Practice Problem',
          subtitle: 'Let\'s apply what we learned',
          question: 'What is 7 × 8?',
          options: ['54', '56', '63', '72'],
          correct: 1,
          explanation: '7 × 8 means adding 7 eight times, or adding 8 seven times. Both result in 56.',
          icon: Target
        }
      ]
    },
    {
      subject: 'Science',
      grade: 'Grade 5',
      focus: 'Ecosystem Energy Flow',
      steps: [
        {
          type: 'intro' as const,
          title: 'Ecosystems in Balance',
          subtitle: 'Tracking How Energy Moves',
          content: 'Let\'s explore how energy passes through an ecosystem and why each organism has an important role.',
          icon: Globe2,
          emoji: '🌿'
        },
        {
          type: 'concept' as const,
          title: 'Food Chain Roles',
          subtitle: 'Producers, consumers, and predators',
          content: 'Energy starts with the Sun, moves to producers, and then to consumers. Each arrow shows who gets energy next.',
          explanation: 'Understanding each role helps us predict what happens if one population changes or disappears.',
          icon: FlaskConical,
          visual: 'Sun → Grass → Grasshopper → Frog → Hawk'
        },
        {
          type: 'practice' as const,
          title: 'Check Your Understanding',
          subtitle: 'Identify the role',
          question: 'In this food chain, which organism is the primary consumer?',
          options: ['Sun', 'Grass', 'Grasshopper', 'Hawk'],
          correct: 2,
          explanation: 'Primary consumers eat producers. The grasshopper eats the grass, so it is the primary consumer.',
          icon: Target
        }
      ]
    },
    {
      subject: 'ELA',
      grade: 'Grade 7',
      focus: 'Finding the Theme',
      steps: [
        {
          type: 'intro' as const,
          title: 'Discovering Theme',
          subtitle: 'Looking beyond the plot',
          content: 'Themes are the big ideas that stories explore. We can find them by paying attention to how characters change.',
          icon: BookOpen,
          emoji: '📚'
        },
        {
          type: 'concept' as const,
          title: 'Theme Clues',
          subtitle: 'Character growth reveals big ideas',
          content: 'Watch how characters respond to challenges. Their choices and lessons hint at what the author wants us to learn.',
          explanation: 'When a character learns to rely on friends, the theme might be about the strength of teamwork.',
          icon: Lightbulb,
          visual: '"Teamwork helps characters overcome what they cannot face alone."'
        },
        {
          type: 'practice' as const,
          title: 'Apply the Strategy',
          subtitle: 'Spot the big idea',
          question:
            'After failing alone, Maya finally asks her debate partner for help and they win together. What theme best fits this story?',
          options: [
            'Hard work always leads to success',
            'Teamwork provides strength',
            'Competition makes people better',
            'Leaders never rely on others'
          ],
          correct: 1,
          explanation: 'The turning point is when Maya chooses to collaborate, showing that teamwork provides the support needed to succeed.',
          icon: Target
        }
      ]
    }
  ];

  const currentLesson = lessons[currentLessonIndex];
  const lessonSteps = currentLesson.steps;
  const currentLessonStep = lessonSteps[currentStep];

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setTimeout(() => {
      setShowExplanation(true);
    }, 500);
  };

  const nextStep = () => {
    if (currentStep < lessonSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const resetLesson = () => {
    setCurrentStep(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  const goToLesson = (index: number) => {
    const normalizedIndex = (index + lessons.length) % lessons.length;
    setCurrentLessonIndex(normalizedIndex);
    setCurrentStep(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  const goToNextLesson = () => {
    goToLesson(currentLessonIndex + 1);
  };

  const goToPreviousLesson = () => {
    goToLesson(currentLessonIndex - 1);
  };

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Interactive Learning Experience
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how our adaptive lessons guide students through concepts with personalized explanations and instant feedback
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Lesson Progress */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentLesson.subject} • {currentLesson.grade}
                </h3>
                <p className="text-sm text-gray-600">{currentLesson.focus}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={goToPreviousLesson}
                  className="p-2 rounded-full border border-gray-200 text-gray-600 hover:text-teal-600 hover:border-teal-300 transition-colors"
                  aria-label="Previous lesson example"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-sm text-gray-600">
                  Lesson {currentLessonIndex + 1} of {lessons.length}
                </div>
                <button
                  onClick={goToNextLesson}
                  className="p-2 rounded-full border border-gray-200 text-gray-600 hover:text-teal-600 hover:border-teal-300 transition-colors"
                  aria-label="Next lesson example"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Step {currentStep + 1} of {lessonSteps.length}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / lessonSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Lesson Content */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 p-8 text-white">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <currentLessonStep.icon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">{currentLessonStep.title}</h3>
                  <p className="opacity-90">{currentLessonStep.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {currentLessonStep.type === 'intro' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <div className="text-6xl mb-6">{currentLessonStep.emoji ?? '✨'}</div>
                    <p className="text-xl text-gray-700 leading-relaxed mb-8">
                      {currentLessonStep.content}
                    </p>
                    <button
                      onClick={nextStep}
                      className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center mx-auto"
                    >
                      Let's Start Learning
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </motion.div>
                )}

                {currentLessonStep.type === 'concept' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-8 mb-8">
                      {currentLessonStep.visual && (
                        <div className="text-center mb-6">
                          <div className="text-2xl font-semibold bg-white rounded-xl p-4 inline-block shadow-lg">
                            {currentLessonStep.visual}
                          </div>
                        </div>
                      )}
                      <p className="text-lg text-gray-700 leading-relaxed text-center">
                        {currentLessonStep.explanation}
                      </p>
                    </div>
                    <div className="text-center">
                      <button
                        onClick={nextStep}
                        className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center mx-auto"
                      >
                        Try a Practice Problem
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentLessonStep.type === 'practice' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="mb-8">
                      <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                        {currentLessonStep.question}
                      </h4>
                      <div className="space-y-4">
                        {currentLessonStep.options?.map((option, index) => (
                          <motion.button
                            key={index}
                            onClick={() => handleAnswerSelect(index)}
                            disabled={selectedAnswer !== null}
                            className={`w-full p-4 text-left border-2 rounded-xl transition-all duration-300 ${
                              selectedAnswer === null
                                ? 'border-gray-200 hover:border-teal-500 hover:bg-teal-50'
                                : selectedAnswer === index
                                ? index === currentLessonStep.correct
                                  ? 'border-green-500 bg-green-50 text-green-800'
                                  : 'border-red-500 bg-red-50 text-red-800'
                                : index === currentLessonStep.correct
                                ? 'border-green-500 bg-green-50 text-green-800'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                            }`}
                            whileHover={selectedAnswer === null ? { scale: 1.02 } : {}}
                            whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                                selectedAnswer === null
                                  ? 'bg-gray-100 text-gray-700'
                                  : selectedAnswer === index
                                  ? index === currentLessonStep.correct
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : index === currentLessonStep.correct
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {selectedAnswer !== null && index === currentLessonStep.correct ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  String.fromCharCode(65 + index)
                                )}
                              </div>
                              <span className="text-lg">{option}</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence>
                      {showExplanation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-blue-50 rounded-2xl p-6 mb-6"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <Lightbulb className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <h5 className="font-semibold text-blue-900 mb-2">Explanation</h5>
                              <p className="text-blue-800 leading-relaxed">{currentLessonStep.explanation}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {showExplanation && (
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="flex items-center space-x-2 text-teal-600">
                            <div className="text-2xl">🎉</div>
                            <span className="font-semibold">+75 XP Earned!</span>
                          </div>
                          <button
                            onClick={goToNextLesson}
                            className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                          >
                            Try Another Lesson
                          </button>
                          <button
                            onClick={resetLesson}
                            className="px-6 py-2 rounded-xl font-semibold border border-teal-200 text-teal-600 hover:bg-teal-50 transition-all duration-300"
                          >
                            Replay This Lesson
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* AI Assistant Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-12 bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-8"
          >
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-pink-600 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">AI Learning Assistant</h4>
                <p className="text-gray-600">Always ready to help when you're stuck</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                  <Brain className="h-4 w-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 leading-relaxed">
                    {`"Great job exploring ${currentLesson.focus.toLowerCase()}! I can tee up a tougher challenge or revisit the fundamentals whenever you're ready."`}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LessonPreview;
