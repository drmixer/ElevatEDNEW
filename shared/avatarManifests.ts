export type AvatarManifest = {
  id: string;
  kind: 'student' | 'tutor';
  label: string;
  description: string;
  palette: {
    background: string;
    accent: string;
    text: string;
  };
  icon: string;
  rarity?: 'starter' | 'rare' | 'epic' | 'legendary';
  minXp?: number;
  requiredStreak?: number;
  requiredBadges?: string[];
  tags?: string[];
  tone?: 'calm' | 'encouraging' | 'bold' | 'structured' | 'concise';
};

export const STUDENT_AVATARS: AvatarManifest[] = [
  {
    id: 'avatar-starter',
    kind: 'student',
    label: 'Starter Spark',
    description: 'Default companion for new learners.',
    palette: { background: '#E0F2FE', accent: '#0EA5E9', text: '#0F172A' },
    icon: '✨',
    rarity: 'starter',
    tags: ['friendly', 'default'],
  },
  {
    id: 'avatar-trailblazer',
    kind: 'student',
    label: 'Trailblazer',
    description: 'Earn 500 XP to unlock this explorer.',
    minXp: 500,
    palette: { background: '#ECFDF3', accent: '#10B981', text: '#064E3B' },
    icon: '🧭',
    rarity: 'rare',
    tags: ['adventure'],
  },
  {
    id: 'avatar-streak-ember',
    kind: 'student',
    label: 'Streak Ember',
    description: 'Stay active 7 days in a row to glow bright.',
    requiredStreak: 7,
    palette: { background: '#FEF3C7', accent: '#F59E0B', text: '#78350F' },
    icon: '🔥',
    rarity: 'rare',
    tags: ['streak'],
  },
  {
    id: 'avatar-aurora-wave',
    kind: 'student',
    label: 'Aurora Wave',
    description: 'Hit 800 XP to light up this calm gradient.',
    minXp: 800,
    palette: { background: '#EEF2FF', accent: '#6366F1', text: '#1E1B4B' },
    icon: '🌅',
    rarity: 'rare',
    tags: ['calm'],
  },
  {
    id: 'avatar-summit-owl',
    kind: 'student',
    label: 'Summit Owl',
    description: '1200 XP shows your steady focus and patience.',
    minXp: 1200,
    palette: { background: '#F8FAFC', accent: '#475569', text: '#0F172A' },
    icon: '🦉',
    rarity: 'rare',
    tags: ['focus'],
  },
  {
    id: 'avatar-prism-pop',
    kind: 'student',
    label: 'Prism Pop',
    description: 'Earn 1000 XP for this bright, artsy set.',
    minXp: 1000,
    palette: { background: '#FFF7ED', accent: '#FB923C', text: '#7C2D12' },
    icon: '🎨',
    rarity: 'rare',
    tags: ['playful'],
  },
  {
    id: 'avatar-comet-scout',
    kind: 'student',
    label: 'Comet Scout',
    description: 'Keep a 14-day streak or reach 1600 XP to trail the stars.',
    minXp: 1600,
    requiredStreak: 14,
    palette: { background: '#F5F3FF', accent: '#A855F7', text: '#312E81' },
    icon: '☄️',
    rarity: 'epic',
    tags: ['streak', 'momentum'],
  },
  {
    id: 'avatar-guardian-crest',
    kind: 'student',
    label: 'Guardian Crest',
    description: 'Reach 2000 XP to unlock this confident shield.',
    minXp: 2000,
    palette: { background: '#EFF6FF', accent: '#2563EB', text: '#0B2548' },
    icon: '🛡️',
    rarity: 'epic',
    tags: ['confidence'],
  },
];

export const TUTOR_AVATARS: AvatarManifest[] = [
  {
    id: 'tutor-calm-coach',
    kind: 'tutor',
    label: 'Calm Coach',
    description: 'Steady, patient tutor who keeps you encouraged without rushing.',
    palette: { background: '#E0F2FE', accent: '#0284C7', text: '#0B172A' },
    icon: '🌊',
    tone: 'calm',
  },
  {
    id: 'tutor-step-guide',
    kind: 'tutor',
    label: 'Step-by-Step Guide',
    description: 'Breaks work into small steps and checks understanding often.',
    palette: { background: '#EEF2FF', accent: '#6366F1', text: '#312E81' },
    icon: '🧭',
    tone: 'structured',
  },
  {
    id: 'tutor-hype-coach',
    kind: 'tutor',
    label: 'Hype Coach',
    description: 'High-energy motivator who keeps responses short and upbeat.',
    palette: { background: '#FFF1F2', accent: '#EC4899', text: '#4A044E' },
    icon: '✨',
    tone: 'bold',
  },
  {
    id: 'tutor-quiet-expert',
    kind: 'tutor',
    label: 'Quiet Expert',
    description: 'Concise helper who gets to the point with minimal fluff.',
    palette: { background: '#F8FAFC', accent: '#94A3B8', text: '#0F172A' },
    icon: '📘',
    tone: 'concise',
  },
];

export const findStudentAvatar = (id: string): AvatarManifest | undefined =>
  STUDENT_AVATARS.find((avatar) => avatar.id === id);

export const findTutorAvatar = (id: string): AvatarManifest | undefined =>
  TUTOR_AVATARS.find((avatar) => avatar.id === id);

export const isStudentAvatarUnlocked = (
  avatar: AvatarManifest,
  progress: { xp?: number | null; streakDays?: number | null },
): boolean => {
  if (avatar.kind !== 'student') return false;
  const xp = progress.xp ?? 0;
  const streak = progress.streakDays ?? 0;
  const meetsXp = avatar.minXp ? xp >= avatar.minXp : true;
  const meetsStreak = avatar.requiredStreak ? streak >= avatar.requiredStreak : true;
  return meetsXp && meetsStreak;
};
