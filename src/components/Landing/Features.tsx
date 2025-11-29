import React from 'react';
import { Brain, Target, Users, Trophy, BarChart3, MessageCircle, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Features: React.FC = () => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Adaptive Learning',
      description: 'Intelligent algorithms adjust difficulty in real-time based on student performance, ensuring optimal challenge levels.',
      gradient: 'from-brand-secondary to-brand-primary'
    },
    {
      icon: Target,
      title: 'Diagnostic Assessments',
      description: 'Comprehensive evaluations across Math, English, Science, and Social Studies to create personalized learning paths.',
      gradient: 'from-brand-primary to-brand-tertiary'
    },
    {
      icon: Users,
      title: 'Parent Dashboard',
      description: 'Real-time progress tracking, performance insights, and weekly AI-generated summaries for complete visibility.',
      gradient: 'from-brand-primary to-brand-accent'
    },
    {
      icon: Trophy,
      title: 'Gamified Experience',
      description: 'XP points, achievement badges, streak counters, and level progression keep students motivated and engaged.',
      gradient: 'from-brand-accent to-brand-secondary'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Detailed performance metrics, concept mastery tracking, and learning trend analysis for data-driven insights.',
      gradient: 'from-brand-secondary to-brand-primary'
    },
    {
      icon: MessageCircle,
      title: 'AI Learning Assistant',
      description: 'Context-aware tutoring bot that provides step-by-step guidance, study tips, and personalized motivation.',
      gradient: 'from-brand-primary to-brand-tertiary'
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Curriculum',
      description: 'K-12 content across core subjects with adaptive difficulty and concept-specific reinforcement.',
      gradient: 'from-brand-primary to-brand-accent'
    },
    {
      icon: Zap,
      title: 'Instant Feedback',
      description: 'Immediate quiz results, detailed explanations, and smart suggestions for review or advancement.',
      gradient: 'from-brand-accent to-brand-secondary'
    }
  ];

  return (
    <section id="features" className="relative isolate overflow-hidden bg-brand-canvas py-28">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-brand-canvas" />
        <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-[0.35] mix-blend-soft-light" />
        <div className="pointer-events-none absolute inset-0 bg-noise-soft opacity-[0.35] mix-blend-overlay" />

        <div className="pointer-events-none absolute -left-[20%] top-[-16%] h-[28rem] w-[28rem] shape-triangle-soft rotate-[-12deg]" />
        <div className="pointer-events-none absolute right-[-12%] bottom-[-18%] h-[26rem] w-[26rem] shape-circle-soft blur-[2px]" />
        <div className="pointer-events-none absolute left-[55%] top-[16%] h-[18rem] w-[18rem] -translate-x-1/2 shape-square-soft rotate-[8deg]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent bg-clip-text text-transparent mb-6">
            Built for Families Learning at Home
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything students and parents need to keep home learning personal, clear, and motivating
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_22px_45px_rgba(15,40,80,0.08)] backdrop-blur transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_32px_65px_rgba(20,60,120,0.16)]"
            >
              <div className="absolute inset-0 opacity-0 transition-all duration-500 group-hover:opacity-100">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-20`} />
              </div>
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg transition-transform duration-500 group-hover:scale-110`}>
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="relative mt-6 text-xl font-semibold text-slate-900">{feature.title}</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              <span className="relative mt-6 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 transition-transform duration-500 group-hover:translate-x-1">
                <span>Learn more</span>
                <span aria-hidden="true">&rarr;</span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
