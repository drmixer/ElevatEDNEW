import React from 'react';
import { UserPlus, Brain, BookOpen, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const connectorOffset = '3.25rem';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: UserPlus,
      title: 'Create Your Account',
      description: 'Set up your profile as a student or parent. Link family accounts to share progress and insights.',
    },
    {
      icon: Brain,
      title: 'Discover Learning Gaps',
      description: 'Complete our precision assessment to identify exactly where you need to focus your learning efforts.',
    },
    {
      icon: BookOpen,
      title: 'Learn Your Way',
      description: 'Engage with personalized lessons that adapt to your learning style and pace, ensuring steady progress.',
    },
    {
      icon: TrendingUp,
      title: 'See Real Growth',
      description: 'Track meaningful progress through detailed reports and celebrate achievements that matter.',
    }
  ];

  return (
    <section id="how-it-works" className="relative isolate overflow-hidden py-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f6f5ff] to-white" />
        <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40 mix-blend-soft-light" />
        <div className="pointer-events-none absolute inset-0 bg-noise-soft opacity-[0.35] mix-blend-overlay" />
        <div className="pointer-events-none absolute -left-[18%] top-[6%] h-[24rem] w-[24rem] shape-square-soft rotate-[-6deg]" />
        <div className="pointer-events-none absolute right-[-10%] bottom-[-14%] h-[26rem] w-[26rem] shape-triangle-soft rotate-[24deg]" />
        <div className="pointer-events-none absolute left-[58%] top-[34%] h-[17rem] w-[17rem] -translate-x-1/2 shape-circle-soft" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How ElevatED Works</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Three simple steps to unlock your child's learning potential
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {steps.map((step, index) => (
            <div key={step.title}
              className="text-center relative"
            >
              <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg relative z-10">
                <step.icon className="h-10 w-10 text-white" />
              </div>
              <h3 className="mb-4 text-xl font-bold text-gray-900">{step.title}</h3>
              <p className="text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Transform Learning?</h3>
            <p className="text-gray-600 mb-6">Join thousands of students and parents already using ElevatED</p>
            <button className="bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              Start Your Free Trial
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
