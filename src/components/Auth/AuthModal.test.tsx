import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
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

  it('disables student signup without guardian consent', () => {
    render(<AuthModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByText('📚 Student'));

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    expect(submitButton).toBeDisabled();
  });

  it('requires guardian consent before registering a student', async () => {
    registerSpy.mockResolvedValue(undefined);

    render(<AuthModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByText('📚 Student'));

    fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Student Tester' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByLabelText(/parent\/guardian present/i));
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith(
        'student@example.com',
        'Password123!',
        'Student Tester',
        'student',
        1,
        { guardianConsent: true },
      ),
    );
  });
});
