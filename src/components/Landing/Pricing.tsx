import React from 'react';
import { Check, Star, Users, BookOpen, Brain, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricingProps {
  onGetStarted: () => void;
}

const Pricing: React.FC<PricingProps> = ({ onGetStarted }) => {
  const plans = [
    {
      name: 'Family Free',
      subtitle: 'Core Learning',
      price: '$0',
      period: 'month',
      students: '1 learner',
      description: 'Everything you need to start',
      icon: BookOpen,
      valueHook: 'Start building daily learning habits for free.',
      features: [
        'Access to core K-12 subjects',
        'Guided diagnostic assessment',
        'Up to 10 lessons per month',
        'Mixed quizzes with instant feedback',
        'Basic parent dashboard (recent activity & quiz score)',
        'Basic gamification: XP, streaks, badges',
        'AI chatbot: quick tips (limited access)'
      ],
      perfectFor: 'Exploring the platform and building daily learning habits',
      buttonText: 'Start Free',
      buttonStyle: 'bg-gray-600 hover:bg-gray-700',
      popular: false,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      name: 'Family Plus',
      subtitle: 'Accelerated Growth',
      price: '$29.99',
      period: 'month per student',
      yearlyPrice: '$299/year (save 17%)',
      students: 'Up to 3 learners',
      description: 'Includes everything in Free, plus',
      icon: Brain,
      valueHook: 'Personalized K-12 tutoring with weekly progress reports.',
      features: [
        'Unlimited adaptive lessons across every subject',
        'Always-on AI learning assistant with follow-up questions',
        'Concept-level insights plus guided step-by-step solutions',
        'Deep-dive parent dashboard with weekly AI progress summaries',
        'Achievement hub with full badge, streak, and avatar customization',
        'Smart study tips, review refreshers, and weekend boosts',
        'Parent alerts for missed lessons or flagged concepts',
        'Priority support and early access to new features'
      ],
      perfectFor: 'Families ready to commit to steady academic advancement',
      buttonText: 'Start 7-day Free Trial',
      buttonStyle: 'bg-gradient-to-r from-teal-500 to-blue-600 hover:shadow-lg transform hover:scale-105',
      popular: true,
      gradient: 'from-teal-500 to-blue-600'
    },
    {
      name: 'Family Premium',
      subtitle: 'Learning Together',
      price: '$49.99',
      period: 'month for the family',
      additionalPrice: 'Includes up to 5 learners',
      yearlyPrice: '$499/year (save 17%)',
      students: 'Multiple children',
      description: 'Everything in Pro, plus',
      icon: Users,
      valueHook: 'Shared family dashboard with sibling discounts built in.',
      features: [
        'Unified family dashboard with side-by-side progress',
        'Shared challenges and family learning quests',
        'Multi-student AI performance summaries each week',
        'Parent controls for goals, rewards, and screen time',
        'Flexible billing with discounted add-on seats'
      ],
      perfectFor: 'Households with 2+ kids who want shared learning oversight',
      buttonText: 'Start Family Trial',
      buttonStyle: 'bg-gradient-to-r from-violet-500 to-pink-600 hover:shadow-lg transform hover:scale-105',
      popular: false,
      gradient: 'from-violet-500 to-pink-600'
    }
  ];

  const comparisonRows = [
    {
      label: 'Monthly price',
      free: '$0',
      pro: '$29.99',
      family: '$49.99'
    },
    {
      label: 'Annual price',
      free: '$0',
      pro: '$299',
      family: '$499'
    },
    {
      label: 'Adaptive lessons',
      free: 'Daily lesson plan',
      pro: 'Unlimited',
      family: 'Unlimited for every student'
    },
    {
      label: 'AI assistant',
      free: '3 questions/week',
      pro: 'Unlimited threads',
      family: 'Unlimited threads & shared history'
    },
    {
      label: 'Parent insights',
      free: 'Recent activity snapshot',
      pro: 'Full reports & alerts',
      family: 'All Pro insights plus multi-student summaries'
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
                <th className="px-6 py-4">Pro</th>
                <th className="px-6 py-4">Family</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, rowIndex) => (
                <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-6 py-4 font-semibold text-gray-900">{row.label}</td>
                  <td className="px-6 py-4">{row.free}</td>
                  <td className="px-6 py-4">{row.pro}</td>
                  <td className="px-6 py-4">{row.family}</td>
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
