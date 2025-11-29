import type { SupabaseClient } from '@supabase/supabase-js';
import { formatSubjectLabel as labelSubject, normalizeSubject } from '../src/lib/subjects';

export type NotificationType =
  | 'assignment_created'
  | 'assignment_overdue'
  | 'low_mastery'
  | 'streak_milestone'
  | 'skill_mastered'
  | 'goal_met'
  | 'consistent_low_performance';

type ParentPreferenceKey =
  | 'weeklyReports'
  | 'missedSessions'
  | 'lowScores'
  | 'majorProgress'
  | 'assignments'
  | 'streaks';

type NotificationInsert = {
  recipient_id: string;
  sender_id?: string | null;
  notification_type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type ParentRecipient = {
  id: string;
  name?: string | null;
  preferences: Record<string, boolean> | null;
};

type StudentRow = {
  id: string;
  parent_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  streak_days?: number | null;
};

type AssignmentContext = {
  student_id: string;
  assignment_id: number;
  due_at: string | null;
  status: string | null;
  assignments: {
    title: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
};

type MasteryContext = {
  student_id: string;
  skill_id: number;
  mastery_pct: number;
  updated_at: string | null;
};

type StreakContext = {
  id: string;
  streak_days: number;
};

type ParentDashboardChildRow = {
  parent_id: string;
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  lessons_completed_week: number | null;
  practice_minutes_week: number | null;
  weekly_lessons_target: number | null;
  practice_minutes_target: number | null;
  mastery_targets: Record<string, unknown> | null;
  mastery_breakdown:
    | Array<{
        subject?: string | null;
        mastery?: number | null;
      }>
    | null;
};

const PREFERENCE_KEY_BY_TYPE: Record<NotificationType, ParentPreferenceKey | null> = {
  assignment_created: 'majorProgress',
  assignment_overdue: 'missedSessions',
  low_mastery: 'lowScores',
  streak_milestone: 'majorProgress',
  skill_mastered: 'majorProgress',
  goal_met: 'majorProgress',
  consistent_low_performance: 'lowScores',
};

const formatStudentName = (row: StudentRow | undefined): string => {
  if (!row) return 'your learner';
  const parts = [row.first_name, row.last_name].filter(Boolean) as string[];
  if (parts.length === 0) return 'your learner';
  return parts.join(' ');
};

const formatSubjectLabel = (subject: string | null | undefined): string => {
  if (!subject) return 'a focus area';
  const normalized = normalizeSubject(subject);
  if (!normalized) return subject.replace('_', ' ');
  return labelSubject(normalized);
};

const formatDueDate = (value: string | null | undefined): string => {
  if (!value) return 'soon';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const parentPreferenceEnabled = (
  recipient: ParentRecipient,
  type: NotificationType,
): boolean => {
  const preferenceKey = PREFERENCE_KEY_BY_TYPE[type];
  if (!preferenceKey) {
    return true;
  }
  const preferences = recipient.preferences ?? {};
  const value = preferences[preferenceKey];
  return value !== false;
};

const getWeekStartIso = (now = new Date()): string => {
  const day = now.getDay();
  const mondayOffset = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

const parseTargets = (raw: Record<string, unknown> | null): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!raw) return map;
  Object.entries(raw).forEach(([key, value]) => {
    if (typeof value === 'number') {
      map[key] = value;
    } else if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        map[key] = parsed;
      }
    }
  });
  return map;
};

const fetchStudentRows = async (
  client: SupabaseClient,
  studentIds: string[],
): Promise<StudentRow[]> => {
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const { data, error } = await client
    .from('student_profiles')
    .select('id, parent_id, first_name, last_name, streak_days')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(`Unable to load student context: ${error.message}`);
  }

  return (data as StudentRow[]) ?? [];
};

const fetchParentRecipients = async (
  client: SupabaseClient,
  studentRows: StudentRow[],
): Promise<Map<string, ParentRecipient[]>> => {
  const studentIds = studentRows.map((row) => row.id);
  if (!studentIds.length) return new Map();

  const { data: guardianRows, error: guardianError } = await client
    .from('guardian_child_links')
    .select('student_id, parent_id, status')
    .in('student_id', studentIds)
    .eq('status', 'active');

  if (guardianError) {
    throw new Error(`Unable to load guardian links: ${guardianError.message}`);
  }

  const parentIds = new Set<string>();
  studentRows.forEach((row) => {
    if (row.parent_id) parentIds.add(row.parent_id);
  });
  (guardianRows ?? []).forEach((row) => {
    if (row.parent_id) parentIds.add(row.parent_id as string);
  });

  if (!parentIds.size) return new Map();

  const { data: parentRows, error: parentError } = await client
    .from('parent_profiles')
    .select('id, full_name, notifications')
    .in('id', Array.from(parentIds));

  if (parentError) {
    throw new Error(`Unable to load parent preferences: ${parentError.message}`);
  }

  const parentMap = new Map<string, { full_name: string | null; notifications: Record<string, boolean> | null }>();
  (parentRows ?? []).forEach((row) => {
    parentMap.set(row.id as string, {
      full_name: (row.full_name as string | null) ?? null,
      notifications: (row.notifications as Record<string, boolean> | null) ?? null,
    });
  });

  const recipients = new Map<string, ParentRecipient[]>();
  studentRows.forEach((row) => {
    const list: ParentRecipient[] = [];

    const pushParent = (parentId: string | null | undefined) => {
      if (!parentId) return;
      const parent = parentMap.get(parentId) ?? { full_name: null, notifications: null };
      list.push({
        id: parentId,
        name: parent.full_name,
        preferences: parent.notifications,
      });
    };

    pushParent(row.parent_id);
    (guardianRows ?? [])
      .filter((guardian) => guardian.student_id === row.id)
      .forEach((guardian) => pushParent(guardian.parent_id as string));

    recipients.set(row.id, list);
  });

  return recipients;
};

const fetchParentDashboardSnapshots = async (
  client: SupabaseClient,
): Promise<ParentDashboardChildRow[]> => {
  const { data, error } = await client
    .from('parent_dashboard_children')
    .select(
      'parent_id, student_id, first_name, last_name, lessons_completed_week, practice_minutes_week, weekly_lessons_target, practice_minutes_target, mastery_targets, mastery_breakdown',
    )
    .limit(150);

  if (error) {
    console.warn('[notifications] Unable to load parent dashboard snapshots', error);
    return [];
  }

  return (data as ParentDashboardChildRow[]) ?? [];
};

const filterExistingNotifications = async (
  client: SupabaseClient,
  payloads: NotificationInsert[],
): Promise<NotificationInsert[]> => {
  const eventKeys = payloads
    .map((payload) => payload.data?.eventKey)
    .filter((key): key is string => typeof key === 'string');
  if (!eventKeys.length) return payloads;

  const recipients = Array.from(new Set(payloads.map((payload) => payload.recipient_id)));
  const types = Array.from(new Set(payloads.map((payload) => payload.notification_type)));
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

  const { data, error } = await client
    .from('notifications')
    .select('recipient_id, notification_type, data')
    .in('recipient_id', recipients)
    .in('notification_type', types)
    .gte('created_at', cutoff);

  if (error) {
    console.warn('[notifications] Unable to check existing notifications', error);
    return payloads;
  }

  const existing = new Set<string>();
  (data ?? []).forEach((row) => {
    const key = (row.data as Record<string, unknown>)?.eventKey;
    if (typeof key === 'string') {
      existing.add(`${row.recipient_id}:${key}`);
    }
  });

  return payloads.filter((payload) => {
    const key = payload.data?.eventKey;
    if (!key) return true;
    return !existing.has(`${payload.recipient_id}:${key}`);
  });
};

const insertNotifications = async (
  client: SupabaseClient,
  payloads: NotificationInsert[],
): Promise<number> => {
  const pending = await filterExistingNotifications(client, payloads);
  if (!pending.length) return 0;

  const { error } = await client.from('notifications').insert(pending);
  if (error) {
    throw new Error(`Failed to insert notifications: ${error.message}`);
  }

  queueExternalDeliveryHooks(pending);
  return pending.length;
};

const queueExternalDeliveryHooks = (payloads: NotificationInsert[]) => {
  // Placeholder for future email/SMS delivery.
  if (payloads.length === 0) return;
  // eslint-disable-next-line no-console
  console.debug(
    '[notifications] Delivery hooks ready',
    payloads.map((item) => item.notification_type),
  );
};

export const buildAssignmentNotifications = (
  assignment: {
    assignmentId: number;
    assignmentTitle: string;
    moduleTitle?: string | null;
    dueAt?: string | null;
  },
  studentRows: StudentRow[],
  parentRecipients: Map<string, ParentRecipient[]>,
  senderId?: string | null,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));

  studentRows.forEach((row) => {
    const title = `New assignment: ${assignment.assignmentTitle}`;
    const dueDate = formatDueDate(assignment.dueAt ?? null);
    const body = assignment.moduleTitle
      ? `"${assignment.assignmentTitle}" from ${assignment.moduleTitle} is due ${dueDate}.`
      : `"${assignment.assignmentTitle}" is due ${dueDate}.`;

    notifications.push({
      recipient_id: row.id,
      sender_id: senderId,
      notification_type: 'assignment_created',
      title,
      body,
      data: {
        assignmentId: assignment.assignmentId,
        moduleTitle: assignment.moduleTitle,
        dueAt: assignment.dueAt ?? null,
        eventKey: `assignment_created:${assignment.assignmentId}:${row.id}`,
        channels: ['in_app'],
      },
    });

    const parents = parentRecipients.get(row.id) ?? [];
    parents
      .filter((parent) => parentPreferenceEnabled(parent, 'assignment_created'))
      .forEach((parent) => {
        notifications.push({
          recipient_id: parent.id,
          sender_id: senderId ?? null,
          notification_type: 'assignment_created',
          title: `New assignment for ${formatStudentName(studentMap.get(row.id))}`,
          body,
          data: {
            assignmentId: assignment.assignmentId,
            studentId: row.id,
            dueAt: assignment.dueAt ?? null,
            eventKey: `assignment_created:${assignment.assignmentId}:${row.id}`,
            channels: ['in_app'],
          },
        });
      });
  });

  return notifications;
};

const buildOverdueNotifications = (
  assignments: AssignmentContext[],
  studentRows: StudentRow[],
  parentRecipients: Map<string, ParentRecipient[]>,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));

  assignments.forEach((row) => {
    const assignmentTitle = row.assignments?.title ?? 'Assignment';
    const moduleTitle = (row.assignments?.metadata as Record<string, unknown> | null)?.module_title as
      | string
      | null
      | undefined;

    const body = moduleTitle
      ? `"${assignmentTitle}" (${moduleTitle}) is overdue. Jump back in to keep momentum.`
      : `"${assignmentTitle}" is overdue. Jump back in to keep momentum.`;

    const studentId = row.student_id;
    const eventKey = `assignment_overdue:${row.assignment_id}:${studentId}`;

    notifications.push({
      recipient_id: studentId,
      notification_type: 'assignment_overdue',
      title: `Assignment overdue: ${assignmentTitle}`,
      body,
      data: {
        assignmentId: row.assignment_id,
        studentId,
        dueAt: row.due_at,
        eventKey,
        channels: ['in_app'],
      },
    });

    const parents = parentRecipients.get(studentId) ?? [];
    parents
      .filter((parent) => parentPreferenceEnabled(parent, 'assignment_overdue'))
      .forEach((parent) => {
        notifications.push({
          recipient_id: parent.id,
          notification_type: 'assignment_overdue',
          title: `${formatStudentName(studentMap.get(studentId))} has an overdue assignment`,
          body,
          data: {
            assignmentId: row.assignment_id,
            studentId,
            dueAt: row.due_at,
            eventKey,
            channels: ['in_app'],
          },
        });
      });
  });

  return notifications;
};

const buildLowMasteryNotifications = (
  masteryRows: MasteryContext[],
  studentRows: StudentRow[],
  parentRecipients: Map<string, ParentRecipient[]>,
  subjectNameBySkill: Map<number, string>,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));

  masteryRows.forEach((row) => {
    const subject = subjectNameBySkill.get(row.skill_id) ?? 'a focus area';
    const studentId = row.student_id;
    const studentName = formatStudentName(studentMap.get(studentId));
    const eventKey = `low_mastery:${row.skill_id}:${studentId}`;

    notifications.push({
      recipient_id: studentId,
      notification_type: 'low_mastery',
      title: `Let's review ${subject}`,
      body: `Mastery dropped below target (${Math.round(row.mastery_pct)}%). A quick practice session can help.`,
      data: {
        skillId: row.skill_id,
        masteryPct: row.mastery_pct,
        eventKey,
        channels: ['in_app'],
      },
    });

    const parents = parentRecipients.get(studentId) ?? [];
    parents
      .filter((parent) => parentPreferenceEnabled(parent, 'low_mastery'))
      .forEach((parent) => {
        notifications.push({
          recipient_id: parent.id,
          notification_type: 'low_mastery',
          title: `${studentName} could use support in ${subject}`,
          body: `${studentName}'s mastery dipped to ${Math.round(row.mastery_pct)}%. Consider scheduling a practice block.`,
          data: {
            skillId: row.skill_id,
            studentId,
            masteryPct: row.mastery_pct,
            eventKey,
            channels: ['in_app'],
          },
        });
      });
  });

  return notifications;
};

const buildSkillMasteredNotifications = (
  masteryRows: MasteryContext[],
  studentRows: StudentRow[],
  parentRecipients: Map<string, ParentRecipient[]>,
  subjectNameBySkill: Map<number, string>,
  threshold = 85,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));

  masteryRows.forEach((row) => {
    if (row.mastery_pct < threshold) return;
    const subject = subjectNameBySkill.get(row.skill_id) ?? 'a focus area';
    const studentId = row.student_id;
    const studentName = formatStudentName(studentMap.get(studentId));
    const eventKey = `skill_mastered:${row.skill_id}:${studentId}`;

    notifications.push({
      recipient_id: studentId,
      notification_type: 'skill_mastered',
      title: `Skill mastered: ${subject}`,
      body: `Great job! You reached ${Math.round(row.mastery_pct)}% mastery. Keep the momentum.`,
      data: {
        skillId: row.skill_id,
        masteryPct: row.mastery_pct,
        eventKey,
        channels: ['in_app'],
        targetUrl: '/student',
      },
    });

    const parents = parentRecipients.get(studentId) ?? [];
    parents
      .filter((parent) => parentPreferenceEnabled(parent, 'skill_mastered'))
      .forEach((parent) => {
        notifications.push({
          recipient_id: parent.id,
          notification_type: 'skill_mastered',
          title: `${studentName} mastered a ${subject} skill`,
          body: `${studentName} reached ${Math.round(row.mastery_pct)}% mastery. High five them and pick a next step.`,
          data: {
            skillId: row.skill_id,
            studentId,
            masteryPct: row.mastery_pct,
            eventKey,
            channels: ['in_app'],
            targetUrl: '/parent#weekly-snapshot',
          },
        });
      });
  });

  return notifications;
};

export const buildGoalNotificationsFromRow = (
  row: ParentDashboardChildRow,
  student: StudentRow | undefined,
  parents: ParentRecipient[],
  weekStart: string,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentId = row.student_id;
  const studentName = formatStudentName(student);
  const lessonsCompleted = row.lessons_completed_week ?? 0;
  const minutesCompleted = row.practice_minutes_week ?? 0;
  const lessonsTarget = row.weekly_lessons_target ?? 0;
  const minutesTarget = row.practice_minutes_target ?? 0;
  const masteryTargets = parseTargets(row.mastery_targets);
  const masteryMap = new Map<string, number>();
  (row.mastery_breakdown ?? []).forEach((entry) => {
    const subject = (entry.subject ?? '') as string;
    const key = subject.toLowerCase();
    const mastery = typeof entry.mastery === 'number' ? entry.mastery : Number.parseFloat(String(entry.mastery ?? 0));
    if (key && Number.isFinite(mastery)) {
      masteryMap.set(key, mastery);
    }
  });

  const pushParent = (payload: NotificationInsert, type: NotificationType) => {
    parents
      .filter((parent) => parentPreferenceEnabled(parent, type))
      .forEach((parent) =>
        notifications.push({
          ...payload,
          recipient_id: parent.id,
        }),
      );
  };

  if (lessonsTarget > 0 && lessonsCompleted >= lessonsTarget) {
    const eventKey = `goal_met:lessons:${studentId}:${weekStart}`;
    notifications.push({
      recipient_id: studentId,
      notification_type: 'goal_met',
      title: 'Weekly lessons goal met',
      body: `You completed ${lessonsCompleted}/${lessonsTarget} lessons this week.`,
      data: {
        goalType: 'lessons',
        target: lessonsTarget,
        achieved: lessonsCompleted,
        eventKey,
        weekStart,
        targetUrl: '/student',
        channels: ['in_app'],
      },
    });

    pushParent(
      {
        recipient_id: studentId,
        notification_type: 'goal_met',
        title: `${studentName} hit their lessons goal`,
        body: `${studentName} finished ${lessonsCompleted}/${lessonsTarget} lessons this week.`,
        data: {
          goalType: 'lessons',
          target: lessonsTarget,
          achieved: lessonsCompleted,
          studentId,
          eventKey,
          weekStart,
          targetUrl: '/parent#weekly-snapshot',
          channels: ['in_app'],
        },
      },
      'goal_met',
    );
  }

  if (minutesTarget > 0 && minutesCompleted >= minutesTarget) {
    const eventKey = `goal_met:minutes:${studentId}:${weekStart}`;
    notifications.push({
      recipient_id: studentId,
      notification_type: 'goal_met',
      title: 'Weekly minutes goal met',
      body: `You studied for ${minutesCompleted} minutes (goal ${minutesTarget}).`,
      data: {
        goalType: 'minutes',
        target: minutesTarget,
        achieved: minutesCompleted,
        eventKey,
        weekStart,
        targetUrl: '/student',
        channels: ['in_app'],
      },
    });

    pushParent(
      {
        recipient_id: studentId,
        notification_type: 'goal_met',
        title: `${studentName} hit their minutes goal`,
        body: `${studentName} logged ${minutesCompleted} minutes toward a ${minutesTarget}-minute goal.`,
        data: {
          goalType: 'minutes',
          target: minutesTarget,
          achieved: minutesCompleted,
          studentId,
          eventKey,
          weekStart,
          targetUrl: '/parent#weekly-snapshot',
          channels: ['in_app'],
        },
      },
      'goal_met',
    );
  }

  let masteryNotices = 0;
  Object.entries(masteryTargets).forEach(([subjectKey, target]) => {
    if (masteryNotices >= 2) return;
    const mastery = masteryMap.get(subjectKey.toLowerCase());
    if (mastery === undefined) return;
    if (mastery < target) return;
    masteryNotices += 1;

    const subjectLabel = formatSubjectLabel(subjectKey);
    const eventKey = `goal_met:mastery:${subjectKey}:${studentId}:${weekStart}`;

    notifications.push({
      recipient_id: studentId,
      notification_type: 'goal_met',
      title: `Mastery goal met in ${subjectLabel}`,
      body: `You reached ${Math.round(mastery)}% mastery (goal ${Math.round(target)}%).`,
      data: {
        goalType: 'mastery',
        target,
        achieved: mastery,
        subject: subjectKey,
        eventKey,
        weekStart,
        targetUrl: '/student',
        channels: ['in_app'],
      },
    });

    pushParent(
      {
        recipient_id: studentId,
        notification_type: 'goal_met',
        title: `${studentName} met a ${subjectLabel} goal`,
        body: `${studentName} reached ${Math.round(mastery)}% mastery (goal ${Math.round(target)}%).`,
        data: {
          goalType: 'mastery',
          target,
          achieved: mastery,
          subject: subjectKey,
          studentId,
          eventKey,
          weekStart,
          targetUrl: '/parent#weekly-snapshot',
          channels: ['in_app'],
        },
      },
      'goal_met',
    );
  });

  return notifications;
};

const buildConsistentLowPerformanceNotifications = (
  row: ParentDashboardChildRow,
  student: StudentRow | undefined,
  parents: ParentRecipient[],
  weekStart: string,
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentId = row.student_id;
  const studentName = formatStudentName(student);
  const lessons = row.lessons_completed_week ?? 0;
  const minutes = row.practice_minutes_week ?? 0;
  const masteryEntries = (row.mastery_breakdown ?? []).map((entry) => ({
    subject: (entry.subject ?? '') as string,
    mastery: typeof entry.mastery === 'number' ? entry.mastery : Number.parseFloat(String(entry.mastery ?? 0)),
  }));

  if (!masteryEntries.length) return notifications;

  const lowest = masteryEntries.slice().sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))[0];
  const average =
    masteryEntries.reduce((acc, entry) => acc + (entry.mastery ?? 0), 0) / Math.max(masteryEntries.length, 1);

  const lowActivity = lessons < 3 || minutes < 150;
  const lowMastery = (lowest.mastery ?? 100) < 60 || average < 65;
  if (!lowActivity || !lowMastery) return notifications;

  const subjectLabel = formatSubjectLabel(lowest.subject);
  const eventKey = `consistent_low_performance:${studentId}:${lowest.subject || 'general'}:${weekStart}`;

  notifications.push({
    recipient_id: studentId,
    notification_type: 'consistent_low_performance',
    title: `Let's lift ${subjectLabel}`,
    body: `Your recent work in ${subjectLabel} looks low. Try a focused practice block to rebound.`,
    data: {
      subject: lowest.subject ?? 'focus',
      mastery: lowest.mastery,
      lessons,
      minutes,
      eventKey,
      weekStart,
      targetUrl: '/student',
      channels: ['in_app'],
    },
  });

  parents
    .filter((parent) => parentPreferenceEnabled(parent, 'consistent_low_performance'))
    .forEach((parent) => {
      notifications.push({
        recipient_id: parent.id,
        notification_type: 'consistent_low_performance',
        title: `${studentName} needs attention in ${subjectLabel}`,
        body: `${studentName} has low ${subjectLabel} mastery and light activity this week. Check the Skill gaps view.`,
        data: {
          subject: lowest.subject ?? 'focus',
          mastery: lowest.mastery,
          lessons,
          minutes,
          studentId,
          eventKey,
          weekStart,
          targetUrl: '/parent#skill-gaps',
          channels: ['in_app'],
        },
      });
    });

  return notifications;
};

const buildStreakNotifications = (
  streakRows: StreakContext[],
  studentRows: StudentRow[],
  parentRecipients: Map<string, ParentRecipient[]>,
  milestones: number[],
): NotificationInsert[] => {
  const notifications: NotificationInsert[] = [];
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));
  const milestoneSet = new Set(milestones);

  streakRows.forEach((row) => {
    if (!milestoneSet.has(row.streak_days)) return;
    const studentId = row.id;
    const studentName = formatStudentName(studentMap.get(studentId));
    const eventKey = `streak_milestone:${row.streak_days}:${studentId}`;
    const title = `🔥 ${row.streak_days}-day streak!`;
    const body = `${studentName} has kept their streak for ${row.streak_days} days. Keep it going!`;

    notifications.push({
      recipient_id: studentId,
      notification_type: 'streak_milestone',
      title,
      body,
      data: {
        streakDays: row.streak_days,
        eventKey,
        channels: ['in_app'],
      },
    });

    const parents = parentRecipients.get(studentId) ?? [];
    parents
      .filter((parent) => parentPreferenceEnabled(parent, 'streak_milestone'))
      .forEach((parent) => {
        notifications.push({
          recipient_id: parent.id,
          notification_type: 'streak_milestone',
          title: `${studentName} hit a ${row.streak_days}-day streak`,
          body,
          data: {
            streakDays: row.streak_days,
            studentId,
            eventKey,
            channels: ['in_app'],
          },
        });
      });
  });

  return notifications;
};

export const notifyAssignmentCreated = async (
  client: SupabaseClient | null,
  params: {
    assignmentId: number;
    assignmentTitle: string;
    moduleTitle?: string | null;
    dueAt?: string | null;
    studentIds: string[];
    senderId?: string | null;
  },
): Promise<void> => {
  if (!client) return;
  const studentRows = await fetchStudentRows(client, params.studentIds);
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const payloads = buildAssignmentNotifications(
    {
      assignmentId: params.assignmentId,
      assignmentTitle: params.assignmentTitle,
      moduleTitle: params.moduleTitle,
      dueAt: params.dueAt,
    },
    studentRows,
    parentRecipients,
    params.senderId ?? null,
  );
  await insertNotifications(client, payloads);
};

const scanOverdueAssignments = async (client: SupabaseClient): Promise<number> => {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('student_assignments')
    .select(
      `student_id, assignment_id, due_at, status,
       assignments ( title, metadata )`,
    )
    .not('due_at', 'is', null)
    .lt('due_at', now)
    .neq('status', 'completed')
    .limit(80);

  if (error) {
    console.warn('[notifications] Overdue assignment scan failed', error);
    return 0;
  }

  const rows = (data as AssignmentContext[]) ?? [];
  if (!rows.length) return 0;

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(rows.map((row) => row.student_id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const payloads = buildOverdueNotifications(rows, studentRows, parentRecipients);
  return insertNotifications(client, payloads);
};

const scanLowMastery = async (client: SupabaseClient): Promise<number> => {
  const threshold = 60;
  const recentCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();

  const { data, error } = await client
    .from('student_mastery')
    .select('student_id, skill_id, mastery_pct, updated_at')
    .lt('mastery_pct', threshold)
    .gte('updated_at', recentCutoff)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('[notifications] Low mastery scan failed', error);
    return 0;
  }

  const rows = (data as MasteryContext[]) ?? [];
  if (!rows.length) return 0;

  const skillIds = Array.from(new Set(rows.map((row) => row.skill_id)));
  const { data: skillRows, error: skillError } = await client
    .from('skills')
    .select('id, subject_id, name')
    .in('id', skillIds);

  if (skillError) {
    console.warn('[notifications] Unable to load skill subjects', skillError);
  }

  const subjectIds = Array.from(
    new Set(
      (skillRows ?? [])
        .map((row) => row.subject_id as number | null)
        .filter((value): value is number => typeof value === 'number'),
    ),
  );

  const { data: subjectRows, error: subjectError } = subjectIds.length
    ? await client.from('subjects').select('id, name').in('id', subjectIds)
    : { data: [], error: null };

  if (subjectError) {
    console.warn('[notifications] Unable to load subject labels', subjectError);
  }

  const subjectMap = new Map<number, string>();
  (subjectRows ?? []).forEach((row) => {
    if (typeof row.id === 'number') {
      subjectMap.set(row.id, (row.name as string) ?? 'a focus area');
    }
  });

  const subjectNameBySkill = new Map<number, string>();
  (skillRows ?? []).forEach((row) => {
    const subjectId = row.subject_id as number | null;
    subjectNameBySkill.set(row.id as number, subjectId ? subjectMap.get(subjectId) ?? 'a focus area' : 'a focus area');
  });

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(rows.map((row) => row.student_id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const payloads = buildLowMasteryNotifications(rows, studentRows, parentRecipients, subjectNameBySkill);
  return insertNotifications(client, payloads);
};

const scanSkillMastered = async (client: SupabaseClient): Promise<number> => {
  const threshold = 85;
  const recentCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();

  const { data, error } = await client
    .from('student_mastery')
    .select('student_id, skill_id, mastery_pct, updated_at')
    .gte('mastery_pct', threshold)
    .gte('updated_at', recentCutoff)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('[notifications] Skill mastered scan failed', error);
    return 0;
  }

  const rows = (data as MasteryContext[]) ?? [];
  if (!rows.length) return 0;

  const skillIds = Array.from(new Set(rows.map((row) => row.skill_id)));
  const { data: skillRows, error: skillError } = await client
    .from('skills')
    .select('id, subject_id, name')
    .in('id', skillIds);

  if (skillError) {
    console.warn('[notifications] Unable to load mastered skill subjects', skillError);
  }

  const subjectIds = Array.from(
    new Set(
      (skillRows ?? [])
        .map((row) => row.subject_id as number | null)
        .filter((value): value is number => typeof value === 'number'),
    ),
  );

  const { data: subjectRows, error: subjectError } = subjectIds.length
    ? await client.from('subjects').select('id, name').in('id', subjectIds)
    : { data: [], error: null };

  if (subjectError) {
    console.warn('[notifications] Unable to load mastered subject labels', subjectError);
  }

  const subjectMap = new Map<number, string>();
  (subjectRows ?? []).forEach((row) => {
    if (typeof row.id === 'number') {
      subjectMap.set(row.id, (row.name as string) ?? 'a focus area');
    }
  });

  const subjectNameBySkill = new Map<number, string>();
  (skillRows ?? []).forEach((row) => {
    const subjectId = row.subject_id as number | null;
    subjectNameBySkill.set(row.id as number, subjectId ? subjectMap.get(subjectId) ?? 'a focus area' : 'a focus area');
  });

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(rows.map((row) => row.student_id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const payloads = buildSkillMasteredNotifications(rows, studentRows, parentRecipients, subjectNameBySkill, threshold);
  return insertNotifications(client, payloads);
};

const scanStreakMilestones = async (client: SupabaseClient): Promise<number> => {
  const milestones = [3, 5, 7, 14, 21, 30];
  const { data, error } = await client
    .from('student_profiles')
    .select('id, streak_days')
    .in('streak_days', milestones);

  if (error) {
    console.warn('[notifications] Streak scan failed', error);
    return 0;
  }

  const rows = ((data as StreakContext[]) ?? []).filter(
    (row) => typeof row.streak_days === 'number' && row.streak_days > 0,
  );
  if (!rows.length) return 0;

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(rows.map((row) => row.id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const payloads = buildStreakNotifications(rows, studentRows, parentRecipients, milestones);
  return insertNotifications(client, payloads);
};

const scanGoalProgress = async (client: SupabaseClient): Promise<number> => {
  const snapshots = await fetchParentDashboardSnapshots(client);
  if (!snapshots.length) return 0;

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(snapshots.map((row) => row.student_id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));
  const weekStart = getWeekStartIso();

  const payloads = snapshots.flatMap((row) =>
    buildGoalNotificationsFromRow(row, studentMap.get(row.student_id), parentRecipients.get(row.student_id) ?? [], weekStart),
  );

  return insertNotifications(client, payloads);
};

const scanConsistentLowPerformance = async (client: SupabaseClient): Promise<number> => {
  const snapshots = await fetchParentDashboardSnapshots(client);
  if (!snapshots.length) return 0;

  const studentRows = await fetchStudentRows(
    client,
    Array.from(new Set(snapshots.map((row) => row.student_id))),
  );
  const parentRecipients = await fetchParentRecipients(client, studentRows);
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));
  const weekStart = getWeekStartIso();

  const payloads = snapshots.flatMap((row) =>
    buildConsistentLowPerformanceNotifications(
      row,
      studentMap.get(row.student_id),
      parentRecipients.get(row.student_id) ?? [],
      weekStart,
    ),
  );

  return insertNotifications(client, payloads);
};

export class NotificationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly client: SupabaseClient,
    private readonly options: { pollIntervalMs?: number } = {},
  ) {}

  start(): void {
    if (this.timer) return;
    const interval = this.options.pollIntervalMs ?? 5 * 60 * 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const results = await Promise.allSettled([
        scanOverdueAssignments(this.client),
        scanLowMastery(this.client),
        scanStreakMilestones(this.client),
        scanSkillMastered(this.client),
        scanGoalProgress(this.client),
        scanConsistentLowPerformance(this.client),
      ]);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const buckets = ['overdue', 'low-mastery', 'streaks', 'skill-mastered', 'goal-progress', 'low-performance'];
          console.warn(`[notifications] ${buckets[index]} scan errored`, result.reason);
        }
      });
    } finally {
      this.running = false;
    }
  }
}
