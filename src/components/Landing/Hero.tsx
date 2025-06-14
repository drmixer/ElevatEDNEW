import React from 'react';
import { ArrowRight, BookOpen, Brain, Users, Trophy, Play, Star, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroProps {
  onGetStarted: () => void;
}

const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  const scrollToDemo = () => {
    const element = document.querySelector('#dashboard-preview');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20">
        {/* Main Hero Content */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              Smart Learning.
              <br />
              <span className="bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent">
                Elevated Results.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Transform education with adaptive assessments, intelligent tutoring, and real-time progress tracking. 
              Personalized learning paths that grow with every student.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <button
              onClick={onGetStarted}
              className="group bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center"
            >
              Start Learning Today
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={scrollToDemo}
              className="group flex items-center space-x-2 px-8 py-4 rounded-2xl font-semibold text-lg text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Play className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Try Demo</span>
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-gray-500"
          >
            Free tier available • No credit card required • Start in 2 minutes
          </motion.p>
        </div>

        {/* Hero Stats */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16"
        >
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent mb-2">
              50,000+
            </div>
            <div className="text-gray-600 font-medium">Students Learning</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent mb-2">
              1M+
            </div>
            <div className="text-gray-600 font-medium">Lessons Completed</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent mb-2">
              98%
            </div>
            <div className="text-gray-600 font-medium">Improvement Rate</div>
          </div>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl max-w-5xl mx-auto"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Trusted by Families Worldwide</h3>
            <div className="flex justify-center items-center space-x-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
              ))}
              <span className="text-lg font-semibold text-gray-700 ml-2">4.9/5</span>
              <span className="text-gray-500">(2,847 reviews)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <blockquote className="text-gray-700 italic mb-3">
                "Emma's math scores improved by 40% in just 3 months. The adaptive learning really works!"
              </blockquote>
              <cite className="text-sm font-semibold text-gray-900">- Sarah M., Parent</cite>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <blockquote className="text-gray-700 italic mb-3">
                "The AI tutor explains things in a way my son actually understands. He loves learning now!"
              </blockquote>
              <cite className="text-sm font-semibold text-gray-900">- Michael R., Parent</cite>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <blockquote className="text-gray-700 italic mb-3">
                "My daughter is actually excited about homework now. The gamification is brilliant!"
              </blockquote>
              <cite className="text-sm font-semibold text-gray-900">- Lisa K., Parent</cite>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Hero;