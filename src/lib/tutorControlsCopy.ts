export const tutorControlsCopy = {
  allowLabel: 'Allow AI tutor chats',
  allowDescription: 'Turn off to pause tutor access for this learner.',
  lessonOnlyLabel: 'Limit to lesson context only',
  lessonOnlyDescription:
    'When on, the tutor will stick to the active lesson and decline unrelated requests.',
  capLabel: 'Max tutor chats per day',
  capDescription: 'Optional lower cap for this learner.',
  planCapHelper: 'Capped by plan; leave blank to use plan limit.',
  studentDisabledMessage:
    'Your grown-up turned off tutor chats for now. Ask them if you need it back on.',
  studentLessonOnlyMessage: 'Your grown-up set tutor help to lesson-only. Open a lesson to chat.',
};

export type TutorControlsCopy = typeof tutorControlsCopy;
