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
  parentId?: string | null;
  familyLinkCode?: string | null;
  grade: number;
  xp: number;
  level: number;
  badges: Badge[];
  streakDays: number;
  tutorName?: string | null;
  tutorAvatarId?: string | null;
  studentAvatarId?: string | null;
  strengths: string[];
  weaknesses: string[];
  learningPath: LearningPathItem[];
  learningPreferences: LearningPreferences;
  assessmentCompleted: boolean;
}

export interface Parent extends User {
  role: 'parent';
  children: ParentChildSnapshot[];
  subscriptionTier: 'free' | 'plus' | 'pro' | 'premium';
  notifications: NotificationPreferences;
  weeklyReport?: ParentWeeklyReport | null;
  onboardingState?: ParentOnboardingState;
}

export type ParentCheckInStatus = 'sent' | 'delivered' | 'seen';

export interface ParentCheckIn {
  id: string;
  parentId: string;
  studentId: string;
  message: string;
  topic?: string | null;
  status: ParentCheckInStatus;
  deliveredAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
}

export type BadgeCategory =
  | 'math'
  | 'reading'
  | 'science'
  | 'social_studies'
  | 'study_skills'
  | 'streak'
  | 'milestone'
  | 'general';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category?: BadgeCategory;
}

export type MissionCadence = 'daily' | 'weekly';
export type MissionStatus = 'not_started' | 'in_progress' | 'completed';

export interface MissionTask {
  label: string;
  target: number;
  progress: number;
  unit: 'lessons' | 'minutes' | 'xp' | 'streak';
  subject?: Subject | 'any';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  tasks: MissionTask[];
  rewardXp: number;
  rewardBadgeId?: string | null;
  expiresAt?: string | null;
  status: MissionStatus;
  highlight?: string;
}

export type CelebrationKind = 'streak' | 'badge' | 'assessment' | 'mastery' | 'milestone' | 'level' | 'avatar' | 'mission';

export interface CelebrationMoment {
  id: string;
  title: string;
  description: string;
  kind: CelebrationKind;
  occurredAt: string;
  studentId?: string;
  prompt?: string;
  notifyParent?: boolean;
}

export interface AvatarOption {
  id: string;
  label: string;
  description: string;
  minXp?: number;
  requiredBadges?: string[];
  requiredStreak?: number;
  palette: {
    background: string;
    accent: string;
    text: string;
  };
  icon: string;
  rarity?: 'starter' | 'rare' | 'epic';
  kind?: 'student' | 'tutor';
  tags?: string[];
  tone?: 'calm' | 'encouraging' | 'bold' | 'structured' | 'concise';
}

export interface LearningPathItem {
  id: string;
  subject: Subject;
  topic: string;
  concept: string;
  difficulty: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  xpReward: number;
  moduleSlug?: string;
  strand?: string;
  standardCodes?: string[];
}

export type SessionLengthPreference = 'short' | 'standard' | 'long';

export interface LearningPreferences {
  sessionLength: SessionLengthPreference;
  focusSubject: Subject | 'balanced';
  focusIntensity: 'balanced' | 'focused';
  weeklyPlanIntensity?: 'light' | 'normal' | 'challenge';
  weeklyPlanFocus?: Subject | 'balanced';
  weeklyIntent?: 'precision' | 'speed' | 'stretch' | 'balanced';
  mixInMode?: 'auto' | 'core_only' | 'cross_subject';
  electiveEmphasis?: 'off' | 'light' | 'on';
  allowedElectiveSubjects?: Subject[];
  chatMode?: 'guided_only' | 'guided_preferred' | 'free';
  chatModeLocked?: boolean;
  studyMode?: 'catch_up' | 'keep_up' | 'get_ahead';
  studyModeSetAt?: string | null;
  studyModeLocked?: boolean;
  allowTutor?: boolean;
  tutorLessonOnly?: boolean;
  tutorDailyLimit?: number | null;
  tutorSettingsUpdatedAt?: string | null;
  tutorSettingsUpdatedBy?: string | null;
}

export const defaultLearningPreferences: LearningPreferences = {
  sessionLength: 'standard',
  focusSubject: 'balanced',
  focusIntensity: 'balanced',
  weeklyPlanIntensity: 'normal',
  weeklyPlanFocus: 'balanced',
  weeklyIntent: 'balanced',
  mixInMode: 'auto',
  electiveEmphasis: 'light',
  allowedElectiveSubjects: [],
  chatMode: 'free',
  chatModeLocked: false,
  studyMode: 'keep_up',
  studyModeSetAt: null,
  studyModeLocked: false,
  allowTutor: true,
  tutorLessonOnly: false,
  tutorDailyLimit: null,
  tutorSettingsUpdatedAt: null,
  tutorSettingsUpdatedBy: null,
};

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
  optionId?: number | null;
  bankQuestionId?: number;
}

export interface LessonPracticeOption {
  id: number;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
}

export interface LessonPracticeQuestion {
  id: number;
  prompt: string;
  type: Question['type'] | 'essay';
  explanation?: string | null;
  options: LessonPracticeOption[];
  skillIds: number[];
}

export interface NotificationPreferences {
  weeklyReports: boolean;
  missedSessions: boolean;
  lowScores: boolean;
  majorProgress: boolean;
  assignments?: boolean;
  streaks?: boolean;
  weeklyReportsLearner?: boolean;
}

export type NotificationType =
  | 'assignment_created'
  | 'assignment_overdue'
  | 'low_mastery'
  | 'streak_milestone'
  | 'skill_mastered'
  | 'goal_met'
  | 'consistent_low_performance'
  | string;

export interface NotificationItem {
  id: number;
  notificationType: NotificationType;
  title?: string | null;
  body?: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export type ConcernCategory = 'safety' | 'content' | 'data' | 'account' | 'billing' | 'other';
export type ConcernStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export interface ConcernReport {
  id: number;
  caseId: string;
  requesterId: string;
  studentId?: string | null;
  category: ConcernCategory;
  status: ConcernStatus;
  description: string;
  contactEmail?: string | null;
  screenshotUrl?: string | null;
  route: 'trust' | 'privacy' | 'support';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ParentOnboardingState = {
  tourCompleted?: boolean;
  tourCompletedAt?: string | null;
  guideCompleted?: boolean;
  guideCompletedAt?: string | null;
  lastViewedStep?: string | null;
};

export type Subject =
  | 'math'
  | 'english'
  | 'science'
  | 'social_studies'
  | 'study_skills'
  | 'arts_music'
  | 'financial_literacy'
  | 'health_pe'
  | 'computer_science';

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
  moduleSlug?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  launchUrl?: string | null;
  suggestionReason?: string | null;
  suggestionConfidence?: number | null;
  activities?: DashboardActivity[];
  isMixIn?: boolean;
  isElective?: boolean;
}

export interface DashboardActivity {
  id: string;
  moduleSlug: string;
  lessonSlug?: string | null;
  title: string;
  description?: string | null;
  kind: string;
  activityType?: 'teacher_led' | 'independent' | 'reflection' | 'project' | string;
  estimatedMinutes?: number | null;
  difficulty?: number | null;
  skills?: string[];
  standards?: string[];
  homeExtension?: boolean;
  url?: string | null;
  tags?: string[];
}

export interface SubjectMastery {
  subject: Subject;
  mastery: number;
  trend: 'up' | 'down' | 'steady';
  cohortAverage?: number;
  goal?: number;
  delta?: number;
}

export interface SubjectWeeklyTrend {
  subject: Subject;
  mastery?: number | null;
  accuracyDelta?: number | null;
  timeDelta?: number | null;
  timeMinutes?: number | null;
  direction: 'up' | 'down' | 'steady';
}

export interface SkillGapInsight {
  subject: Subject;
  mastery: number;
  status: 'needs_attention' | 'watch' | 'improving';
  summary: string;
  concepts: string[];
  actions: string[];
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

export interface StudentReflection {
  id: string;
  studentId: string;
  questionId: string;
  responseText: string;
  lessonId?: string;
  subject?: string;
  sentiment?: string;
  shareWithParent?: boolean;
  createdAt: Date;
}

export interface StudentDashboardData {
  profile: Student;
  parentGoals?: ChildGoalTargets | null;
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
  missions?: Mission[];
  celebrationMoments?: CelebrationMoment[];
  reflections?: StudentReflection[];
  avatarOptions?: AvatarOption[];
  equippedAvatarId?: string | null;
  todayActivities?: DashboardActivity[];
  electiveSuggestion?: DashboardLesson | null;
}

export interface ParentCoachingSuggestion {
  id: string;
  subject: Subject;
  action: string;
  timeMinutes: number;
  why: string;
  source: 'library' | 'fallback';
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
  weeklyChange?: {
    lessons: number;
    minutes: number;
    xp: number;
    deltaLessons: number;
    deltaMinutes: number;
    deltaXp: number;
  };
  masteryBySubject: SubjectMastery[];
  subjectTrends?: SubjectWeeklyTrend[];
  recentActivity: ParentChildActivity[];
  goals?: ChildGoalTargets;
  goalProgress?: number;
  cohortComparison?: number;
  progressSummary?: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  diagnosticStatus?: 'not_started' | 'scheduled' | 'in_progress' | 'completed';
  diagnosticCompletedAt?: string | null;
  masteryConfidence?: number | null;
  adaptivePlanNotes?: string[];
  skillGaps?: SkillGapInsight[];
  homeExtensions?: DashboardActivity[];
  learningPreferences?: LearningPreferences;
  subjectStatuses?: Array<{
    subject: Subject;
    status: 'on_track' | 'at_risk' | 'off_track';
    drivers: string[];
    recommendation: string;
  }>;
  coachingSuggestions?: ParentCoachingSuggestion[];
}

export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';

export type GuardianLinkStatus = 'pending' | 'active' | 'revoked';

export type ChildGoalTargets = {
  weeklyLessons?: number | null;
  practiceMinutes?: number | null;
  masteryTargets?: Partial<Record<Subject, number>> | null;
};

export type GuardianChildLink = {
  id: number;
  studentId: string;
  parentId: string;
  relationship?: string | null;
  status: GuardianLinkStatus;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export interface AssignmentSummary {
  id: number;
  title: string;
  status: AssignmentStatus;
  dueAt: string | null;
  moduleId?: number | null;
  moduleTitle?: string | null;
  studentId: string;
  checkpointScore?: number | null;
  tutorChatCount?: number | null;
  completedAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  auditSource?: string | null;
  evidence?: Record<string, unknown>;
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
  changes?: {
    improvements: string[];
    risks: string[];
  };
}

export interface ParentDashboardData {
  parent: Parent;
  children: ParentChildSnapshot[];
  alerts: ParentAlert[];
  activitySeries: ParentActivityPoint[];
  weeklyReport?: ParentWeeklyReport | null;
  downloadableReport?: string;
  celebrations?: CelebrationMoment[];
  celebrationPrompts?: string[];
}

export interface ParentActivityPoint {
  date: string;
  lessonsCompleted: number;
  practiceMinutes: number;
}

export type PrivacyRequestType = 'export' | 'erasure';
export type PrivacyRequestStatus = 'pending' | 'in_review' | 'fulfilled' | 'rejected';

export type AccountDeletionScope = 'parent_only' | 'parent_and_students' | 'students_only';
export type AccountDeletionStatus = 'pending' | 'completed' | 'canceled';

export interface PrivacyRequest {
  id: number;
  requesterId: string;
  studentId: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  contactEmail?: string | null;
  reason?: string | null;
  adminNotes?: string | null;
  handledBy?: string | null;
  updatedAt: string;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface AccountDeletionRequest {
  id: number;
  requesterId: string;
  scope: AccountDeletionScope;
  includeStudentIds: string[];
  reason: string | null;
  contactEmail: string | null;
  status: AccountDeletionStatus;
  createdAt: string;
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
