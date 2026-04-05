import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../types';
import { AuthProvider, useAuth } from './AuthContext';

type MockSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
};

type AuthCallback = (event: string, session: MockSession | null) => void | Promise<void>;

const authHarness = vi.hoisted(() => {
  const callbacks = new Set<AuthCallback>();
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const getSession = vi.fn();
  const getUser = vi.fn();
  const signInWithPassword = vi.fn();
  const signUp = vi.fn();
  const onAuthStateChange = vi.fn((callback: AuthCallback) => {
    callbacks.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => callbacks.delete(callback),
        },
      },
    };
  });

  return {
    callbacks,
    getSession,
    getUser,
    onAuthStateChange,
    signInWithPassword,
    signOut,
    signUp,
  };
});

const profileHarness = vi.hoisted(() => ({
  fetchUserProfile: vi.fn(),
}));

const reliabilityHarness = vi.hoisted(() => ({
  recordReliabilityCheckpoint: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: {
      getSession: authHarness.getSession,
      getUser: authHarness.getUser,
      onAuthStateChange: authHarness.onAuthStateChange,
      signInWithPassword: authHarness.signInWithPassword,
      signOut: authHarness.signOut,
      signUp: authHarness.signUp,
    },
    from: vi.fn(),
  },
}));

vi.mock('../services/profileService', () => ({
  fetchUserProfile: profileHarness.fetchUserProfile,
}));

vi.mock('../lib/reliability', () => ({
  __esModule: true,
  default: reliabilityHarness.recordReliabilityCheckpoint,
}));

const emitAuthEvent = async (event: string, session: MockSession | null) => {
  await Promise.all([...authHarness.callbacks].map((callback) => callback(event, session)));
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const mockSession: MockSession = {
  access_token: 'token-123',
  user: {
    id: 'student-1',
    email: 'student@example.com',
  },
};

const mockUser: User = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'Sky Learner',
  role: 'student',
  parentId: null,
  familyLinkCode: null,
  grade: 4,
  xp: 120,
  level: 3,
  badges: [],
  streakDays: 5,
  tutorName: null,
  tutorAvatarId: null,
  studentAvatarId: 'avatar-starter',
  strengths: [],
  weaknesses: [],
  learningPath: [],
  learningPreferences: {
    sessionLength: 'standard',
    focusSubject: 'balanced',
    focusIntensity: 'balanced',
    weeklyPlanIntensity: 'normal',
    weeklyPlanFocus: 'balanced',
    weeklyIntent: 'balanced',
    mixInMode: 'auto',
    electiveEmphasis: 'off',
    allowedElectiveSubjects: [],
    chatMode: 'guided_preferred',
    chatModeLocked: false,
    studyMode: 'keep_up',
    studyModeSetAt: null,
    studyModeLocked: false,
    tutorSettingsUpdatedAt: null,
    tutorSettingsUpdatedBy: null,
  },
  assessmentCompleted: false,
  avatar: 'avatar-starter',
};

const Probe = () => {
  const { user, loading, login } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user?.id ?? 'none'}</div>
      <button type="button" onClick={() => void login('student@example.com', 'password')}>
        Login
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    authHarness.callbacks.clear();
    authHarness.getSession.mockReset();
    authHarness.getUser.mockReset();
    authHarness.onAuthStateChange.mockClear();
    authHarness.signInWithPassword.mockReset();
    authHarness.signOut.mockClear();
    authHarness.signUp.mockReset();
    profileHarness.fetchUserProfile.mockReset();
    reliabilityHarness.recordReliabilityCheckpoint.mockReset();
  });

  it('dedupes the initial session hydrate against INITIAL_SESSION auth events', async () => {
    const pendingProfile = deferred<User>();
    authHarness.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    profileHarness.fetchUserProfile.mockReturnValue(pendingProfile.promise);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(profileHarness.fetchUserProfile).toHaveBeenCalledTimes(1));

    await act(async () => {
      void emitAuthEvent('INITIAL_SESSION', mockSession);
      await Promise.resolve();
    });

    expect(profileHarness.fetchUserProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingProfile.resolve(mockUser);
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('student-1'));
  });

  it('dedupes login hydration against the SIGNED_IN auth event', async () => {
    const pendingProfile = deferred<User>();
    authHarness.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    authHarness.signInWithPassword.mockImplementation(async () => {
      void emitAuthEvent('SIGNED_IN', mockSession);
      return {
        data: { user: mockSession.user, session: mockSession },
        error: null,
      };
    });
    profileHarness.fetchUserProfile.mockReturnValue(pendingProfile.promise);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });

    await waitFor(() => expect(profileHarness.fetchUserProfile).toHaveBeenCalledTimes(1));

    await act(async () => {
      pendingProfile.resolve(mockUser);
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('student-1'));
    expect(profileHarness.fetchUserProfile).toHaveBeenCalledTimes(1);
  });

  it('hydrates the user on a plain SIGNED_IN auth event', async () => {
    authHarness.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    profileHarness.fetchUserProfile.mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await act(async () => {
      await emitAuthEvent('SIGNED_IN', mockSession);
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('student-1'));
    expect(profileHarness.fetchUserProfile).toHaveBeenCalledTimes(1);
  });
});
