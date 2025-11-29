import React from 'react';
import { ArrowRight, Brain, Play, Star, Trophy, TrendingUp, Users } from 'lucide-react';
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

  const highlights = [
    {
      icon: Brain,
      title: 'Adaptive mastery at home',
      description: 'AI tailors every lesson, hint, and challenge to each child\'s pace.'
    },
    {
      icon: TrendingUp,
      title: 'Family clarity',
      description: 'Dashboards speak to parents in plain language with weekly digests.'
    },
    {
      icon: Trophy,
      title: 'Joyful motivation',
      description: 'Game loops, streaks, and story-driven rewards make momentum stick.'
    }
  ];

  return (
    <section id="top" className="relative isolate overflow-hidden bg-brand-canvas">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-brand-canvas" />
        <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40 mix-blend-soft-light" />
        <div className="pointer-events-none absolute inset-0 bg-noise-soft opacity-[0.35] mix-blend-overlay" />

        <div className="pointer-events-none absolute -left-[18%] top-[-14%] h-[30rem] w-[30rem] shape-circle-soft blur-[2px]" />
        <div className="pointer-events-none absolute right-[-12%] top-[12%] h-[26rem] w-[26rem] shape-triangle-soft rotate-[18deg]" />
        <div className="pointer-events-none absolute left-[58%] bottom-[-20%] h-[22rem] w-[22rem] -translate-x-1/2 shape-square-soft" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white via-white/80 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:items-center">
          <motion.div
            className="relative z-10 space-y-8 lg:col-span-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-brand-secondary/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              Home Learning • Family-First
          </div>

          <h1 className="text-5xl font-semibold text-slate-900 sm:text-6xl lg:text-7xl">
              Home learning, elevated.
              <span className="flex bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent bg-clip-text text-transparent">
                AI tutoring built for every K-12 learner.
              </span>
          </h1>

          <p className="text-lg leading-relaxed text-slate-700 sm:text-xl">
              ElevatED is for students and parents at home, not schools or teachers. Adaptive AI instruction meets
              family-ready insights so students accelerate with confidence while parents get calm, clear updates.
              Launch personalized journeys that feel handcrafted, with dashboards that keep everyone in the loop.
          </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch">
              <button
                onClick={onGetStarted}
                className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent px-8 py-4 text-lg font-semibold text-white shadow-[0_28px_45px_rgba(137,23,237,0.25)] transition-transform hover:-translate-y-1 sm:w-auto focus-ring"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative flex items-center gap-3">
                  Start Learning Today
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
              <button
                onClick={scrollToDemo}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-brand-primary/20 bg-white/80 px-8 py-4 text-lg font-semibold text-brand-dark/90 shadow-[0_20px_35px_rgba(15,40,80,0.08)] backdrop-blur transition-all hover:border-brand-primary/40 hover:text-brand-primary sm:w-auto focus-ring"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/30 bg-brand-soft text-brand-primary transition-colors group-hover:border-brand-primary/50 group-hover:bg-brand-soft/90">
                  <Play className="h-5 w-5" />
                </div>
                Watch Guided Tour
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-slate-500">
              <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
                <Star className="h-4 w-4 text-amber-400 drop-shadow" />
                4.9/5 from 2,800+ families
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
                <Users className="h-4 w-4 text-brand-secondary drop-shadow" />
                50,000+ students thriving
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
                <TrendingUp className="h-4 w-4 text-brand-success drop-shadow" />
                Avg. +38% mastery lifts
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur lg:max-w-xl">
              {highlights.map((item, index) => (
                <motion.div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm transition-transform hover:-translate-y-1"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.4 }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-secondary via-brand-primary to-brand-accent text-white">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="relative lg:col-span-6">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-brand-primary/40 to-brand-secondary/40 blur-2xl" />
            <div className="absolute bottom-10 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-brand-accent/50 to-brand-primary/30 blur-2xl" />
            <div className="absolute -right-16 top-16 hidden h-40 w-40 rotate-12 rounded-3xl border border-white/40 bg-white/40 backdrop-blur lg:block" />

            <motion.div
              className="relative mx-auto mt-6 max-w-xl rounded-[36px] border border-white/70 bg-white/90 p-8 shadow-[0_40px_70px_rgba(15,40,80,0.18)] backdrop-blur-xl"
              initial={{ opacity: 0, scale: 0.92, y: 60 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Today</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">Mission Progress</h3>
                  <p className="text-sm text-slate-500">AI recalibrated 3 lessons to match Amira&apos;s pace.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white shadow-lg">
                  <Star className="h-4 w-4 text-amber-300" />
                  +32 XP
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Focus</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">92%</p>
                  <p className="text-xs text-brand-success">+14% this week</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mastery</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">18</p>
                  <p className="text-xs text-brand-secondary">Concepts unlocked</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confidence</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">A+</p>
                  <p className="text-xs text-indigo-500">Rising steadily</p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-900/80 p-6 text-white shadow-inner">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">Live Tutoring</p>
                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-brand-accent" />
                    Active
                  </div>
                </div>
                <p className="mt-3 text-lg font-semibold">&ldquo;Let&apos;s break this fraction into friendlier steps.&rdquo;</p>
                <p className="mt-2 text-sm text-white/70">ElevatED AI • Focused on 5th Grade Math</p>
              </div>
            </motion.div>

            <motion.div
              className="absolute -left-8 top-16 hidden w-56 rounded-3xl border border-white/70 bg-white/90 p-5 shadow-xl backdrop-blur lg:block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              whileHover={{ y: -6 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-secondary via-brand-primary to-brand-accent text-white">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Parent Insights</p>
                  <p className="text-xs text-slate-500">Weekly AI digest ready</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-500">
                <p>- Focus growth in Math is 1.4x faster than peers.</p>
                <p>- Recommend: Celebrate streak day 15 tonight.</p>
              </div>
            </motion.div>

            <motion.div
              className="absolute -right-6 bottom-6 hidden w-56 rounded-3xl border border-white/70 bg-white/90 p-5 shadow-xl backdrop-blur lg:block"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6 }}
              whileHover={{ y: -6 }}
            >
              <div className="flex items-center justify-between text-xs">
                <p className="font-semibold uppercase tracking-[0.25em] text-slate-400">Streak</p>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-brand-primary">Day 15</span>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">+12</p>
              <p className="text-xs text-slate-500">New badges unlocked this month</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-brand-secondary">
                <Star className="h-4 w-4 text-amber-400" />
                Keep the momentum tomorrow to double XP.
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
