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
  progressSummary?: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
}

export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';

export interface AssignmentSummary {
  id: number;
  title: string;
  status: AssignmentStatus;
  dueAt: string | null;
  moduleId?: number | null;
  moduleTitle?: string | null;
  studentId: string;
}

export interface AdminAssignmentOverview {
  assignmentId: number;
  moduleId: number | null;
  moduleTitle: string | null;
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  dueAt: string | null;
  createdAt: string | null;
}

export interface AdminStudent {
  id: string;
  grade: number | null;
  firstName: string | null;
  lastName: string | null;
}

export interface CatalogFilters {
  subject?: string;
  grade?: string;
  strand?: string;
  topic?: string;
  standards?: string[];
  openTrack?: boolean;
  sort?: 'featured' | 'title-asc' | 'title-desc' | 'grade-asc' | 'grade-desc';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CatalogModule {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  gradeBand: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  openTrack: boolean;
  suggestedSourceCategory: string | null;
  exampleSource: string | null;
}

export interface ModuleAsset {
  id: number;
  lessonId: number | null;
  title: string | null;
  description: string | null;
  url: string;
  kind: string;
  license: string;
  licenseUrl: string | null;
  attributionText: string | null;
  tags: string[];
}

export interface ModuleLesson {
  id: number;
  title: string;
  content: string;
  estimatedDurationMinutes: number | null;
  attributionBlock: string;
  openTrack: boolean;
  assets: ModuleAsset[];
}

export interface LessonNavigationItem {
  id: number;
  title: string;
  estimatedDurationMinutes: number | null;
  openTrack: boolean;
}

export interface LessonDetail {
  lesson: ModuleLesson;
  module: CatalogModule;
  moduleLessons: LessonNavigationItem[];
  standards: ModuleStandard[];
}

export interface ModuleStandard {
  id: number;
  framework: string;
  code: string;
  description: string | null;
  alignmentStrength: string | null;
  notes: string | null;
}

export interface ModuleAssessmentSummary {
  id: number;
  title: string;
  description: string | null;
  estimatedDurationMinutes: number | null;
  questionCount: number;
  attemptCount: number;
  completionRate: number;
  averageScore: number | null;
  purpose: string | null;
}

export interface ModuleAssessmentOption {
  id: number;
  order: number;
  content: string;
  isCorrect: boolean;
  feedback: string | null;
}

export interface ModuleAssessmentQuestion {
  id: number;
  prompt: string;
  type: string;
  difficulty: number | null;
  explanation: string | null;
  standards: string[];
  tags: string[];
  options: ModuleAssessmentOption[];
}

export interface ModuleAssessmentSection {
  id: number;
  title: string;
  instructions: string | null;
  questions: ModuleAssessmentQuestion[];
}

export interface ModuleAssessmentDetail {
  id: number;
  title: string;
  description: string | null;
  estimatedDurationMinutes: number | null;
  purpose: string | null;
  sections: ModuleAssessmentSection[];
}

export interface ModuleDetail {
  module: {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    description: string | null;
    notes: string | null;
    gradeBand: string;
    subject: string;
    strand: string | null;
    topic: string | null;
    openTrack: boolean;
    suggestedSourceCategory: string | null;
    exampleSource: string | null;
    licenseRequirement: string | null;
  };
  lessons: ModuleLesson[];
  moduleAssets: ModuleAsset[];
  standards: ModuleStandard[];
  assessments: ModuleAssessmentSummary[];
}

export interface RecommendationItem {
  id: number;
  slug: string;
  title: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  gradeBand: string;
  summary: string | null;
  openTrack: boolean;
  reason: string;
  fallback: boolean;
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
  lessonCompletionRate?: number;
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
