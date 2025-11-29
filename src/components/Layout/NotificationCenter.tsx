import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bell, Check, Clock, Loader2, Trash2 } from 'lucide-react';
import { clearNotification, clearReadNotifications, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notificationService';
import type { NotificationItem, User } from '../../types';

const formatTimeAgo = (timestamp: string): string => {
  const now = Date.now();
  const created = new Date(timestamp).getTime();
  const diffMs = Math.max(now - created, 0);
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const notificationLabel = (notification: NotificationItem): { text: string; tone: string } => {
  switch (notification.notificationType) {
    case 'assignment_created':
      return { text: 'Assignment', tone: 'bg-blue-50 text-blue-700 border-blue-100' };
    case 'assignment_overdue':
      return { text: 'Overdue', tone: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'low_mastery':
      return { text: 'Mastery', tone: 'bg-rose-50 text-rose-700 border-rose-100' };
    case 'streak_milestone':
      return { text: 'Streak', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'skill_mastered':
      return { text: 'Skill mastered', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'goal_met':
      return { text: 'Goal met', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    case 'consistent_low_performance':
      return { text: 'Needs attention', tone: 'bg-orange-50 text-orange-700 border-orange-100' };
    default:
      return { text: 'Update', tone: 'bg-slate-50 text-slate-700 border-slate-100' };
  }
};

const resolveNotificationLink = (notification: NotificationItem): { href: string; label: string } | null => {
  const targetUrl =
    typeof (notification.data?.targetUrl as string | undefined) === 'string'
      ? (notification.data.targetUrl as string)
      : null;
  if (targetUrl) {
    return { href: targetUrl, label: 'Open' };
  }

  switch (notification.notificationType) {
    case 'skill_mastered':
      return { href: '/parent#weekly-snapshot', label: 'See highlight' };
    case 'goal_met':
      return { href: '/parent#goal-planner', label: 'Review goal' };
    case 'consistent_low_performance':
      return { href: '/parent#skill-gaps', label: 'See gaps' };
    case 'assignment_overdue':
      return { href: '/parent#assignments', label: 'View assignment' };
    default:
      return null;
  }
};

const humanizeNotificationBody = (notification: NotificationItem): string => {
  if (notification.body) return notification.body;
  const subject = typeof notification.data?.subject === 'string' ? notification.data.subject : null;
  const student = typeof notification.data?.studentName === 'string' ? notification.data.studentName : 'Your learner';

  switch (notification.notificationType) {
    case 'skill_mastered':
      return `${student} mastered ${subject ?? 'a targeted skill'}. Celebrate and move them forward.`;
    case 'goal_met':
      return `${student} just hit a goal. Keep momentum by setting the next milestone.`;
    case 'consistent_low_performance':
      return `${student} is trending low in ${subject ?? 'a focus area'}. Review the plan and add a quick practice set.`;
    default:
      return 'An update is available.';
  }
};

type Props = {
  user: User;
};

const NotificationCenter: React.FC<Props> = ({ user }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const {
    data: notifications = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => fetchNotifications(),
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
  });

  const clearMutation = useMutation({
    mutationFn: (id: number) => clearNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
  });

  const clearReadMutation = useMutation({
    mutationFn: () => clearReadNotifications(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
  });

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!open) return;
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleOpen = async () => {
    setOpen((prev) => !prev);
    if (!open) {
      await refetch({ throwOnError: false });
    }
  };

  const renderNotification = (notification: NotificationItem) => {
    const label = notificationLabel(notification);
    const isRead = notification.isRead;
    const link = resolveNotificationLink(notification);
    const bodyText = humanizeNotificationBody(notification);

    return (
      <div
        key={notification.id}
        className={`rounded-lg border ${isRead ? 'bg-white border-gray-100' : 'bg-indigo-50/70 border-indigo-100 shadow-sm'}`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => markReadMutation.mutate(notification.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              markReadMutation.mutate(notification.id);
            }
          }}
          className="w-full text-left p-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-1 rounded-full border ${label.tone}`}>
                  {label.text}
                </span>
                {!isRead && (
                  <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                    New
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {notification.title ?? 'Notification'}
              </div>
              <div className="text-sm text-gray-600">{bodyText}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(notification.createdAt)}
                </span>
                {isRead && (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Check className="h-3 w-3" />
                    Read
                  </span>
                )}
              </div>
              {link && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.location.assign(link.href);
                  }}
                  className="text-xs font-semibold text-brand-blue hover:text-brand-violet"
                >
                  {link.label}
                </button>
              )}
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={(event) => {
                event.stopPropagation();
                clearMutation.mutate(notification.id);
              }}
              aria-label="Clear notification"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 text-gray-600 hover:text-brand-blue transition-colors rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-brand-violet text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-900">Notifications</div>
              <div className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isLoading || notifications.length === 0}
                className="text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => clearReadMutation.mutate()}
                disabled={clearReadMutation.isLoading}
                className="text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Clear read
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-4 space-y-2">
            {isFetching && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications…
              </div>
            )}

            {!isFetching && notifications.length === 0 && (
              <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100">
                <AlertCircle className="h-4 w-4 text-gray-400" />
                <span>No notifications yet. We’ll keep this updated for new assignments and milestones.</span>
              </div>
            )}

            {notifications.map((notification) => renderNotification(notification))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
