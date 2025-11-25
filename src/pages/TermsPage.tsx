import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, ShieldCheck, CheckCircle2 } from 'lucide-react';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-brand-light-blue/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-brand-violet uppercase tracking-wide">Terms of Service</p>
            <h1 className="text-3xl font-extrabold text-slate-900 mt-2">ElevatED Participation Terms</h1>
            <p className="text-sm text-slate-600 mt-1">Built to respect schools, families, and young learners.</p>
          </div>
          <Link
            to="/legal/privacy"
            className="text-sm font-semibold text-brand-blue hover:text-brand-teal underline decoration-2"
          >
            Privacy Policy
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <Scale className="h-10 w-10 text-brand-blue" />
            <div>
              <h2 className="font-semibold text-slate-900">Fair use</h2>
              <p className="text-sm text-slate-600">
                ElevatED is for educational use by students, families, and authorized school staff.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <ShieldCheck className="h-10 w-10 text-brand-teal" />
            <div>
              <h2 className="font-semibold text-slate-900">Age-appropriate</h2>
              <p className="text-sm text-slate-600">
                Students under 13 use the platform through a parent/guardian account or verified consent.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <CheckCircle2 className="h-10 w-10 text-brand-violet" />
            <div>
              <h2 className="font-semibold text-slate-900">No data sales</h2>
              <p className="text-sm text-slate-600">
                We do not sell student data. Access is restricted by Supabase RLS and admin controls.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Account responsibilities</h3>
            <p>
              Keep credentials secure and use the platform for legitimate educational purposes. Parents and admins are
              responsible for managing learner access and ensuring the information provided is accurate.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Content and conduct</h3>
            <p>
              You may not upload harmful content, attempt to bypass security controls, or misuse AI features. We may
              suspend access if activity threatens student safety, privacy, or platform stability.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Data handling</h3>
            <p>
              ElevatED processes student data to deliver adaptive lessons, reporting, and billing. We rely on Supabase
              row-level security, minimal third-party sharing, and audit trails for admin access. Families can request
              export or deletion of a learner&apos;s data from the Family Dashboard or by contacting privacy@elevated.edu.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Service changes</h3>
            <p>
              Features may evolve as we improve the product. We&apos;ll communicate material updates to guardians and
              admins. Continued use after updates signifies acceptance of the revised terms.
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/legal/privacy"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-blue text-white font-semibold hover:bg-brand-blue/90"
            >
              Read privacy policy
            </Link>
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-800 font-semibold hover:border-brand-blue hover:text-brand-blue"
            >
              Return to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
