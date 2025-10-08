import React, { useState } from 'react';
import { Play, CheckCircle, ArrowRight, Brain, Lightbulb, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LessonPreview: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const lessonSteps = [
    {
      type: 'intro',
      title: 'Multiplication Basics',
      subtitle: 'Understanding Products',
      content: 'Today we\'ll learn the fundamentals of multiplication. It\'s a key skill for everyday math!',
      icon: Brain
    },
    {
      type: 'concept',
      title: 'Multiplication as Repeated Addition',
      subtitle: 'A simple way to think about it',
      content: 'Multiplication is a quick way to do repeated addition. For example, 3 × 4 means adding 3 four times: 3 + 3 + 3 + 3 = 12.',
      explanation: 'This concept helps us understand why multiplication works and makes it easier to solve problems.',
      icon: Lightbulb
    },
    {
      type: 'practice',
      title: 'Practice Problem',
      subtitle: 'Let\'s apply what we learned',
      question: 'What is 7 × 8?',
      options: [
        '54',
        '56',
        '63',
        '72'
      ],
      correct: 1,
      explanation: '7 × 8 means adding 7 eight times, or adding 8 seven times. Both result in 56.',
      icon: Target
    }
  ];

  const currentLesson = lessonSteps[currentStep];

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex.toString());
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Math • Grade 3</h3>
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
                  <currentLesson.icon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">{currentLesson.title}</h3>
                  <p className="opacity-90">{currentLesson.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {currentLesson.type === 'intro' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <div className="text-6xl mb-6">✖️</div>
                    <p className="text-xl text-gray-700 leading-relaxed mb-8">
                      {currentLesson.content}
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

                {currentLesson.type === 'concept' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-8 mb-8">
                      <div className="text-center mb-6">
                        <div className="text-3xl font-mono bg-white rounded-xl p-4 inline-block shadow-lg">
                          3 × 4 = 3 + 3 + 3 + 3 = 12
                        </div>
                      </div>
                      <p className="text-lg text-gray-700 leading-relaxed text-center">
                        {currentLesson.explanation}
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

                {currentLesson.type === 'practice' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="mb-8">
                      <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                        {currentLesson.question}
                      </h4>
                      <div className="space-y-4">
                        {currentLesson.options?.map((option, index) => (
                          <motion.button
                            key={index}
                            onClick={() => handleAnswerSelect(index)}
                            disabled={selectedAnswer !== null}
                            className={`w-full p-4 text-left border-2 rounded-xl transition-all duration-300 ${
                              selectedAnswer === null
                                ? 'border-gray-200 hover:border-teal-500 hover:bg-teal-50'
                                : selectedAnswer === index.toString()
                                ? index === currentLesson.correct
                                  ? 'border-green-500 bg-green-50 text-green-800'
                                  : 'border-red-500 bg-red-50 text-red-800'
                                : index === currentLesson.correct
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
                                  : selectedAnswer === index.toString()
                                  ? index === currentLesson.correct
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : index === currentLesson.correct
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {selectedAnswer !== null && index === currentLesson.correct ? (
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
                              <p className="text-blue-800 leading-relaxed">{currentLesson.explanation}</p>
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
                            onClick={resetLesson}
                            className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                          >
                            Try Another Lesson
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
                    "Great job on that multiplication problem! I noticed you're getting stronger with basic multiplication facts. 
                    Would you like to try some more challenging problems, or shall we review the times tables to build your speed?"
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