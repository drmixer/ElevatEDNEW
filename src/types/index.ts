export type UserRole = 'student' | 'parent' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  children: ParentChildSnapshot[];
  subscriptionTier: 'free' | 'premium';
  notifications: NotificationPreferences;
  weeklyReport?: ParentWeeklyReport | null;
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
  role?: 'user' | 'assistant';
}

export interface PerformanceData {
  subject: Subject;
  mastery: number;
  timeSpent: number;
  questionsAnswered: number;
  averageScore: number;
  conceptProgress: { [concept: string]: number };
}

export interface Admin extends User {
  role: 'admin';
  title?: string;
  permissions: string[];
}

export type LessonDifficulty = 'easy' | 'medium' | 'hard';

export interface DashboardLesson {
  id: string;
  subject: Subject;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  difficulty: LessonDifficulty;
  xpReward: number;
  dueAt?: string | null;
  completedAt?: string | null;
  launchUrl?: string | null;
}

export interface SubjectMastery {
  subject: Subject;
  mastery: number;
  trend: 'up' | 'down' | 'steady';
  cohortAverage?: number;
  goal?: number;
  delta?: number;
}

export interface StudentDailyActivity {
  date: string;
  lessonsCompleted: number;
  practiceMinutes: number;
  aiSessions: number;
  xpEarned: number;
  streakPreserved: boolean;
}

export interface XPTimelinePoint {
  date: string;
  xpEarned: number;
  description: string;
}

export interface AssessmentSummary {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: 'scheduled' | 'completed' | 'overdue';
  masteryTarget?: number;
}

export interface StudentDashboardData {
  profile: Student;
  quickStats: {
    totalXp: number;
    level: number;
    streakDays: number;
    hoursThisWeek: number;
    assessmentCompleted: boolean;
  };
  todaysPlan: DashboardLesson[];
  subjectMastery: SubjectMastery[];
  dailyActivity: StudentDailyActivity[];
  recentBadges: Badge[];
  xpTimeline: XPTimelinePoint[];
  aiRecommendations: string[];
  upcomingAssessments: AssessmentSummary[];
  activeLessonId?: string | null;
  nextLessonUrl?: string | null;
}

export interface ParentChildSnapshot {
  id: string;
  name: string;
  grade: number;
  level: number;
  xp: number;
  streakDays: number;
  strengths: string[];
  focusAreas: string[];
  lessonsCompletedWeek: number;
  practiceMinutesWeek: number;
  xpEarnedWeek: number;
  masteryBySubject: SubjectMastery[];
  recentActivity: ParentChildActivity[];
  goalProgress?: number;
  cohortComparison?: number;
}

export interface ParentChildActivity {
  id: string;
  description: string;
  subject: Subject;
  xp: number;
  occurredAt: string;
}

export interface ParentAlert {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
  createdAt: string;
  studentId?: string;
}

export interface ParentWeeklyReport {
  weekStart: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  aiGenerated?: boolean;
}

export interface ParentDashboardData {
  parent: Parent;
  children: ParentChildSnapshot[];
  alerts: ParentAlert[];
  activitySeries: ParentActivityPoint[];
  weeklyReport?: ParentWeeklyReport | null;
  downloadableReport?: string;
}

export interface ParentActivityPoint {
  date: string;
  lessonsCompleted: number;
  practiceMinutes: number;
}

export interface AdminDashboardMetrics {
  totalStudents: number;
  totalParents: number;
  totalAdmins: number;
  activeStudents7d: number;
  practiceMinutes7d: number;
  assessments30d: number;
  xpEarned30d: number;
  averageStudentXp: number;
  activeSubscriptions: number;
}

export interface AdminSubjectPerformance {
  subject: Subject;
  mastery: number;
  trend: number;
}

export interface AdminGrowthPoint {
  date: string;
  newStudents: number;
  activeStudents: number;
}

export interface AdminAlert {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  createdAt: string;
}

export interface AdminTopStudent {
  id: string;
  name: string;
  grade: number;
  xpEarnedWeek: number;
  lessonsCompletedWeek: number;
}

export interface AdminDashboardData {
  admin: Admin;
  metrics: AdminDashboardMetrics;
  growthSeries: AdminGrowthPoint[];
  subjectPerformance: AdminSubjectPerformance[];
  alerts: AdminAlert[];
  topStudents: AdminTopStudent[];
}
