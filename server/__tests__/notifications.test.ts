import { describe, expect, it } from 'vitest';
import { buildAssignmentNotifications } from '../notifications.js';

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

