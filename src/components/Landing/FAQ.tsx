import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How does the adaptive learning system work?',
      answer: 'Our AI engine analyzes student responses in real-time and adjusts difficulty per concept. If a student struggles with multiplication but excels at addition, the system provides more multiplication practice while advancing their addition skills. This ensures optimal challenge levels for maximum learning efficiency.'
    },
    {
      question: 'What subjects and grade levels are covered?',
      answer: 'ElevatED covers Math, English, Science, and Social Studies for grades K-12. Content is sourced from high-quality Open Educational Resources and enhanced with AI to match reading levels and learning styles. Each subject includes hundreds of concepts with adaptive difficulty scaling.'
    },
    {
      question: 'How long does the diagnostic assessment take?',
      answer: 'The initial diagnostic typically takes 15-20 minutes and adapts based on student responses. Students can pause and resume anytime. The assessment covers all core subjects and creates a personalized learning profile. Students can also skip the diagnostic to start at their grade level.'
    },
    {
      question: 'What can parents see in their dashboard?',
      answer: 'Parents get comprehensive insights including progress by subject and concept, time spent learning, quiz performance, strengths and weaknesses analysis, weekly AI-generated summaries, and customizable alerts for missed sessions or concerning performance patterns.'
    },
    {
      question: 'Is there a free version available?',
      answer: 'Yes! Our free tier includes limited daily lessons, access to core subjects, basic progress tracking, and grade-level content. Premium unlocks unlimited lessons, AI tutoring, diagnostic assessments, detailed parent reports, and advanced gamification features.'
    },
    {
      question: 'How does the AI learning assistant help students?',
      answer: 'The AI assistant is context-aware of each student\'s progress, current lessons, and performance patterns. It provides step-by-step problem solving, study tips, motivational support, concept explanations, and personalized guidance based on individual learning needs.'
    },
    {
      question: 'Can multiple children use one parent account?',
      answer: 'Absolutely! Parents can manage multiple student accounts under one dashboard. The Family plan supports up to 5 students with individual progress tracking, comparative analytics, and bulk reporting features. Additional students can be added at discounted rates.'
    },
    {
      question: 'What devices and browsers are supported?',
      answer: 'ElevatED works on all modern devices including computers, tablets, and smartphones. We support Chrome, Firefox, Safari, and Edge browsers. The platform is fully responsive and optimized for touch interfaces on mobile devices.'
    },
    {
      question: 'How is student data protected?',
      answer: 'We take privacy seriously with enterprise-grade security, COPPA compliance, encrypted data transmission, secure cloud storage, and strict access controls. Student data is never sold or shared with third parties. Parents have full control over their child\'s data and can request deletion anytime.'
    },
    {
      question: 'Can I cancel or change my subscription anytime?',
      answer: 'Yes, you can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at the next billing cycle. If you cancel, you\'ll retain access until the end of your current billing period, then automatically switch to the free tier.'
    }
  ];

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about ElevatED's personalized, family-first learning platform
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-blue-50 border border-blue-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">What ElevatED is</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• A home-learning companion for students and parents.</li>
              <li>• Adaptive AI tutor with family dashboards and weekly digests.</li>
              <li>• Simple catalog browsing so parents can launch the right lessons.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">What ElevatED is not</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Not a school SIS/LMS, teacher gradebook, or district roster tool.</li>
              <li>• Not built for classroom schedules or bulk teacher provisioning.</li>
              <li>• Admin/import tools live separately at <code className="px-1">/workspace/admin</code>.</li>
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              ElevatED is for students and parents at home, not schools or teachers.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-gray-50 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-6 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                {openIndex === index ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
            <p className="text-gray-600 mb-6">
              Our support team is here to help you get the most out of ElevatED
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                Contact Support
              </button>
              <button className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors">
                Schedule Demo
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
