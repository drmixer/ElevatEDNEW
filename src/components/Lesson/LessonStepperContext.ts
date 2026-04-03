import { createContext, useContext } from 'react';

import type { LessonStepperContextValue } from '../../types/lesson';

export const LessonStepperContext = createContext<LessonStepperContextValue | null>(null);

export const useLessonStepper = (): LessonStepperContextValue => {
  const context = useContext(LessonStepperContext);
  if (!context) {
    throw new Error('useLessonStepper must be used within a LessonStepperProvider');
  }
  return context;
};
