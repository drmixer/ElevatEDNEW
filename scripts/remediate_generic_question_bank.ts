import process from 'node:process';

import { assessPracticeQuestionQuality, type PracticeQuestionOptionInput } from '../shared/questionQuality.js';
import { createServiceRoleClient } from './utils/supabase.js';

type CliOptions = {
  limit: number;
  apply: boolean;
  dryRun: boolean;
};

type SubjectRow = {
  id: number;
  name: string;
};

type TopicRow = {
  id: number;
  subject_id: number;
  name: string;
};

type QuestionRow = {
  id: number;
  prompt: string;
  question_type: string | null;
  subject_id: number;
  topic_id: number | null;
  question_options?:
    | Array<{
        id: number;
        content: string;
        is_correct: boolean;
        option_order: number;
      }>
    | null;
};

type GeneratedQuestion = {
  prompt: string;
  options: Array<{ content: string; isCorrect: boolean }>;
  explanation: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    limit: 500,
    apply: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--limit') {
      const value = Number.parseInt(args[i + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Expected positive integer after --limit');
      }
      options.limit = value;
      i += 1;
      continue;
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const buildBasePrompt = (subjectName: string, topicName: string): string => {
  const subject = subjectName.toLowerCase();
  if (subject.includes('math')) {
    return `In a ${topicName} problem, which approach best checks that the final answer is correct?`;
  }
  if (subject.includes('english') || subject.includes('language')) {
    return `In an ${subjectName} lesson about ${topicName}, which response best supports an answer with text evidence?`;
  }
  if (subject.includes('science')) {
    return `During a ${subjectName} activity on ${topicName}, which action best uses evidence to support a claim?`;
  }
  if (subject.includes('social')) {
    return `In ${subjectName} class, which step best evaluates information about ${topicName}?`;
  }
  return `For the topic ${topicName} in ${subjectName}, which action shows the strongest understanding of the lesson goal?`;
};

const needsChoiceOptions = (questionType: string | null): boolean => {
  const normalized = (questionType ?? 'multiple_choice').toLowerCase();
  return normalized === 'multiple_choice' || normalized === 'true_false';
};

const buildBaseOptions = (subjectName: string, topicName: string): Array<{ content: string; isCorrect: boolean }> => {
  const subject = subjectName.toLowerCase();
  if (subject.includes('math')) {
    return [
      {
        content: `Use the ${topicName} method, then verify the result by rechecking each calculation step.`,
        isCorrect: true,
      },
      {
        content: 'Pick the answer closest to your first guess without showing any work.',
        isCorrect: false,
      },
      {
        content: 'Apply a random rule from another topic even if it does not fit the problem.',
        isCorrect: false,
      },
      {
        content: 'Change numbers and units mid-solution without updating the equation.',
        isCorrect: false,
      },
    ];
  }

  if (subject.includes('english') || subject.includes('language')) {
    return [
      {
        content: `Quote or paraphrase a detail from the text and explain how it supports the idea about ${topicName}.`,
        isCorrect: true,
      },
      {
        content: 'Write a personal opinion without using any detail from the passage.',
        isCorrect: false,
      },
      {
        content: 'Summarize only the title and skip the key paragraph details.',
        isCorrect: false,
      },
      {
        content: 'Choose a claim that contradicts the text evidence.',
        isCorrect: false,
      },
    ];
  }

  if (subject.includes('science')) {
    return [
      {
        content: `Record observations for ${topicName}, compare the data, and use that evidence to justify the conclusion.`,
        isCorrect: true,
      },
      {
        content: 'Decide the conclusion before collecting any data.',
        isCorrect: false,
      },
      {
        content: 'Ignore measurements and rely only on a first impression.',
        isCorrect: false,
      },
      {
        content: 'Use evidence from an unrelated experiment without comparing variables.',
        isCorrect: false,
      },
    ];
  }

  return [
    {
      content: `Use specific details about ${topicName} and explain how they support the conclusion.`,
      isCorrect: true,
    },
    {
      content: 'Use a broad statement that does not reference lesson evidence.',
      isCorrect: false,
    },
    {
      content: 'Skip the verification step and finalize the first idea.',
      isCorrect: false,
    },
    {
      content: 'Combine unrelated details from other topics without checking relevance.',
      isCorrect: false,
    },
  ];
};

const toTrueFalse = (prompt: string, topicName: string): GeneratedQuestion => {
  const trueStatement = `A strong ${topicName} response should include checking evidence or steps before finalizing an answer.`;
  const falseStatement = `For ${topicName}, once an answer is written, no evidence or checks are needed.`;
  return {
    prompt,
    options: [
      { content: trueStatement, isCorrect: true },
      { content: falseStatement, isCorrect: false },
    ],
    explanation: `Reliable ${topicName} work includes verification and evidence before finalizing.`,
  };
};

const generateCandidate = (subjectName: string, topicName: string, questionType: string | null): GeneratedQuestion => {
  const prompt = buildBasePrompt(subjectName, topicName);
  const normalizedType = (questionType ?? 'multiple_choice').toLowerCase();
  if (normalizedType === 'true_false') {
    return toTrueFalse(prompt, topicName);
  }

  return {
    prompt,
    options: needsChoiceOptions(questionType) ? buildBaseOptions(subjectName, topicName) : [],
    explanation: `The correct choice is the one that applies ${topicName} with evidence, checks, and context-appropriate reasoning.`,
  };
};

const computeGenericRate = (rows: QuestionRow[]): { genericCount: number; genericRate: number } => {
  if (!rows.length) return { genericCount: 0, genericRate: 0 };
  const genericCount = rows.reduce((count, row) => {
    const quality = assessPracticeQuestionQuality({
      prompt: row.prompt,
      type: row.question_type,
      options: (row.question_options ?? []).map((opt) => ({ text: opt.content, isCorrect: opt.is_correct })),
    });
    return quality.isGeneric ? count + 1 : count;
  }, 0);
  return { genericCount, genericRate: roundToTenth((genericCount / rows.length) * 100) };
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const supabase = createServiceRoleClient();

  const [{ data: questionRows, error: questionError }, { data: subjects, error: subjectError }, { data: topics, error: topicError }] =
    await Promise.all([
      supabase
        .from('question_bank')
        .select('id, prompt, question_type, subject_id, topic_id, question_options(id, content, is_correct, option_order)')
        .order('created_at', { ascending: false })
        .limit(options.limit),
      supabase.from('subjects').select('id, name'),
      supabase.from('topics').select('id, subject_id, name'),
    ]);

  if (questionError) {
    throw new Error(`Failed to load question sample: ${questionError.message}`);
  }
  if (subjectError) {
    throw new Error(`Failed to load subjects: ${subjectError.message}`);
  }
  if (topicError) {
    throw new Error(`Failed to load topics: ${topicError.message}`);
  }

  const sample = (questionRows as QuestionRow[] | null) ?? [];
  const subjectMap = new Map<number, string>(((subjects as SubjectRow[] | null) ?? []).map((row) => [row.id, row.name]));
  const topicMap = new Map<number, TopicRow>(((topics as TopicRow[] | null) ?? []).map((row) => [row.id, row]));

  const before = computeGenericRate(sample);
  console.log(`Generic rate before: ${before.genericCount}/${sample.length} (${before.genericRate}%)`);

  const planned = sample
    .map((row) => {
      const quality = assessPracticeQuestionQuality({
        prompt: row.prompt,
        type: row.question_type,
        options: (row.question_options ?? []).map((opt) => ({ text: opt.content, isCorrect: opt.is_correct })),
      });
      if (!quality.isGeneric) return null;

      const topicName = row.topic_id != null ? topicMap.get(row.topic_id)?.name ?? 'this topic' : 'this topic';
      const subjectName = subjectMap.get(row.subject_id) ?? 'this subject';
      const candidate = generateCandidate(subjectName, topicName, row.question_type);
      const candidateQuality = assessPracticeQuestionQuality({
        prompt: candidate.prompt,
        type: row.question_type,
        options: candidate.options.map((opt): PracticeQuestionOptionInput => ({
          text: opt.content,
          isCorrect: opt.isCorrect,
        })),
      });

      if (candidateQuality.isGeneric || candidateQuality.shouldBlock) {
        return null;
      }

      return {
        id: row.id,
        oldPrompt: row.prompt,
        reasons: quality.reasons,
        next: candidate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  console.log(`Planned remediations: ${planned.length}`);

  if (!planned.length || options.dryRun || !options.apply) {
    if (planned.length) {
      planned.slice(0, 10).forEach((entry) => {
        console.log(`- Q${entry.id} reasons=${entry.reasons.join(', ')}`);
      });
    }
    if (!options.apply) {
      console.log('Run with --apply to persist changes.');
    }
    return;
  }

  for (const entry of planned) {
    const { error: updateError } = await supabase
      .from('question_bank')
      .update({
        prompt: entry.next.prompt,
        solution_explanation: entry.next.explanation,
      })
      .eq('id', entry.id);

    if (updateError) {
      throw new Error(`Failed to update question ${entry.id}: ${updateError.message}`);
    }

    if (entry.next.options.length > 0) {
      const { error: deleteOptionsError } = await supabase
        .from('question_options')
        .delete()
        .eq('question_id', entry.id);
      if (deleteOptionsError) {
        throw new Error(`Failed to delete options for question ${entry.id}: ${deleteOptionsError.message}`);
      }

      const { error: insertOptionsError } = await supabase.from('question_options').insert(
        entry.next.options.map((opt, idx) => ({
          question_id: entry.id,
          option_order: idx + 1,
          content: opt.content,
          is_correct: opt.isCorrect,
        })),
      );
      if (insertOptionsError) {
        throw new Error(`Failed to insert options for question ${entry.id}: ${insertOptionsError.message}`);
      }
    }
  }

  const { data: refreshedRows, error: refreshedError } = await supabase
    .from('question_bank')
    .select('id, prompt, question_type, subject_id, topic_id, question_options(id, content, is_correct, option_order)')
    .order('created_at', { ascending: false })
    .limit(options.limit);
  if (refreshedError) {
    throw new Error(`Failed to load refreshed sample: ${refreshedError.message}`);
  }
  const after = computeGenericRate((refreshedRows as QuestionRow[] | null) ?? []);
  console.log(`Generic rate after: ${after.genericCount}/${sample.length} (${after.genericRate}%)`);
};

const invokedFromCli =
  process.argv[1]?.includes('remediate_generic_question_bank.ts') ||
  process.argv[1]?.includes('remediate_generic_question_bank.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
