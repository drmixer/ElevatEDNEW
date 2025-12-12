import React from 'react';

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-200/70 rounded-xl ${className}`} />
);

const DashboardRouteSkeleton: React.FC<{ role?: 'student' | 'parent' | 'admin' }> = ({ role }) => {
  const title =
    role === 'parent' ? 'Family dashboard' : role === 'admin' ? 'Admin dashboard' : 'Student dashboard';

  return (
    <div
      className="min-h-[70vh] px-4 py-6 sm:px-6 lg:px-8 animate-pulse"
      role="status"
      aria-label={`Loading ${title}`}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-4 w-72" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <SkeletonBlock key={idx} className="h-24" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonBlock className="h-60" />
          <SkeletonBlock className="h-60" />
          <SkeletonBlock className="h-60" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
        </div>
      </div>
    </div>
  );
};

export default DashboardRouteSkeleton;

