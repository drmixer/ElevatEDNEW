import React from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import type { Admin, Parent, Student } from '../../types';
import NotificationCenter from './NotificationCenter';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const navLinks =
    user.role === 'student'
      ? [
          { label: 'Home', to: '/student' },
          { label: 'Assignments', to: '/student#assignments' },
          { label: 'Catalog', to: '/catalog', secondary: true },
        ]
      : user.role === 'parent'
      ? [
          { label: 'Home', to: '/parent' },
          { label: 'Goals', to: '/parent#goal-planner' },
          { label: 'Insights', to: '/parent#family-overview' },
          { label: 'Catalog', to: '/catalog', secondary: true },
        ]
      : [];

  return (
    <motion.header 
      className="bg-white shadow-sm border-b border-gray-200"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <img 
                src="https://i.imgur.com/tBePI5o.png" 
                alt="ElevatED Logo" 
                className="h-8 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-brand-blue">ElevatED</h1>
                <p className="text-xs text-gray-500">
                  {user.role === 'student'
                    ? 'Student home'
                    : user.role === 'parent'
                    ? 'Family dashboard'
                    : 'Admin workspace (restricted)'}
                </p>
              </div>
            </div>
            {user.role !== 'admin' && (
              <nav className="hidden md:flex items-center space-x-3 text-sm text-gray-600">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      link.secondary
                        ? 'text-gray-500 hover:text-brand-blue hover:bg-brand-light-blue/40'
                        : 'hover:text-brand-blue hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
            {user.role === 'admin' && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <span className="px-3 py-1 rounded-full bg-brand-light-blue/50 text-brand-blue font-semibold">
                  Admin workspace
                </span>
                <Link to="/workspace/admin" className="hover:text-brand-blue transition-colors px-3 py-2 rounded-lg hover:bg-gray-100">
                  Dashboard
                </Link>
                <Link to="/catalog" className="hover:text-brand-blue transition-colors px-3 py-2 rounded-lg hover:bg-gray-100">
                  Catalog
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user.role === 'student' && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-brand-light-teal px-3 py-1 rounded-full">
                  <span className="text-sm font-medium text-brand-blue">
                    Level {(user as Student).level}
                  </span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-teal transition-all duration-300"
                      style={{ width: `${((user as Student).xp % 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-brand-violet">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-medium">{(user as Student).streakDays}</span>
                </div>
              </div>
            )}
            {user.role === 'parent' && (
              <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
                <div className="px-3 py-1 rounded-full bg-brand-light-teal/40 text-brand-teal font-medium">
                  {(() => {
                    const tier = (user as Parent).subscriptionTier;
                    if (tier === 'premium') return 'Family Premium';
                    if (tier === 'plus') return 'Family Plus';
                    return 'Family Free';
                  })()}
                </div>
                <div className="flex items-center space-x-1 text-brand-violet">
                  <span className="text-lg">👨‍👩‍👧‍👦</span>
                  <span className="font-medium">{(user as Parent).children.length} learners</span>
                </div>
              </div>
            )}
            {user.role === 'admin' && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <span className="px-3 py-1 rounded-full bg-brand-light-blue/40 text-brand-blue font-medium">
                  {(user as Admin).title ?? 'Platform Admin'}
                </span>
              </div>
            )}
            
            <NotificationCenter user={user} />
            
            <Link
              to="/settings"
              className="p-2 text-gray-600 hover:text-brand-blue transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Account and privacy settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-brand-violet rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            
            <button 
              onClick={logout}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
