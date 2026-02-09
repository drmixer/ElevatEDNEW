import type { LessonPracticeQuestion } from '../types';

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim().toLowerCase();

const includesAny = (value: string, needles: string[]): boolean => needles.some((needle) => value.includes(needle));

export type NonMathRemediationSubject = 'english' | 'science' | 'social_studies';

export type NonMathRemediationTopic =
  | 'main_idea'
  | 'context_clues'
  | 'text_evidence'
  | 'scientific_reasoning'
  | 'ecosystems'
  | 'earth_space'
  | 'civics'
  | 'geography'
  | 'economics_history';

export type NonMathQuickReview = {
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: NonMathRemediationTopic;
};

type OptionTemplate = {
  text: string;
  isCorrect: boolean;
  feedback: string;
};

type TopicTemplate = {
  hint: string;
  steps: string[];
  quickReview: Omit<NonMathQuickReview, 'topic'>;
  challenge: {
    prompt: string;
    explanation: string;
    hint: string;
    steps: string[];
    options: OptionTemplate[];
  };
};

const ENGLISH_TEMPLATES: Record<string, TopicTemplate> = {
  main_idea: {
    hint: 'Look for the idea that most details support, not one tiny fact.',
    steps: [
      'Skim for repeated words or ideas.',
      'Group details that belong together.',
      'Pick the sentence that covers the whole paragraph.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'Which choice best identifies a main idea?',
      options: [
        'A sentence that covers what most details are about',
        'A sentence with one small detail only',
        'The first word of the paragraph',
      ],
      correctIndex: 0,
      explanation: 'Main idea is broad and supported by multiple details.',
    },
    challenge: {
      prompt: 'Challenge: Which response is the strongest main idea statement?',
      explanation: 'A strong main idea is broad enough for several details but specific to the passage topic.',
      hint: 'Ask: Can more than one detail support this statement?',
      steps: [
        'Find at least two details in common.',
        'Remove choices that are too narrow.',
        'Choose the statement that fits all key details.',
      ],
      options: [
        {
          text: 'It combines the central point that several details support.',
          isCorrect: true,
          feedback: 'Correct. Main ideas connect multiple details into one central point.',
        },
        {
          text: 'It focuses on one interesting fact from one sentence.',
          isCorrect: false,
          feedback: 'That is usually a detail, not the main idea.',
        },
        {
          text: 'It repeats the title without checking details.',
          isCorrect: false,
          feedback: 'A title hint can help, but details must confirm the main idea.',
        },
        {
          text: 'It chooses the longest sentence automatically.',
          isCorrect: false,
          feedback: 'Sentence length does not determine main idea.',
        },
      ],
    },
  },
  context_clues: {
    hint: 'Read the words before and after the unknown word for clues about meaning.',
    steps: [
      'Reread the sentence around the word.',
      'Look for synonym, antonym, or example clues.',
      'Replace with a candidate meaning and check if it still makes sense.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'What is the best first move when you see an unknown word?',
      options: [
        'Use nearby words in the sentence as clues',
        'Skip the word and guess later',
        'Pick the longest dictionary definition',
      ],
      correctIndex: 0,
      explanation: 'Context clues from nearby words are the fastest and most accurate first step.',
    },
    challenge: {
      prompt: 'Challenge: Choose the best strategy to infer word meaning in context.',
      explanation: 'Strong readers test possible meanings against sentence context before deciding.',
      hint: 'Try replacing the unknown word and reread the sentence.',
      steps: [
        'Use nearby clue words.',
        'Test one meaning in the sentence.',
        'Keep the meaning that matches tone and logic.',
      ],
      options: [
        {
          text: 'Use nearby clues, test a meaning, and keep the one that fits.',
          isCorrect: true,
          feedback: 'Correct. That is the standard context clue strategy.',
        },
        {
          text: 'Pick the fanciest meaning so the sentence sounds advanced.',
          isCorrect: false,
          feedback: 'Meaning must match context, not style.',
        },
        {
          text: 'Ignore context and choose by word length.',
          isCorrect: false,
          feedback: 'Word length does not reveal meaning.',
        },
        {
          text: 'Wait until the end and never check sentence clues.',
          isCorrect: false,
          feedback: 'Context clues are most useful immediately.',
        },
      ],
    },
  },
  text_evidence: {
    hint: 'Pick evidence that directly supports the claim, not a loosely related detail.',
    steps: [
      'Find the exact claim or question.',
      'Scan for a line that directly proves it.',
      'Explain how that evidence connects to the claim.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'What makes evidence strong?',
      options: [
        'It directly supports the claim with specific details',
        'It sounds impressive even if off-topic',
        'It repeats the question only',
      ],
      correctIndex: 0,
      explanation: 'Strong evidence is specific and directly tied to the claim.',
    },
    challenge: {
      prompt: 'Challenge: Which option is the strongest text evidence choice?',
      explanation: 'Best evidence is precise, relevant, and directly connected to the claim.',
      hint: 'Choose the detail that would convince someone who disagrees.',
      steps: [
        'Underline the claim.',
        'Match details that directly support it.',
        'Reject details that are interesting but unrelated.',
      ],
      options: [
        {
          text: 'A specific quote or fact that directly proves the claim.',
          isCorrect: true,
          feedback: 'Correct. Direct and specific evidence is strongest.',
        },
        {
          text: 'A broad opinion with no text support.',
          isCorrect: false,
          feedback: 'Opinion alone is not evidence.',
        },
        {
          text: 'A detail from another topic in the text.',
          isCorrect: false,
          feedback: 'Relevant topic match is required.',
        },
        {
          text: 'A sentence that sounds similar but proves nothing.',
          isCorrect: false,
          feedback: 'Similarity is not the same as proof.',
        },
      ],
    },
  },
};

const SCIENCE_TEMPLATES: Record<string, TopicTemplate> = {
  scientific_reasoning: {
    hint: 'Look for what can be observed, measured, or tested.',
    steps: [
      'Identify the claim.',
      'Ask if the claim is testable with data.',
      'Choose evidence from observations or measurements.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'Which statement is most testable in science?',
      options: [
        'A claim that can be measured with an experiment',
        'A claim based only on opinion',
        'A claim that cannot be observed',
      ],
      correctIndex: 0,
      explanation: 'Science uses testable claims backed by observations and measurements.',
    },
    challenge: {
      prompt: 'Challenge: Which choice best shows scientific reasoning?',
      explanation: 'Scientific reasoning links a testable claim to measurable evidence.',
      hint: 'Look for data or observations that can be checked.',
      steps: [
        'Check whether the claim is testable.',
        'Find evidence with measurements or observations.',
        'Connect the evidence back to the claim.',
      ],
      options: [
        {
          text: 'Use data from an experiment to support a testable claim.',
          isCorrect: true,
          feedback: 'Correct. Testable claims supported by data are core scientific reasoning.',
        },
        {
          text: 'Use a personal preference as proof.',
          isCorrect: false,
          feedback: 'Preferences are not scientific evidence.',
        },
        {
          text: 'Avoid measurements and decide by intuition only.',
          isCorrect: false,
          feedback: 'Measurements improve reliability.',
        },
        {
          text: 'Ignore observations that disagree with the claim.',
          isCorrect: false,
          feedback: 'All relevant evidence should be considered.',
        },
      ],
    },
  },
  ecosystems: {
    hint: 'Track how living things depend on each other and on resources.',
    steps: [
      'Identify producers, consumers, and decomposers.',
      'Follow energy flow through the food chain or web.',
      'Predict what changes if one part is removed.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'Why are producers important in an ecosystem?',
      options: [
        'They make energy-rich food that supports other organisms',
        'They eat all consumers',
        'They remove sunlight from ecosystems',
      ],
      correctIndex: 0,
      explanation: 'Producers capture energy and start most food chains.',
    },
    challenge: {
      prompt: 'Challenge: What is the best prediction when a key species declines?',
      explanation: 'Ecosystem parts are connected, so one change often affects many organisms.',
      hint: 'Think about who depends on that species for food or balance.',
      steps: [
        'Identify what role the species plays.',
        'Find organisms that depend on it.',
        'Predict how populations might rise or fall.',
      ],
      options: [
        {
          text: 'Connected populations are likely to change because food-web links shift.',
          isCorrect: true,
          feedback: 'Correct. Ecosystem interactions cause ripple effects.',
        },
        {
          text: 'Nothing changes because species are independent.',
          isCorrect: false,
          feedback: 'Species usually depend on each other.',
        },
        {
          text: 'Only weather changes, not organisms.',
          isCorrect: false,
          feedback: 'Organism populations can change directly.',
        },
        {
          text: 'All species increase in the same way.',
          isCorrect: false,
          feedback: 'Different species respond differently.',
        },
      ],
    },
  },
  earth_space: {
    hint: 'Focus on patterns: cycles, layers, and repeated natural processes.',
    steps: [
      'Name the process or cycle in the question.',
      'Identify inputs and outputs.',
      'Choose the option that matches the process order.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'What helps most when explaining Earth and space systems?',
      options: [
        'Use process patterns like cycles and cause-effect links',
        'Memorize random facts without connections',
        'Ignore sequence and timing',
      ],
      correctIndex: 0,
      explanation: 'Earth and space ideas are usually explained with recurring patterns and processes.',
    },
    challenge: {
      prompt: 'Challenge: Which explanation best matches an Earth or space process?',
      explanation: 'Strong answers describe the sequence and cause-effect in the process.',
      hint: 'Look for the option with a clear process order.',
      steps: [
        'Identify the process name.',
        'Check the order of steps.',
        'Verify the cause-effect relationship.',
      ],
      options: [
        {
          text: 'It explains the process in order and connects each step to a cause.',
          isCorrect: true,
          feedback: 'Correct. Process order plus cause-effect makes the explanation strong.',
        },
        {
          text: 'It lists unrelated facts with no sequence.',
          isCorrect: false,
          feedback: 'Sequence is important for process explanations.',
        },
        {
          text: 'It skips causes and gives only outcomes.',
          isCorrect: false,
          feedback: 'Causes and outcomes should both be included.',
        },
        {
          text: 'It changes topics halfway through.',
          isCorrect: false,
          feedback: 'Stay focused on the same process.',
        },
      ],
    },
  },
};

const SOCIAL_STUDIES_TEMPLATES: Record<string, TopicTemplate> = {
  civics: {
    hint: 'Match the government role to its main responsibility.',
    steps: [
      'Identify the civic role in the question.',
      'Recall the branch or institution responsibility.',
      'Choose the option that matches that responsibility.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'Which branch of the U.S. government makes laws?',
      options: ['Legislative', 'Executive', 'Judicial'],
      correctIndex: 0,
      explanation: 'The legislative branch creates laws.',
    },
    challenge: {
      prompt: 'Challenge: Which response best explains checks and balances?',
      explanation: 'Checks and balances means branches can limit each other to prevent too much power in one place.',
      hint: 'Look for an option where branches share and limit power.',
      steps: [
        'Identify which branch is taking action.',
        'Find which branch can review or limit that action.',
        'Choose the option that keeps power balanced.',
      ],
      options: [
        {
          text: 'Each branch can limit certain actions of the others.',
          isCorrect: true,
          feedback: 'Correct. That is the core idea of checks and balances.',
        },
        {
          text: 'One branch controls all final decisions.',
          isCorrect: false,
          feedback: 'That removes checks and balances.',
        },
        {
          text: 'Branches have no influence on each other.',
          isCorrect: false,
          feedback: 'Branches do interact through defined powers.',
        },
        {
          text: 'Only local governments can check federal branches.',
          isCorrect: false,
          feedback: 'Checks and balances happen among federal branches too.',
        },
      ],
    },
  },
  geography: {
    hint: 'Use map features like title, key, and scale before answering.',
    steps: [
      'Read the map title and key.',
      'Use compass directions and labels.',
      'Check scale or legend to compare locations.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'What does a map key or legend tell you?',
      options: ['What map symbols and colors mean', 'Who made the map first', 'How old the map paper is'],
      correctIndex: 0,
      explanation: 'A map key explains symbol and color meanings.',
    },
    challenge: {
      prompt: 'Challenge: Which strategy gives the most accurate map interpretation?',
      explanation: 'Accurate map reading uses title, legend, direction, and scale together.',
      hint: 'Do not rely on one feature only.',
      steps: [
        'Read title and legend first.',
        'Use direction and labels to locate features.',
        'Use scale for distance or size comparisons.',
      ],
      options: [
        {
          text: 'Use title, legend, direction, and scale together.',
          isCorrect: true,
          feedback: 'Correct. Multiple map features improve accuracy.',
        },
        {
          text: 'Use color only and ignore the legend.',
          isCorrect: false,
          feedback: 'Color meaning depends on the legend.',
        },
        {
          text: 'Guess locations without reading labels.',
          isCorrect: false,
          feedback: 'Labels are key evidence in map reading.',
        },
        {
          text: 'Ignore scale when comparing distance.',
          isCorrect: false,
          feedback: 'Scale is needed for distance comparisons.',
        },
      ],
    },
  },
  economics_history: {
    hint: 'Look for cause and effect between events, choices, and outcomes.',
    steps: [
      'Identify the decision or event.',
      'Find immediate effects and longer-term effects.',
      'Choose the option with the clearest cause-effect link.',
    ],
    quickReview: {
      title: 'Quick Review',
      prompt: 'If demand increases and supply stays the same, what usually happens to price?',
      options: ['Price tends to rise', 'Price always falls', 'Price disappears'],
      correctIndex: 0,
      explanation: 'With stable supply, higher demand typically pushes prices up.',
    },
    challenge: {
      prompt: 'Challenge: Which explanation best connects cause and effect in social studies?',
      explanation: 'Strong explanations trace how one event or policy leads to specific outcomes.',
      hint: 'Pick the option that names both the cause and its direct result.',
      steps: [
        'State the starting event or decision.',
        'Describe the immediate consequence.',
        'Connect to the larger historical or economic impact.',
      ],
      options: [
        {
          text: 'It clearly links an event or policy to specific outcomes.',
          isCorrect: true,
          feedback: 'Correct. Cause-effect clarity is essential in social studies reasoning.',
        },
        {
          text: 'It lists events without showing connections.',
          isCorrect: false,
          feedback: 'Connections are needed, not just lists.',
        },
        {
          text: 'It gives outcomes but no starting cause.',
          isCorrect: false,
          feedback: 'The cause must be explicit.',
        },
        {
          text: 'It avoids timeline or sequence details.',
          isCorrect: false,
          feedback: 'Sequence helps explain cause and effect.',
        },
      ],
    },
  },
};

const TOPIC_KEYWORDS: Record<NonMathRemediationSubject, Array<{ topic: NonMathRemediationTopic; needles: string[] }>> = {
  english: [
    { topic: 'context_clues', needles: ['context clue', 'vocabulary', 'word meaning', 'meaning of the word'] },
    { topic: 'text_evidence', needles: ['text evidence', 'evidence', 'claim', 'argument', 'infer', 'inference'] },
    { topic: 'main_idea', needles: ['main idea', 'central idea', 'summary', 'summarize', 'theme', 'details'] },
  ],
  science: [
    { topic: 'ecosystems', needles: ['ecosystem', 'food chain', 'food web', 'habitat', 'organism', 'producer', 'consumer'] },
    { topic: 'earth_space', needles: ['weather', 'climate', 'rock cycle', 'water cycle', 'planet', 'earth', 'space', 'moon'] },
    { topic: 'scientific_reasoning', needles: ['hypothesis', 'experiment', 'observe', 'data', 'variable', 'investigation'] },
  ],
  social_studies: [
    { topic: 'civics', needles: ['government', 'civic', 'constitution', 'law', 'branch', 'rights', 'citizen'] },
    { topic: 'geography', needles: ['map', 'region', 'geography', 'latitude', 'longitude', 'compass', 'location'] },
    { topic: 'economics_history', needles: ['economy', 'trade', 'market', 'supply', 'demand', 'timeline', 'history'] },
  ],
};

const DEFAULT_TOPIC_BY_SUBJECT: Record<NonMathRemediationSubject, NonMathRemediationTopic> = {
  english: 'main_idea',
  science: 'scientific_reasoning',
  social_studies: 'civics',
};

const TOPIC_INDEX: Record<NonMathRemediationTopic, number> = {
  main_idea: 1,
  context_clues: 2,
  text_evidence: 3,
  scientific_reasoning: 4,
  ecosystems: 5,
  earth_space: 6,
  civics: 7,
  geography: 8,
  economics_history: 9,
};

const getSubjectTemplates = (subject: NonMathRemediationSubject): Record<string, TopicTemplate> => {
  if (subject === 'english') return ENGLISH_TEMPLATES;
  if (subject === 'science') return SCIENCE_TEMPLATES;
  return SOCIAL_STUDIES_TEMPLATES;
};

export const getNonMathRemediationSubject = (
  subject: string | null | undefined,
): NonMathRemediationSubject | null => {
  const normalized = normalize(subject);
  if (!normalized) return null;
  if (includesAny(normalized, ['english', 'ela', 'language arts', 'reading', 'literacy'])) return 'english';
  if (includesAny(normalized, ['science', 'biology', 'chemistry', 'physics'])) return 'science';
  if (includesAny(normalized, ['social studies', 'social_studies', 'history', 'civics', 'geography'])) return 'social_studies';
  return null;
};

const resolveTopic = (input: {
  subject: NonMathRemediationSubject;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): NonMathRemediationTopic => {
  const text = normalize([input.lessonTitle, input.lessonContent, input.questionPrompt].filter(Boolean).join(' '));
  const matches = TOPIC_KEYWORDS[input.subject] ?? [];
  for (const match of matches) {
    if (includesAny(text, match.needles)) {
      return match.topic;
    }
  }
  return DEFAULT_TOPIC_BY_SUBJECT[input.subject];
};

const resolveTemplate = (input: {
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}) => {
  const subject = getNonMathRemediationSubject(input.subject);
  if (!subject) return null;
  const topic = resolveTopic({
    subject,
    lessonTitle: input.lessonTitle,
    lessonContent: input.lessonContent,
    questionPrompt: input.questionPrompt,
  });
  const subjectTemplates = getSubjectTemplates(subject);
  const template = subjectTemplates[topic] ?? subjectTemplates[DEFAULT_TOPIC_BY_SUBJECT[subject]];
  if (!template) return null;
  return { subject, topic, template };
};

export const getNonMathRemediationTopic = (input: {
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): NonMathRemediationTopic | null => {
  return resolveTemplate(input)?.topic ?? null;
};

export const getDeterministicNonMathHint = (input: {
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): string | null => {
  return resolveTemplate(input)?.template.hint ?? null;
};

export const getDeterministicNonMathSteps = (input: {
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): string[] | null => {
  const steps = resolveTemplate(input)?.template.steps;
  if (!steps?.length) return null;
  return steps.slice(0, 4);
};

export const getDeterministicNonMathQuickReview = (input: {
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): NonMathQuickReview | null => {
  const resolved = resolveTemplate(input);
  if (!resolved) return null;
  return {
    ...resolved.template.quickReview,
    topic: resolved.topic,
  };
};

export const getDeterministicNonMathChallengeQuestion = (input: {
  lessonId?: number;
  subject: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): LessonPracticeQuestion | null => {
  const resolved = resolveTemplate(input);
  if (!resolved) return null;

  const topicIndex = TOPIC_INDEX[resolved.topic] ?? 0;
  const safeLessonId = Number.isFinite(input.lessonId) ? Math.max(0, Math.floor(input.lessonId as number)) : 0;
  const questionId = 980_000 + safeLessonId * 20 + topicIndex;

  return {
    id: questionId,
    prompt: resolved.template.challenge.prompt,
    type: 'multiple_choice',
    explanation: resolved.template.challenge.explanation,
    hint: resolved.template.challenge.hint,
    steps: resolved.template.challenge.steps.slice(0, 4),
    visual: null,
    options: resolved.template.challenge.options.map((option, index) => ({
      id: questionId * 10 + index + 1,
      text: option.text,
      isCorrect: option.isCorrect,
      feedback: option.feedback,
    })),
    skillIds: [],
  };
};
