import supabase from '../lib/supabaseClient';
import type { NotificationItem } from '../types';

type NotificationRow = {
  id: number;
  notification_type: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown> | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at?: string | null;
};

const mapNotification = (row: NotificationRow): NotificationItem => ({
  id: row.id,
  notificationType: row.notification_type,
  title: row.title ?? null,
  body: row.body ?? null,
  data: row.data ?? {},
  isRead: row.is_read ?? false,
  readAt: row.read_at ?? null,
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const fetchNotifications = async (limit = 25): Promise<NotificationItem[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, notification_type, title, body, data, is_read, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Notifications] Failed to load feed', error);
    throw error;
  }

  return (data as NotificationRow[] | null | undefined)?.map(mapNotification) ?? [];
};

export const markNotificationRead = async (id: number): Promise<void> => {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: readAt })
    .eq('id', id);

  if (error) {
    console.error('[Notifications] Failed to mark notification as read', error);
    throw error;
  }
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: readAt })
    .eq('is_read', false);

  if (error) {
    console.error('[Notifications] Failed to mark all as read', error);
    throw error;
  }
};

export const clearNotification = async (id: number): Promise<void> => {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) {
    console.error('[Notifications] Failed to clear notification', error);
    throw error;
  }
};

export const clearReadNotifications = async (): Promise<void> => {
  const { error } = await supabase.from('notifications').delete().eq('is_read', true);
  if (error) {
    console.error('[Notifications] Failed to clear read notifications', error);
    throw error;
  }
};

