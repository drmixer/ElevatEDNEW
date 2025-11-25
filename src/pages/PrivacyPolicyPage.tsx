import React from 'react';
import { ShieldCheck, FileText, Lock, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-brand-blue uppercase tracking-wide">Privacy-first</p>
            <h1 className="text-3xl font-extrabold text-slate-900 mt-2">ElevatED Privacy Policy</h1>
            <p className="text-sm text-slate-600 mt-1">
              Designed with COPPA/FERPA expectations in mind. Last updated {new Date().getFullYear()}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/legal/terms"
              className="text-sm font-semibold text-brand-blue hover:text-brand-teal underline decoration-2"
            >
              Terms of Service
            </Link>
            <Link
              to="/"
              className="text-sm font-semibold text-slate-700 hover:text-brand-blue inline-flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Back to ElevatED
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <ShieldCheck className="h-10 w-10 text-brand-blue" />
            <div>
              <h2 className="font-semibold text-slate-900">Data minimization</h2>
              <p className="text-sm text-slate-600">
                We only collect what is needed to run adaptive learning experiences and family reporting.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <Lock className="h-10 w-10 text-brand-teal" />
            <div>
              <h2 className="font-semibold text-slate-900">Protected student info</h2>
              <p className="text-sm text-slate-600">
                Student data stays inside ElevatED/Supabase; we avoid sending names, emails, or content to third parties.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-3">
            <FileText className="h-10 w-10 text-brand-violet" />
            <div>
              <h2 className="font-semibold text-slate-900">Family rights</h2>
              <p className="text-sm text-slate-600">
                Parents/guardians can request export or deletion of a learner&apos;s data from within the family dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section id="cookies" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">What we collect</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              ElevatED stores account details (name, email), role (student, parent, admin), learning progress, and
              optional family relationships. We avoid collecting unnecessary personal information and do not sell student
              data. Limited product analytics and strictly necessary cookies are used to keep you signed in without
              sending raw PII to third parties.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">How data is used</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>Deliver personalized lessons, progress tracking, and guardian insights.</li>
              <li>Operate subscriptions and support requests initiated by families.</li>
              <li>Monitor platform health and security without transmitting student PII to monitoring tools.</li>
              <li>Respect FERPA/COPPA-style boundaries: student work products stay within ElevatED-controlled systems.</li>
            </ul>
          </section>

          <section id="coppa" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Data rights for families</h3>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              Guardians can request an export or deletion of a learner&apos;s data. Submit a request from the Family
              Dashboard under “Data rights & privacy” or email <a className="underline" href="mailto:privacy@elevated.edu">privacy@elevated.edu</a>.
              We verify guardian status via family links or parent accounts before fulfilling requests.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                to="/parent"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-blue text-white font-semibold hover:bg-brand-blue/90"
              >
                Go to Family Dashboard
              </Link>
              <Link
                to="/legal/terms"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-800 font-semibold hover:border-brand-blue hover:text-brand-blue"
              >
                Review Terms
              </Link>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Retention & security</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Student data is retained while an account is active to support progress continuity. We use Supabase RLS to
              restrict access to guardians and platform admins. Access to production data requires admin permissions and
              is logged for accountability. Backups are encrypted at rest and in transit.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
