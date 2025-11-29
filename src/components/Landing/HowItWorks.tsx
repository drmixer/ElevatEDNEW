import React from 'react';
import { UserPlus, Brain, BookOpen, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const connectorOffset = '3.25rem';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: UserPlus,
      title: 'Create Your Family Space',
      description: 'Parents invite learners and set simple goals. Students join with their own login so privacy and progress stay separate.',
      color: 'from-brand-secondary to-brand-primary'
    },
    {
      icon: Brain,
      title: 'Meet the AI Tutor',
      description: 'Learners take a short adaptive check-in so the tutor can set the right starting point across subjects.',
      color: 'from-brand-primary to-brand-tertiary'
    },
    {
      icon: BookOpen,
      title: 'Follow Personalized Paths',
      description: 'Daily lessons adapt automatically. Students get hints, practice, and encouragement without needing a classroom teacher.',
      color: 'from-brand-primary to-brand-accent'
    },
    {
      icon: TrendingUp,
      title: 'Parents Stay in the Loop',
      description: 'Weekly summaries, clear alerts, and side-by-side sibling views keep parents informed without jargon.',
      color: 'from-brand-accent to-brand-secondary'
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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent bg-clip-text text-transparent mb-6">
            How ElevatED Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A home-learning flow that makes sense for families and keeps students moving forward
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div
            className="pointer-events-none hidden lg:block absolute left-[4%] right-[4%] h-px rounded-full bg-gradient-to-r from-brand-secondary via-brand-primary via-brand-accent to-brand-success opacity-80"
            style={{ bottom: connectorOffset }}
          />

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 pb-16">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative flex h-full flex-col items-center rounded-3xl border border-white/60 bg-white/70 p-6 text-center shadow-[0_24px_50px_rgba(20,60,120,0.08)] backdrop-blur"
              >
                <div className={`relative z-10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${step.color} shadow-[0_18px_38px_rgba(58,120,189,0.25)]`}>
                  <step.icon className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
                <div
                  className="pointer-events-none absolute hidden h-4 w-4 -translate-x-1/2 rounded-full border-[6px] border-white bg-brand-soft shadow-md lg:block"
                  style={{ bottom: `calc(${connectorOffset} - 0.5rem)`, left: '50%' }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-brand-soft to-[#FCEFD3] rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Transform Learning?</h3>
            <p className="text-gray-600 mb-6">Join thousands of students and parents already using ElevatED</p>
            <button className="bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              Start Your Free Trial
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
