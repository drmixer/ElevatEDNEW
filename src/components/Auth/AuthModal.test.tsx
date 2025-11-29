import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AuthModal from './AuthModal';

const registerSpy = vi.fn();
const loginSpy = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: loginSpy,
    register: registerSpy,
    logout: vi.fn(),
    loading: false,
    refreshUser: vi.fn(),
  }),
}));

describe('AuthModal', () => {
  beforeEach(() => {
    registerSpy.mockReset();
    loginSpy.mockReset();
  });

  const renderModal = () =>
    render(
      <MemoryRouter>
        <AuthModal isOpen onClose={() => {}} />
      </MemoryRouter>,
    );

  it('disables student signup without guardian consent', () => {
    renderModal();

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByRole('button', { name: /sign up as a student/i }));
    fireEvent.change(screen.getByPlaceholderText('How old is the learner?'), { target: { value: '10' } });

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    expect(submitButton).toBeDisabled();
  });

  it('requires guardian consent before registering a student under 13 and logs consent metadata', async () => {
    registerSpy.mockResolvedValue(undefined);

    renderModal();
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByRole('button', { name: /sign up as a student/i }));

    fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Student Tester' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText('How old is the learner?'), { target: { value: '12' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Pat Parent - parent@example.com'), {
      target: { value: 'Pat Parent - parent@example.com' },
    });

    fireEvent.click(screen.getByLabelText(/guardian is here/i));
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith(
        'student@example.com',
        'Password123!',
        'Student Tester',
        'student',
        1,
        expect.objectContaining({
          guardianConsent: true,
          studentAge: 12,
          consentActor: 'guardian_present',
          guardianContact: 'Pat Parent - parent@example.com',
        }),
      ),
    );
  });

  it('lets 13+ students self-attest without guardian consent when age is provided', async () => {
    registerSpy.mockResolvedValue(undefined);

    renderModal();
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByRole('button', { name: /sign up as a student/i }));

    fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Teen Tester' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'teen@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText('How old is the learner?'), { target: { value: '14' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith(
        'teen@example.com',
        'Password123!',
        'Teen Tester',
        'student',
        1,
        expect.objectContaining({
          guardianConsent: false,
          studentAge: 14,
          consentActor: 'self_attested_13_plus',
        }),
      ),
    );
  });
});
