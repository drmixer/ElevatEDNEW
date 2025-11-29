import { describe, expect, it } from 'vitest';
import { buildAssignmentNotifications, buildGoalNotificationsFromRow } from '../notifications.js';

describe('buildAssignmentNotifications', () => {
  it('creates notifications for students and opts out parents who disable the preference', () => {
    const studentRows = [
      { id: 'student-1', first_name: 'Avery', last_name: 'Lee' },
      { id: 'student-2', first_name: 'Sam', last_name: 'Kim' },
    ];

    const parentRecipients = new Map([
      [
        'student-1',
        [
          { id: 'parent-1', name: 'Jordan', preferences: { majorProgress: true } },
          { id: 'parent-2', name: 'Alex', preferences: { majorProgress: false } },
        ],
      ],
      ['student-2', [{ id: 'parent-3', name: 'Taylor', preferences: { majorProgress: true } }]],
    ]);

    const notifications = buildAssignmentNotifications(
      {
        assignmentId: 42,
        assignmentTitle: 'Algebra practice',
        moduleTitle: 'Algebra I',
        dueAt: '2024-09-01T00:00:00.000Z',
      },
      studentRows,
      parentRecipients,
      'sender-1',
    );

    const studentRecipients = notifications
      .filter((note) => note.notification_type === 'assignment_created')
      .map((note) => note.recipient_id);

    expect(studentRecipients).toContain('student-1');
    expect(studentRecipients).toContain('student-2');

    const parentRecipientsList = notifications
      .filter((note) => note.recipient_id.startsWith('parent'))
      .map((note) => note.recipient_id);

    expect(parentRecipientsList).toContain('parent-1');
    expect(parentRecipientsList).toContain('parent-3');
    expect(parentRecipientsList).not.toContain('parent-2');
  });
});

describe('buildGoalNotificationsFromRow', () => {
  it('emits goal-met notifications with target URLs', () => {
    const row = {
      parent_id: 'parent-1',
      student_id: 'student-1',
      first_name: 'Avery',
      last_name: 'Lee',
      lessons_completed_week: 6,
      practice_minutes_week: 240,
      weekly_lessons_target: 5,
      practice_minutes_target: 200,
      mastery_targets: { math: 80 },
      mastery_breakdown: [{ subject: 'math', mastery: 82 }],
    };

    const parents = [{ id: 'parent-1', name: 'Jordan', preferences: { majorProgress: true } }];
    const student = { id: 'student-1', first_name: 'Avery', last_name: 'Lee' };

    const notifications = buildGoalNotificationsFromRow(row as never, student as never, parents as never, '2024-09-02');

    const types = notifications.map((note) => note.notification_type);
    expect(types).toContain('goal_met');

    const parentNote = notifications.find((note) => note.recipient_id === 'parent-1');
    expect(parentNote?.data?.targetUrl).toBe('/parent#weekly-snapshot');

    const studentNote = notifications.find((note) => note.recipient_id === 'student-1');
    expect(studentNote?.data?.targetUrl).toBe('/student');
  });
});
