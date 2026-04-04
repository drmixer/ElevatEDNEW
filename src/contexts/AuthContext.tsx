/* eslint-disable react-refresh/only-export-components */
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabaseClient';
import type { Subject, User, UserRole } from '../types';
import { fetchUserProfile } from '../services/profileService';
import recordReliabilityCheckpoint from '../lib/reliability';
import withTimeout from '../lib/withTimeout';

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
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

type SessionHydrationResult = 'loaded' | 'timed_out' | 'stale';

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
  const isMountedRef = useRef(true);
  const refreshRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightProfileLoadsRef = useRef(new Map<string, Promise<User>>());
  const inFlightSessionHydrationsRef = useRef(new Map<string, Promise<SessionHydrationResult>>());
  const loadedSessionKeyRef = useRef<string | null>(null);

  useEffect(
    () => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        if (refreshRetryRef.current) {
          clearTimeout(refreshRetryRef.current);
        }
      };
    },
    [],
  );

  const safeSetUser = useCallback((next: User | null) => {
    if (!isMountedRef.current) return;
    setUser(next);
  }, []);

  const safeSetLoading = useCallback((next: boolean) => {
    if (!isMountedRef.current) return;
    setLoading(next);
  }, []);

  const resetSessionTracking = useCallback(() => {
    loadedSessionKeyRef.current = null;
    inFlightSessionHydrationsRef.current.clear();
  }, []);

  const handleSignedOut = useCallback(() => {
    resetSessionTracking();
    safeSetUser(null);
  }, [resetSessionTracking, safeSetUser]);

  const getSessionKey = useCallback((session: Session | null | undefined) => {
    const userId = session?.user?.id;
    if (!userId) return null;
    return session.access_token ? `${userId}:${session.access_token}` : userId;
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const existingLoad = inFlightProfileLoadsRef.current.get(userId);
    if (existingLoad) {
      return existingLoad;
    }

    const profileLoad = fetchUserProfile(userId)
      .then((profile) => {
        safeSetUser(profile);
        return profile;
      })
      .catch((error) => {
        console.error('[Auth] Failed to load profile', error);
        safeSetUser(null);
        throw error;
      })
      .finally(() => {
        if (inFlightProfileLoadsRef.current.get(userId) === profileLoad) {
          inFlightProfileLoadsRef.current.delete(userId);
        }
      });

    inFlightProfileLoadsRef.current.set(userId, profileLoad);
    return profileLoad;
  }, [safeSetUser]);

  const hydrateSession = useCallback(async (
    session: Session | null | undefined,
    timeoutMs = 4000,
  ): Promise<SessionHydrationResult> => {
    const sessionUser = session?.user;
    if (!sessionUser?.id) {
      handleSignedOut();
      return 'stale';
    }

    const sessionKey = getSessionKey(session);
    if (sessionKey && loadedSessionKeyRef.current === sessionKey) {
      return 'loaded';
    }

    if (sessionKey) {
      const existingHydration = inFlightSessionHydrationsRef.current.get(sessionKey);
      if (existingHydration) {
        return existingHydration;
      }
    }

    const hydrationPromise = withTimeout(loadProfile(sessionUser.id), timeoutMs)
      .then((profileResult) => {
        if (!isMountedRef.current) {
          return 'stale';
        }

        if (profileResult.timedOut) {
          return 'timed_out';
        }

        if (sessionKey) {
          loadedSessionKeyRef.current = sessionKey;
        }

        return 'loaded';
      })
      .finally(() => {
        if (sessionKey && inFlightSessionHydrationsRef.current.get(sessionKey) === hydrationPromise) {
          inFlightSessionHydrationsRef.current.delete(sessionKey);
        }
      });

    if (sessionKey) {
      inFlightSessionHydrationsRef.current.set(sessionKey, hydrationPromise);
    }

    return hydrationPromise;
  }, [getSessionKey, handleSignedOut, loadProfile]);

  const scheduleSilentRefresh = useCallback(() => {
    if (!isMountedRef.current || refreshRetryRef.current) return;
    refreshRetryRef.current = setTimeout(async () => {
      refreshRetryRef.current = null;
      if (!isMountedRef.current) return;
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), 6000);
        if (!isMountedRef.current) return;
        if (sessionResult.timedOut) {
          console.warn('[Auth] Silent session refresh timed out; will wait for the next auth event.');
          return;
        }
        const nextSession = sessionResult.value.data.session;
        if (nextSession?.user) {
          await hydrateSession(nextSession, 4000);
        }
      } catch (error) {
        console.warn('[Auth] Silent session refresh failed', error);
      }
    }, 800);
  }, [hydrateSession]);

  useEffect(() => {
    const shouldHydrateFromAuthEvent = (
      event: AuthChangeEvent,
      sessionUser: SupabaseAuthUser | null | undefined,
    ) => {
      if (!sessionUser) return false;
      return event === 'INITIAL_SESSION' || event === 'USER_UPDATED';
    };

    const initialise = async () => {
      console.log('[Auth] Initialising...');
      safeSetLoading(true);
      try {
        console.log('[Auth] Getting session...');
        const sessionResult = await withTimeout(supabase.auth.getSession(), 6000);
        console.log('[Auth] Session result:', sessionResult);

        if (sessionResult.timedOut) {
          console.warn('[Auth] Session lookup timed out; continuing without cached session');
          handleSignedOut();
          scheduleSilentRefresh();
          return;
        }

        const { session, error } = sessionResult.value.data || { session: null, error: null };

        if (error) {
          console.error('[Auth] Failed to get session', error);
          handleSignedOut();
          scheduleSilentRefresh();
          return;
        }

        if (session?.user) {
          console.log('[Auth] Found user, loading profile...');
          const hydrationResult = await hydrateSession(session, 4000);
          if (hydrationResult === 'timed_out' && isMountedRef.current) {
            console.warn('[Auth] Profile load timed out; signing out to clear stale session');
            handleSignedOut();
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.warn('[Auth] Failed to sign out during timeout recovery', signOutError);
            }
          }
        } else {
          console.log('[Auth] No user found');
          handleSignedOut();
        }
      } catch (unhandledError) {
        console.error('[Auth] Unexpected error during session restore', unhandledError);
        handleSignedOut();
        scheduleSilentRefresh();
      } finally {
        console.log('[Auth] Setting loading to false');
        safeSetLoading(false);
      }
    };

    initialise();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        handleSignedOut();
        return;
      }

      if (!shouldHydrateFromAuthEvent(event, session.user)) {
        return;
      }

      try {
        const hydrationResult = await hydrateSession(session, 4000);
        if (hydrationResult === 'timed_out' && isMountedRef.current) {
          console.warn(`[Auth] Profile load timed out during auth state change (${event})`);
          scheduleSilentRefresh();
        }
      } catch {
        if (isMountedRef.current) {
          scheduleSilentRefresh();
        }
      }
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, [handleSignedOut, hydrateSession, safeSetLoading, scheduleSilentRefresh]);

  const login = async (email: string, password: string) => {
    safeSetLoading(true);
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

      if (error || !data.user || !data.session) {
        recordReliabilityCheckpoint('auth_login', 'error', { reason: error?.message ?? 'missing_user' });
        throw error ?? new Error('Supabase did not return a user session.');
      }

      const hydrationResult = await hydrateSession(data.session, 4000);
      if (hydrationResult === 'timed_out') {
        throw new Error('Profile load timed out during login.');
      }

      recordReliabilityCheckpoint('auth_login', 'success', { userId: data.user.id });
    } catch (error) {
      console.error('[Auth] Login failed', error);
      const code = (error as { code?: string } | null)?.code;
      if (code === 'email_not_confirmed') {
        handleSignedOut();
        throw error;
      }
      recordReliabilityCheckpoint('auth_login', 'error', { error });
      handleSignedOut();
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed');
    } finally {
      safeSetLoading(false);
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
  ): Promise<{ requiresEmailConfirmation: boolean }> => {
    safeSetLoading(true);
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
        handleSignedOut();
        recordReliabilityCheckpoint('auth_register', 'error', { reason: 'pending_email_confirmation' });
        return { requiresEmailConfirmation: true };
      }

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

      const hydrationResult = await hydrateSession(data.session, 4000);
      if (hydrationResult === 'timed_out') {
        throw new Error('Profile load timed out during registration.');
      }

      recordReliabilityCheckpoint('auth_register', 'success', {
        userId: data.user.id,
        role,
        consentActor,
        guardianConsent: options?.guardianConsent === true,
      });
      return { requiresEmailConfirmation: false };
    } catch (error) {
      console.error('[Auth] Registration failed', error);
      recordReliabilityCheckpoint('auth_register', 'error', { error });
      handleSignedOut();
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Registration failed');
    } finally {
      safeSetLoading(false);
    }
  };

  const logout = () => {
    handleSignedOut();
    supabase.auth.signOut().catch((error) => {
      console.error('[Auth] Logout failed', error);
    });
  };

  const refreshUser = async () => {
    try {
      const result = await withTimeout(supabase.auth.getUser(), 3500);
      if (result.timedOut) {
        console.warn('[Auth] Timed out while refreshing user; retrying in the background.');
        scheduleSilentRefresh();
        return;
      }

      const { data, error } = result.value;

      if (error) {
        console.error('[Auth] Failed to refresh user', error);
        return;
      }

      if (data.user) {
        await loadProfile(data.user.id);
        return;
      }

      handleSignedOut();
    } catch (error) {
      console.error('[Auth] Failed to refresh user', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
