import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import NotificationCenter from '../NotificationCenter';
import type { NotificationItem, User } from '../../../types';

vi.mock('../../../services/notificationService', () => {
  const mockNotifications: NotificationItem[] = [
    {
      id: 1,
      notificationType: 'assignment_created',
      title: 'New assignment available',
      body: 'Complete Algebra practice this week.',
      data: {},
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      notificationType: 'streak_milestone',
      title: '7-day streak',
      body: 'Keep it going!',
      data: {},
      isRead: true,
      readAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ];

  return {
    fetchNotifications: vi.fn().mockResolvedValue(mockNotifications),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    clearNotification: vi.fn().mockResolvedValue(undefined),
    clearReadNotifications: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('NotificationCenter', () => {
  const user: User = {
    id: 'student-1',
    email: 'student@example.com',
    name: 'Student',
    role: 'student',
  };

  it('shows unread badge and renders list when opened', async () => {
    renderWithProviders(<NotificationCenter user={user} />);

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Notifications'));

    await waitFor(() => {
      expect(screen.getByText('New assignment available')).toBeInTheDocument();
    });

    expect(screen.getByText('7-day streak')).toBeInTheDocument();
  });
});
