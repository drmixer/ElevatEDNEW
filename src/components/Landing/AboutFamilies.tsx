import React from 'react';
import { HeartHandshake, Sparkles, ShieldCheck, Compass, Clock3, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

const AboutFamilies: React.FC = () => {
  const timeline = [
    {
      icon: HeartHandshake,
      title: 'Parents create the space',
      description:
        'Invite each learner, set weekly goals, and choose the right guardrails. No school setup or classroom rosters required.',
      accent: 'from-brand-secondary to-brand-primary',
    },
    {
      icon: Compass,
      title: 'Students meet their tutor',
      description:
        'A quick adaptive check-in sets the starting point. The AI tutor adjusts reading level, pacing, and hints instantly.',
      accent: 'from-brand-primary to-brand-accent',
    },
    {
      icon: Sparkles,
      title: 'Daily learning at home',
      description:
        'Learners work through personalized lessons, streaks, and challenges that feel like a game, not homework assigned by a teacher.',
      accent: 'from-brand-accent to-brand-secondary',
    },
    {
      icon: Clock3,
      title: 'Parents stay informed',
      description:
        'Weekly digests, clear alerts, and side-by-side sibling views keep families aligned without jargon or school dashboards.',
      accent: 'from-brand-secondary to-brand-primary',
    },
    {
      icon: GraduationCap,
      title: 'Celebrate growth together',
      description:
        'Badges, milestones, and goal streaks give you moments to celebrate at the dinner table. Progress is explained in plain language.',
      accent: 'from-brand-primary to-brand-tertiary',
    },
  ];

  return (
    <section id="about-families" className="py-24 bg-gradient-to-b from-white via-[#f7faff] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl text-center mx-auto"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-secondary mb-4">
            About for Families
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            The parent + student journey, end to end
          </h2>
          <p className="text-lg text-slate-600">
            ElevatED is for students and parents at home, not school teachers. The flow is intentionally simple so
            families can start in minutes and keep learning momentum without classroom software in the way.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {timeline.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_45px_rgba(20,60,120,0.08)] backdrop-blur"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} text-white shadow-lg`}>
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              <span className="absolute right-4 top-4 text-xs font-semibold text-slate-400">Step {index + 1}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Clearly separated admin workspace</p>
              <p className="text-sm text-slate-600">
                Bulk imports and advanced controls live at <code className="px-1">/workspace/admin</code> so the family
                app stays focused on home learning.
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-700">
            Built for households: no teacher accounts, no district provisioning, just students and parents at home.
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutFamilies;
