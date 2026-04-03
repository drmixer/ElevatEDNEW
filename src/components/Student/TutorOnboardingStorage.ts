const tutorOnboardingKey = (studentId: string) => `tutor-onboarding-done-${studentId}`;

export const shouldShowTutorOnboarding = (studentId: string): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(tutorOnboardingKey(studentId)) == null;
};

export const markTutorOnboardingDone = (studentId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(tutorOnboardingKey(studentId), 'true');
};

export const resetTutorOnboarding = (studentId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(tutorOnboardingKey(studentId));
};
