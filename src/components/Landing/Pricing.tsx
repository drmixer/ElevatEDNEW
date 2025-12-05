import React from 'react';
import { Check, Star, Users, BookOpen, Brain, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricingProps {
  onGetStarted: () => void;
}

const Pricing: React.FC<PricingProps> = ({ onGetStarted }) => {
  const plans = [
    {
      name: 'Free',
      subtitle: 'Start your smarter learning journey',
      price: '$0',
      period: 'month',
      students: '1 student included',
      description: 'Everything you need to start',
      icon: BookOpen,
      valueHook: 'Try diagnostics, a personalized path, and core progress tracking.',
      features: [
        'Adaptive diagnostic + personalized path',
        'Up to 10 lessons/assignments per month',
        'AI tutor: 3 chats per day',
        'Basic progress view (last 30 days)',
        'Weekly digest email (optional)',
        'XP, streaks, badges to build habits'
      ],
      perfectFor: 'Exploring ElevatED and building daily learning habits',
      buttonText: 'Start Free',
      buttonStyle: 'bg-gray-600 hover:bg-gray-700',
      popular: false,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      name: 'Plus',
      subtitle: 'Unlock deeper insights and personalized progress',
      price: '$6.99',
      period: 'month (first student)',
      additionalPrice: 'Each additional student $5.59 (20% off), up to 4 seats',
      students: '1 included (up to 4 seats)',
      description: 'Everything in Free, plus',
      icon: Brain,
      valueHook: 'More headroom, analytics, and weekly AI summaries.',
      features: [
        'Up to ~100 lessons/assignments per month',
        'AI tutor: high daily cap (fair use)',
        'Advanced analytics + weekly AI summaries',
        'Parent alerts and saved practice sets',
        'Exports/PDF reports for progress reviews'
      ],
      perfectFor: 'Families ready for consistent progress and richer insights',
      buttonText: 'Upgrade to Plus',
      buttonStyle: 'bg-gradient-to-r from-teal-500 to-blue-600 hover:shadow-lg transform hover:scale-105',
      popular: true,
      gradient: 'from-teal-500 to-blue-600'
    },
    {
      name: 'Pro',
      subtitle: 'Full power for serious results',
      price: '$9.99',
      period: 'month (first student)',
      additionalPrice: 'Each additional student $7.99 (20% off), up to 6 seats',
      students: '1 included (up to 6 seats)',
      description: 'Everything in Plus, plus',
      icon: Users,
      valueHook: 'Unlimited learning, priority support, and deepest insights.',
      features: [
        'Unlimited lessons/assignments',
        'AI tutor: effectively unlimited (with fair-use guardrails)',
        'Priority support and faster responses',
        'Full exports/CSV and deeper analytics history',
        'Automation: weekly study plan refresh and upcoming content first'
      ],
      perfectFor: 'Households with serious goals or multiple active learners',
      buttonText: 'Go Pro',
      buttonStyle: 'bg-gradient-to-r from-violet-500 to-pink-600 hover:shadow-lg transform hover:scale-105',
      popular: false,
      gradient: 'from-violet-500 to-pink-600'
    }
  ];

  const comparisonRows = [
    {
      label: 'Monthly price',
      free: '$0',
      plus: '$6.99 (first student)',
      pro: '$9.99 (first student)'
    },
    {
      label: 'Additional students',
      free: 'Not available',
      plus: '$5.59 each (20% off, up to 4)',
      pro: '$7.99 each (20% off, up to 6)'
    },
    {
      label: 'Lesson/assignment limit',
      free: '10 per month',
      plus: '~100 per month',
      pro: 'Unlimited'
    },
    {
      label: 'AI tutor',
      free: '3 chats/day',
      plus: 'High cap (≈30/day)',
      pro: 'Effectively unlimited (fair use)'
    },
    {
      label: 'Analytics & summaries',
      free: 'Basic progress (30 days)',
      plus: 'Advanced analytics + weekly AI summaries',
      pro: 'Full analytics history + exports'
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Choose Your Learning Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Flexible pricing designed to grow with your learning needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
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
                  <div className={`w-16 h-16 bg-gradient-to-r ${plan.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
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
                  {plan.valueHook && (
                    <p className="mt-3 text-sm text-gray-700">{plan.valueHook}</p>
                  )}
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
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 max-w-5xl mx-auto overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-lg"
        >
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100 uppercase text-xs font-semibold tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-4">Plan Snapshot</th>
                <th className="px-6 py-4">Free</th>
                <th className="px-6 py-4">Plus</th>
                <th className="px-6 py-4">Pro</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, rowIndex) => (
                <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-6 py-4 font-semibold text-gray-900">{row.label}</td>
                  <td className="px-6 py-4">{row.free}</td>
                  <td className="px-6 py-4">{row.plus}</td>
                  <td className="px-6 py-4">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-16"
        >
          <div className="bg-white rounded-2xl p-8 shadow-lg max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">What You Get</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Adaptive Lessons</h4>
                <p className="text-sm text-gray-600">Every activity adjusts in real time to keep students challenged but confident.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Live Feedback</h4>
                <p className="text-sm text-gray-600">Students get instant hints, chat support, and step-by-step explanations.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-violet-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Parent Dashboard</h4>
                <p className="text-sm text-gray-600">Track progress, set goals, and celebrate wins from a single family view.</p>
              </div>
            </div>
            <div className="mt-8 p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl">
              <p className="text-sm text-gray-600">
                <strong>Money-back guarantee:</strong> Not satisfied within 30 days? Get a full refund, no questions asked.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
