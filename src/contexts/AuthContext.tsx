import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Student, Parent } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: 'student' | 'parent', grade?: number) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('elevated_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user data - in production, this would come from your backend
      const mockUser: Student = {
        id: '1',
        email,
        name: email.split('@')[0],
        role: 'student',
        grade: 8,
        xp: 1250,
        level: 5,
        badges: [
          {
            id: '1',
            name: 'First Steps',
            description: 'Completed your first lesson!',
            icon: '🎯',
            earnedAt: new Date(),
            rarity: 'common'
          }
        ],
        streakDays: 7,
        strengths: ['Algebra', 'Grammar'],
        weaknesses: ['Geometry', 'Vocabulary'],
        learningPath: [],
        assessmentCompleted: false
      };
      
      setUser(mockUser);
      localStorage.setItem('elevated_user', JSON.stringify(mockUser));
    } catch (error) {
      throw new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: 'student' | 'parent', grade?: number) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newUser: Student | Parent = role === 'student' ? {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name,
        role: 'student',
        grade: grade || 1,
        xp: 0,
        level: 1,
        badges: [],
        streakDays: 0,
        strengths: [],
        weaknesses: [],
        learningPath: [],
        assessmentCompleted: false
      } : {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name,
        role: 'parent',
        children: [],
        subscriptionTier: 'free',
        notifications: {
          weeklyReports: true,
          missedSessions: true,
          lowScores: true,
          majorProgress: true
        }
      };
      
      setUser(newUser);
      localStorage.setItem('elevated_user', JSON.stringify(newUser));
    } catch (error) {
      throw new Error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('elevated_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};