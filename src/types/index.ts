export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'parent';
  avatar?: string;
  grade?: number;
  xp?: number;
  level?: number;
  badges?: Badge[];
  streakDays?: number;
}

export interface Student extends User {
  role: 'student';
  parentId?: string;
  grade: number;
  xp: number;
  level: number;
  badges: Badge[];
  streakDays: number;
  strengths: string[];
  weaknesses: string[];
  learningPath: LearningPathItem[];
  assessmentCompleted: boolean;
}

export interface Parent extends User {
  role: 'parent';
  children: Student[];
  subscriptionTier: 'free' | 'premium';
  notifications: NotificationPreferences;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface LearningPathItem {
  id: string;
  subject: Subject;
  topic: string;
  concept: string;
  difficulty: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  xpReward: number;
}

export interface Assessment {
  id: string;
  subject: Subject;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Answer[];
  adaptiveDifficulty: number;
  timeSpent: number;
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  concept: string;
}

export interface Answer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface NotificationPreferences {
  weeklyReports: boolean;
  missedSessions: boolean;
  lowScores: boolean;
  majorProgress: boolean;
}

export type Subject = 'math' | 'english' | 'science' | 'social_studies';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export interface PerformanceData {
  subject: Subject;
  mastery: number;
  timeSpent: number;
  questionsAnswered: number;
  averageScore: number;
  conceptProgress: { [concept: string]: number };
}