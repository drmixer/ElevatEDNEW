import React from 'react';
import { Check, Star, Users, BookOpen, Brain, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricingProps {
  onGetStarted: () => void;
}

const Pricing: React.FC<PricingProps> = ({ onGetStarted }) => {
  const plans = [
    {
      name: 'Free Plan',
      subtitle: 'Core Learning',
      price: '$0',
      period: 'month',
      students: '1 student',
      description: 'Everything you need to start',
      icon: BookOpen,
      features: [
        'Access to all 4 subjects (K–12)',
        'Adaptive diagnostic assessment',
        'Personalized daily lesson plan (1 lesson per subject/day)',
        'Short mixed quizzes with instant feedback',
        'Basic parent dashboard (view recent activity & quiz score)',
        'Basic gamification: XP, streaks, up to 3 badges',
        'AI chatbot: 3 questions per week'
      ],
      perfectFor: 'Perfect for trying out ElevatED and establishing a daily learning routine',
      buttonText: 'Start Free',
      buttonStyle: 'bg-gray-600 hover:bg-gray-700',
      popular: false
    },
    {
      name: 'Pro Plan',
      subtitle: 'Accelerated Growth',
      price: '$15',
      period: 'month per student',
      yearlyPrice: '$144/year – 2 months free',
      students: 'Per student',
      description: 'Includes everything in Free, plus',
      icon: Brain,
      features: [
        'Unlimited daily lessons & quizzes',
        'Unlimited AI chatbot support',
        'Real-time adaptive difficulty adjustments by concept',
        'Quiz explanations and concept insights',
        'Full badge and avatar customization',
        'Weekly AI-generated performance report for parents',
        'AI-driven study tips and review recommendations',
        'Parent alerts for missed lessons or low scores',
        'Lesson scheduling and priority support'
      ],
      perfectFor: 'Families ready to commit to steady academic advancement',
      buttonText: 'Start Pro Plan',
      buttonStyle: 'bg-gradient-to-r from-teal-500 to-blue-600 hover:shadow-lg transform hover:scale-105',
      popular: true,
      gradient: 'from-teal-500 to-blue-600'
    },
    {
      name: 'Family Plan',
      subtitle: 'Learning Together',
      price: '$15',
      period: 'month for first student',
      additionalPrice: '+ $8/month for each additional',
      yearlyPrice: '$144/year + $69/year per extra student',
      students: 'Multiple children',
      description: 'Everything in Pro, plus',
      icon: Users,
      features: [
        'Unified family dashboard',
        'Side-by-side progress comparisons',
        'Parent-defined challenges (e.g., "Complete 10 lessons this week")',
        'Multi-child AI performance summary',
        'Family billing with volume discounts'
      ],
      perfectFor: 'Households with 2+ kids who want shared learning oversight',
      buttonText: 'Start Family Plan',
      buttonStyle: 'bg-gradient-to-r from-violet-500 to-pink-600 hover:shadow-lg transform hover:scale-105',
      popular: false,
      gradient: 'from-violet-500 to-pink-600'
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Choose Your Learning Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Flexible pricing designed to grow with your learning needs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
                plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center space-x-2">
                    <Star className="h-4 w-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <plan.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-2xl">📘</span>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  </div>
                  <p className="text-lg font-semibold text-gray-700 mb-4">{plan.subtitle}</p>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center mb-2">
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-600 ml-1">/{plan.period}</span>
                    </div>
                    {plan.yearlyPrice && (
                      <p className="text-sm text-green-600 font-medium">({plan.yearlyPrice})</p>
                    )}
                    {plan.additionalPrice && (
                      <p className="text-sm text-gray-600 mt-1">{plan.additionalPrice}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">{plan.students}</p>
                  </div>
                  
                  <p className="text-gray-600 font-medium">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="mb-8">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Perfect For */}
                <div className="mb-8 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900">Perfect for:</span>
                  </div>
                  <p className="text-sm text-gray-600">{plan.perfectFor}</p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={onGetStarted}
                  className={`w-full text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${plan.buttonStyle}`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-16">
          <div className="bg-white rounded-2xl p-8 shadow-lg max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Why Choose ElevatED?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">AI-Powered Adaptation</h4>
                <p className="text-sm text-gray-600">Content adjusts in real-time to each student's learning pace and style</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Family-Focused</h4>
                <p className="text-sm text-gray-600">Comprehensive parent insights and multi-child management</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-violet-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Proven Results</h4>
                <p className="text-sm text-gray-600">98% of students show measurable improvement within 30 days</p>
              </div>
            </div>
            <div className="mt-8 p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl">
              <p className="text-sm text-gray-600">
                <strong>Money-back guarantee:</strong> Not satisfied within 30 days? Get a full refund, no questions asked.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
