import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import type { Subject, User, UserRole } from '../types';
import { fetchUserProfile } from '../services/profileService';
import recordReliabilityCheckpoint from '../lib/reliability';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    grade?: number,
    options?: {
      guardianConsent?: boolean;
      studentAge?: number;
      consentActor?: 'guardian_present' | 'self_attested_13_plus';
      consentActorDetails?: string | null;
      consentRecordedAt?: string;
      guardianContact?: string | null;
      focusSubject?: Subject | 'balanced';
      parentEmail?: string | null;
    },
  ) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
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

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profile = await fetchUserProfile(userId);
      setUser(profile);
    } catch (error) {
      console.error('[Auth] Failed to load profile', error);
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    const initialise = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] Failed to get session', error);
          setUser(null);
          return;
        }

        if (session?.user) {
          try {
            await loadProfile(session.user.id);
          } catch {
            // loadProfile handles logging
          }
        } else {
          setUser(null);
        }
      } catch (unhandledError) {
        console.error('[Auth] Unexpected error during session restore', unhandledError);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initialise();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setLoading(true);
        try {
          await loadProfile(session.user.id);
        } catch {
          // handled inside loadProfile
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      const errorCode = (error as { code?: string } | null)?.code;
      const errorMessage = error?.message ?? '';
      const isEmailNotConfirmed =
        errorCode === 'email_not_confirmed' || /not\s+confirmed/i.test(errorMessage || '');

      if (isEmailNotConfirmed) {
        recordReliabilityCheckpoint('auth_login_email_not_confirmed', 'error', { email });
        const notConfirmedError = new Error('email_not_confirmed');
        (notConfirmedError as { code?: string }).code = 'email_not_confirmed';
        throw notConfirmedError;
      }

      if (error || !data.user) {
        recordReliabilityCheckpoint('auth_login', 'error', { reason: error?.message ?? 'missing_user' });
        throw error ?? new Error('Supabase did not return a user session.');
      }

      await loadProfile(data.user.id);
      recordReliabilityCheckpoint('auth_login', 'success', { userId: data.user.id });
    } catch (error) {
      console.error('[Auth] Login failed', error);
      const code = (error as { code?: string } | null)?.code;
      if (code === 'email_not_confirmed') {
        setUser(null);
        throw error;
      }
      recordReliabilityCheckpoint('auth_login', 'error', { error });
      setUser(null);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    grade?: number,
    options?: {
      guardianConsent?: boolean;
      studentAge?: number;
      consentActor?: 'guardian_present' | 'self_attested_13_plus';
      consentActorDetails?: string | null;
      consentRecordedAt?: string;
      guardianContact?: string | null;
      focusSubject?: Subject | 'balanced';
      parentEmail?: string | null;
    },
  ) => {
    setLoading(true);
    try {
      const studentAge = options?.studentAge;
      const isUnder13 = typeof studentAge === 'number' ? studentAge < 13 : false;
      if (role === 'student' && isUnder13 && options?.guardianConsent !== true) {
        throw new Error('A parent or guardian must approve student sign-ups for learners under 13.');
      }

      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const consentRecordedAt = options?.consentRecordedAt ?? new Date().toISOString();
      const consentActor = options?.consentActor ?? (isUnder13 ? 'guardian_present' : 'self_attested_13_plus');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: name,
            role,
            grade,
            guardian_consent: options?.guardianConsent === true,
            student_age: studentAge ?? null,
            consent_actor: consentActor,
            consent_actor_details: options?.consentActorDetails ?? null,
            consent_recorded_at: consentRecordedAt,
            guardian_contact: options?.guardianContact ?? options?.parentEmail ?? null,
            parent_email: options?.parentEmail ?? null,
            focus_subject: options?.focusSubject ?? null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.session || !data.user) {
        setUser(null);
        recordReliabilityCheckpoint('auth_register', 'error', { reason: 'pending_email_confirmation' });
        throw new Error('Sign-up successful. Please check your email to confirm your account.');
      }

      // Persist grade and learning preferences onto the student profile so adaptive paths can start immediately.
      if (role === 'student') {
        const focusSubject = options?.focusSubject ?? 'balanced';
        const learningStyle = {
          sessionLength: 'standard',
          focusSubject,
          focusIntensity: focusSubject === 'balanced' ? 'balanced' : 'focused',
        };
        await supabase
          .from('student_profiles')
          .update({
            grade: grade ?? null,
            learning_style: learningStyle,
          })
          .eq('id', data.user.id);
      }

      await loadProfile(data.user.id);
      recordReliabilityCheckpoint('auth_register', 'success', {
        userId: data.user.id,
        role,
        consentActor,
        guardianConsent: options?.guardianConsent === true,
      });
    } catch (error) {
      console.error('[Auth] Registration failed', error);
      recordReliabilityCheckpoint('auth_register', 'error', { error });
      setUser(null);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    supabase.auth.signOut().catch((error) => {
      console.error('[Auth] Logout failed', error);
    });
  };

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[Auth] Failed to refresh user', error);
      return;
    }

    if (data.user) {
      await loadProfile(data.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
