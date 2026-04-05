import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { parse } from 'csv-parse/sync';

import {
  assessPracticeQuestionQuality,
  type PracticeQuestionOptionInput,
} from '../shared/questionQuality.js';
import { createServiceRoleClient } from './utils/supabase.js';

type CliOptions = {
  apply: boolean;
  auditCsvPath: string;
  top: number;
};

type AuditCsvRow = {
  rank_score: string;
  severity: string;
  question_id: string;
  should_block: string;
  is_generic: string;
  subject: string;
  topic: string;
  question_type: string;
  reason_codes: string;
  impacted_lesson_count: string;
  impacted_module_count: string;
  impacted_module_slugs: string;
  impacted_lessons: string;
  prompt: string;
};

type QuestionRow = {
  id: number;
  prompt: string;
  question_type: string | null;
  solution_explanation: string | null;
  metadata: Record<string, unknown> | null;
  question_options?: Array<{
    id: number;
    option_order: number;
    content: string;
    is_correct: boolean;
  }> | null;
};

type CandidateQuestion = {
  prompt: string;
  explanation: string;
  options: Array<{ content: string; isCorrect: boolean }>;
};

type ReplacementPlan = {
  id: number;
  oldPrompt: string;
  candidate: CandidateQuestion;
};

const DEFAULT_AUDIT_CSV = 'data/audits/question_bank_quality_audit_questions.csv';

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    apply: false,
    auditCsvPath: DEFAULT_AUDIT_CSV,
    top: 50,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--top') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Expected a positive integer after --top');
      }
      options.top = value;
      index += 1;
      continue;
    }
    if (arg === '--audit' || arg === '--audit-csv') {
      const value = (args[index + 1] ?? '').trim();
      if (!value) {
        throw new Error(`Expected a file path after ${arg}`);
      }
      options.auditCsvPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const toCandidate = (
  prompt: string,
  explanation: string,
  options: Array<{ content: string; isCorrect: boolean }>,
): CandidateQuestion => ({
  prompt,
  explanation,
  options,
});

const validateCandidate = (candidate: CandidateQuestion): void => {
  const quality = assessPracticeQuestionQuality({
    prompt: candidate.prompt,
    type: 'multiple_choice',
    options: candidate.options.map(
      (option): PracticeQuestionOptionInput => ({
        text: option.content,
        isCorrect: option.isCorrect,
      }),
    ),
  });

  if (quality.shouldBlock || quality.isGeneric) {
    throw new Error(
      `Generated candidate is still low-quality: reasons=${quality.reasons.join(', ')} prompt="${candidate.prompt}"`,
    );
  }
};

const createTransformationsMainVariants = (): CandidateQuestion[] => [
  toCandidate(
    'Point A(2, -1) is translated 4 units right and 3 units up. Which image of A is correct?',
    'A translation adds the horizontal and vertical changes to the original coordinates, so A moves to (6, 2).',
    [
      { content: '(6, 2)', isCorrect: true },
      { content: '(-2, 2)', isCorrect: false },
      { content: '(6, -4)', isCorrect: false },
      { content: '(4, 3)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Triangle ABC is reflected across the y-axis. If A is at (3, 1), where is A\' after the reflection?',
    'A reflection across the y-axis changes the sign of x and keeps y the same.',
    [
      { content: '(-3, 1)', isCorrect: true },
      { content: '(3, -1)', isCorrect: false },
      { content: '(-1, 3)', isCorrect: false },
      { content: '(1, 3)', isCorrect: false },
    ],
  ),
  toCandidate(
    'A point is rotated 90 degrees counterclockwise about the origin. Which image of (4, 1) is correct?',
    'A 90-degree counterclockwise rotation sends (x, y) to (-y, x), so (4, 1) becomes (-1, 4).',
    [
      { content: '(-1, 4)', isCorrect: true },
      { content: '(1, -4)', isCorrect: false },
      { content: '(4, -1)', isCorrect: false },
      { content: '(-4, 1)', isCorrect: false },
    ],
  ),
  toCandidate(
    'A triangle is dilated by a scale factor of 2 about the origin. What happens to the point (2, 3)?',
    'A dilation by scale factor 2 doubles both coordinates when the center is the origin.',
    [
      { content: '(4, 6)', isCorrect: true },
      { content: '(1, 1.5)', isCorrect: false },
      { content: '(2, 5)', isCorrect: false },
      { content: '(6, 4)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which transformation keeps a figure the same size and shape while moving it to a new position?',
    'Rigid transformations such as translations preserve both size and shape.',
    [
      { content: 'A translation', isCorrect: true },
      { content: 'A dilation with scale factor 3', isCorrect: false },
      { content: 'Stretching only the x-coordinates', isCorrect: false },
      { content: 'Changing side lengths by different amounts', isCorrect: false },
    ],
  ),
  toCandidate(
    'Figure P is reflected across the x-axis. Which rule matches that transformation?',
    'A reflection across the x-axis keeps x the same and changes y to its opposite.',
    [
      { content: '(x, y) -> (x, -y)', isCorrect: true },
      { content: '(x, y) -> (-x, y)', isCorrect: false },
      { content: '(x, y) -> (y, x)', isCorrect: false },
      { content: '(x, y) -> (x + 2, y)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which statement about a dilation is true?',
    'A dilation changes size by a scale factor while preserving angle measure and overall shape.',
    [
      { content: 'It can change size while keeping the shape similar.', isCorrect: true },
      { content: 'It always keeps every side length exactly the same.', isCorrect: false },
      { content: 'It only moves a figure left or right.', isCorrect: false },
      { content: 'It changes a square into a circle.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A student claims a reflection across the y-axis sends (5, -2) to (5, 2). Which correction is correct?',
    'Reflecting across the y-axis changes the sign of x, not y.',
    [
      { content: 'The image should be (-5, -2).', isCorrect: true },
      { content: 'The image should be (5, 2).', isCorrect: false },
      { content: 'The image should be (-2, 5).', isCorrect: false },
      { content: 'The point does not change.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which sequence could map one congruent triangle onto another without changing its size?',
    'A sequence of rigid transformations can map congruent figures onto each other without resizing.',
    [
      { content: 'A rotation followed by a translation', isCorrect: true },
      { content: 'A dilation with scale factor 2', isCorrect: false },
      { content: 'Stretching the base only', isCorrect: false },
      { content: 'Doubling every side length', isCorrect: false },
    ],
  ),
];

const createTransformationsSupportVariants = (): CandidateQuestion[] => [
  toCandidate(
    'Which rule represents a translation 3 units left and 2 units down?',
    'Subtract 3 from x and 2 from y to translate left and down.',
    [
      { content: '(x, y) -> (x - 3, y - 2)', isCorrect: true },
      { content: '(x, y) -> (x + 3, y + 2)', isCorrect: false },
      { content: '(x, y) -> (-x - 3, y - 2)', isCorrect: false },
      { content: '(x, y) -> (y - 3, x - 2)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Point B(-2, 5) is reflected across the x-axis. Which image is correct?',
    'A reflection across the x-axis keeps x the same and changes y to its opposite.',
    [
      { content: '(-2, -5)', isCorrect: true },
      { content: '(2, 5)', isCorrect: false },
      { content: '(2, -5)', isCorrect: false },
      { content: '(-5, -2)', isCorrect: false },
    ],
  ),
  toCandidate(
    'A point is rotated 180 degrees about the origin. Where does (3, -4) land?',
    'A 180-degree rotation about the origin changes both signs, sending (x, y) to (-x, -y).',
    [
      { content: '(-3, 4)', isCorrect: true },
      { content: '(4, -3)', isCorrect: false },
      { content: '(-4, 3)', isCorrect: false },
      { content: '(3, 4)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which transformation changes size but keeps angle measure the same?',
    'Dilations preserve angle measure while resizing the figure by a scale factor.',
    [
      { content: 'A dilation', isCorrect: true },
      { content: 'A translation', isCorrect: false },
      { content: 'A reflection only', isCorrect: false },
      { content: 'A 90-degree rotation only', isCorrect: false },
    ],
  ),
  toCandidate(
    'A triangle is reflected across the line y = x. What happens to a point (1, 6)?',
    'Reflecting across y = x swaps the coordinates of the point.',
    [
      { content: '(6, 1)', isCorrect: true },
      { content: '(-1, 6)', isCorrect: false },
      { content: '(1, -6)', isCorrect: false },
      { content: '(-6, -1)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which statement is true about a rotation?',
    'A rotation turns a figure around a center point while preserving its size and shape.',
    [
      { content: 'It preserves side lengths and angle measures.', isCorrect: true },
      { content: 'It always changes a figure into a larger copy.', isCorrect: false },
      { content: 'It only moves points straight up or down.', isCorrect: false },
      { content: 'It changes congruent figures into noncongruent figures.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A student says a dilation with scale factor 1/2 should double each coordinate. Which correction is correct?',
    'A scale factor of 1/2 multiplies each coordinate by one-half, which makes the image smaller.',
    [
      { content: 'Each coordinate should be multiplied by 1/2, not doubled.', isCorrect: true },
      { content: 'Each coordinate should be multiplied by 2.', isCorrect: false },
      { content: 'The point should be reflected across the x-axis.', isCorrect: false },
      { content: 'The coordinates should be swapped.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which transformation would map a figure onto a mirror image of itself across a vertical line?',
    'A reflection across a vertical line creates a mirror image by reversing left and right positions.',
    [
      { content: 'A reflection', isCorrect: true },
      { content: 'A translation only', isCorrect: false },
      { content: 'A dilation only', isCorrect: false },
      { content: 'A scale change with no flip', isCorrect: false },
    ],
  ),
  toCandidate(
    'Point C(0, -3) is translated 5 units right. Which image is correct?',
    'A horizontal translation right by 5 increases the x-coordinate by 5 and leaves y unchanged.',
    [
      { content: '(5, -3)', isCorrect: true },
      { content: '(-5, -3)', isCorrect: false },
      { content: '(0, 2)', isCorrect: false },
      { content: '(3, 5)', isCorrect: false },
    ],
  ),
];

const createStatsMainVariants = (): CandidateQuestion[] => [
  toCandidate(
    'A poll estimates that 62% of students prefer later start times with a margin of error of 4%. Which interval best represents the estimate?',
    'A confidence interval uses the estimate plus and minus the margin of error, so the interval is 58% to 66%.',
    [
      { content: '58% to 66%', isCorrect: true },
      { content: '62% to 66%', isCorrect: false },
      { content: '4% to 62%', isCorrect: false },
      { content: '56% to 68%', isCorrect: false },
    ],
  ),
  toCandidate(
    'A study reports a 95% confidence interval of 12 to 18 minutes for average homework time. What does that interval describe?',
    'The interval gives a plausible range for the true population mean based on the sample data.',
    [
      { content: 'A plausible range for the true average homework time', isCorrect: true },
      { content: 'The exact homework time for every student', isCorrect: false },
      { content: 'The only two homework times anyone can have', isCorrect: false },
      { content: 'The number of students in the sample', isCorrect: false },
    ],
  ),
  toCandidate(
    'A hypothesis test asks whether a new tutoring program raises test scores. Which statement is the null hypothesis?',
    'The null hypothesis states that there is no effect or no difference until evidence suggests otherwise.',
    [
      { content: 'The tutoring program does not change average test scores.', isCorrect: true },
      { content: 'The tutoring program definitely raises scores.', isCorrect: false },
      { content: 'Every student will improve by the same amount.', isCorrect: false },
      { content: 'The tutoring program lowers scores in every case.', isCorrect: false },
    ],
  ),
  toCandidate(
    'If a hypothesis test produces a very small p-value, what does that suggest?',
    'A small p-value suggests the observed result would be unlikely if the null hypothesis were true.',
    [
      { content: 'The sample provides evidence against the null hypothesis.', isCorrect: true },
      { content: 'The null hypothesis must be true.', isCorrect: false },
      { content: 'The sample size is automatically too small.', isCorrect: false },
      { content: 'Confidence intervals are no longer needed in statistics.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which change usually makes a confidence interval narrower when everything else stays the same?',
    'Larger samples reduce sampling variability, which usually makes confidence intervals narrower.',
    [
      { content: 'Using a larger sample size', isCorrect: true },
      { content: 'Using a smaller sample size', isCorrect: false },
      { content: 'Ignoring the margin of error', isCorrect: false },
      { content: 'Rounding all data to whole numbers at random', isCorrect: false },
    ],
  ),
  toCandidate(
    'A claim says the average wait time is less than 10 minutes. Which alternative hypothesis matches that claim?',
    'The alternative hypothesis reflects the research claim being tested.',
    [
      { content: 'The true average wait time is less than 10 minutes.', isCorrect: true },
      { content: 'The true average wait time equals 10 minutes.', isCorrect: false },
      { content: 'The sample average must be exactly 10 minutes.', isCorrect: false },
      { content: 'Every wait time is less than 10 minutes.', isCorrect: false },
    ],
  ),
];

const createStatsSupportVariants = (): CandidateQuestion[] => [
  toCandidate(
    'A confidence interval for a population mean is 40 to 52. Which value could reasonably be the estimated mean from the sample?',
    'The sample estimate is the center of the interval, which is 46.',
    [
      { content: '46', isCorrect: true },
      { content: '12', isCorrect: false },
      { content: '92', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
  toCandidate(
    'In a hypothesis test, what is the first decision you make before collecting data?',
    'You start by stating the null and alternative hypotheses so the test has a clear claim to evaluate.',
    [
      { content: 'State the null and alternative hypotheses.', isCorrect: true },
      { content: 'Choose the conclusion you want first.', isCorrect: false },
      { content: 'Delete any data that looks unusual.', isCorrect: false },
      { content: 'Assume the alternative hypothesis is true.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why is margin of error important when reading a survey result?',
    'The margin of error shows how much the estimate might vary from the true population value.',
    [
      { content: 'It shows the estimate is not exact and may vary around the true value.', isCorrect: true },
      { content: 'It proves the survey is wrong.', isCorrect: false },
      { content: 'It replaces the need for a sample size.', isCorrect: false },
      { content: 'It means every answer in the survey was a mistake.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A p-value is 0.03 and the significance level is 0.05. What is the correct decision?',
    'Because 0.03 is less than 0.05, the data provide enough evidence to reject the null hypothesis.',
    [
      { content: 'Reject the null hypothesis.', isCorrect: true },
      { content: 'Accept the null hypothesis as proven.', isCorrect: false },
      { content: 'Increase the p-value to 0.05.', isCorrect: false },
      { content: 'Ignore the significance level.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Two confidence intervals estimate the same population mean. Interval A is wider than Interval B. Which statement is most likely true?',
    'A wider interval often comes from a smaller sample or a higher confidence level.',
    [
      { content: 'Interval A likely came from less precise data.', isCorrect: true },
      { content: 'Interval A must contain the wrong mean.', isCorrect: false },
      { content: 'Interval B can never be correct.', isCorrect: false },
      { content: 'Both intervals must have the same width.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A test compares whether one method is better than another. Which result would count as evidence for the alternative hypothesis?',
    'Evidence for the alternative comes from data that would be unlikely if there were truly no difference.',
    [
      { content: 'A low p-value showing the observed difference is unlikely under the null', isCorrect: true },
      { content: 'A conclusion chosen before looking at any data', isCorrect: false },
      { content: 'Ignoring the sample and using a guess instead', isCorrect: false },
      { content: 'A rule that says all hypotheses are true', isCorrect: false },
    ],
  ),
];

const systemsDesignVariants: CandidateQuestion[] = [
  toCandidate(
    'A team is designing a school lunch-ordering app. Which question is most important to ask first?',
    'Good systems design starts by understanding the users and the main problem the system must solve.',
    [
      { content: 'What do students and cafeteria staff need the app to do?', isCorrect: true },
      { content: 'Which font should the app use before anything else?', isCorrect: false },
      { content: 'How many stickers should go on the laptops?', isCorrect: false },
      { content: 'Which color is funniest for error messages?', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do engineers often break a large system into smaller parts or modules?',
    'Smaller modules are easier to build, test, improve, and debug than one giant block.',
    [
      { content: 'It makes the system easier to test and update.', isCorrect: true },
      { content: 'It guarantees bugs can never happen.', isCorrect: false },
      { content: 'It removes the need to plan how parts connect.', isCorrect: false },
      { content: 'It means users no longer matter.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A website slows down when too many users log in at once. Which systems-design change best addresses that problem?',
    'Scaling server capacity or balancing traffic helps a system handle more users at the same time.',
    [
      { content: 'Add capacity so the workload can be shared across more resources.', isCorrect: true },
      { content: 'Delete the login feature completely.', isCorrect: false },
      { content: 'Make every user use the same password.', isCorrect: false },
      { content: 'Ignore the slowdown because the site still opens sometimes.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which example best shows an input, process, and output in a digital system?',
    'Systems take inputs, process them, and produce outputs for users.',
    [
      { content: 'A user enters a search, the app matches results, and the results list appears.', isCorrect: true },
      { content: 'A student thinks about lunch and then walks away.', isCorrect: false },
      { content: 'A cable sits on a desk with no data moving.', isCorrect: false },
      { content: 'A monitor changes color because someone likes blue.', isCorrect: false },
    ],
  ),
];

const linearQuadraticVariants: CandidateQuestion[] = [
  toCandidate(
    'Which graph feature helps you tell that y = x^2 - 4 is quadratic instead of linear?',
    'Quadratic functions graph as parabolas, while linear functions graph as straight lines.',
    [
      { content: 'Its graph is a parabola, not a straight line.', isCorrect: true },
      { content: 'It has an x-value and a y-value.', isCorrect: false },
      { content: 'It can be written with numbers.', isCorrect: false },
      { content: 'It crosses the grid somewhere.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which equation represents a linear function?',
    'A linear function has the variable raised only to the first power and graphs as a straight line.',
    [
      { content: 'y = 3x + 2', isCorrect: true },
      { content: 'y = x^2 - 5', isCorrect: false },
      { content: 'y = (x - 1)(x + 1)', isCorrect: false },
      { content: 'y = x^2 + 4x', isCorrect: false },
    ],
  ),
];

const linearQuadraticSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'For the linear function y = 2x + 1, what is the y-value when x = 3?',
    'Substitute x = 3 into the rule: y = 2(3) + 1 = 7.',
    [
      { content: '7', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '6', isCorrect: false },
      { content: '9', isCorrect: false },
    ],
  ),
  toCandidate(
    'For the quadratic function y = x^2, what is the y-value when x = -4?',
    'Squaring -4 gives 16, so the output is 16.',
    [
      { content: '16', isCorrect: true },
      { content: '-16', isCorrect: false },
      { content: '8', isCorrect: false },
      { content: '-8', isCorrect: false },
    ],
  ),
];

const piecewiseVariants: CandidateQuestion[] = [
  toCandidate(
    'A piecewise function uses one rule for x < 0 and another rule for x >= 0. Why is that useful?',
    'Piecewise functions model situations where the rule changes depending on the input value.',
    [
      { content: 'Because different intervals can follow different rules.', isCorrect: true },
      { content: 'Because every function must use exactly two unrelated answers.', isCorrect: false },
      { content: 'Because graphs cannot show more than one pattern.', isCorrect: false },
      { content: 'Because absolute value only works for negative numbers.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does the absolute value expression |x| represent?',
    'Absolute value is the distance of a number from 0 on the number line, so it is never negative.',
    [
      { content: 'The distance from 0 on the number line', isCorrect: true },
      { content: 'Always the opposite of x', isCorrect: false },
      { content: 'Only the negative part of x', isCorrect: false },
      { content: 'A rule that makes every answer 0', isCorrect: false },
    ],
  ),
];

const piecewiseSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If f(x) = x + 2 for x < 0 and f(x) = x - 1 for x >= 0, what is f(3)?',
    'Because 3 is greater than or equal to 0, use the rule x - 1. That gives 2.',
    [
      { content: '2', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '-1', isCorrect: false },
      { content: '3', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the value of |-7|?',
    'Absolute value measures distance from 0, so |-7| = 7.',
    [
      { content: '7', isCorrect: true },
      { content: '-7', isCorrect: false },
      { content: '0', isCorrect: false },
      { content: '-14', isCorrect: false },
    ],
  ),
];

const modelingApplicationsVariants: CandidateQuestion[] = [
  toCandidate(
    'A phone plan costs $20 per month plus $5 for each extra gigabyte used. Which equation models the monthly cost y for x extra gigabytes?',
    'The fixed monthly fee is 20 and the variable cost is 5 for each extra gigabyte, so the model is y = 20 + 5x.',
    [
      { content: 'y = 20 + 5x', isCorrect: true },
      { content: 'y = 5 + 20x', isCorrect: false },
      { content: 'y = 20x - 5', isCorrect: false },
      { content: 'y = x + 25x', isCorrect: false },
    ],
  ),
  toCandidate(
    'A tank starts with 50 liters of water and drains 3 liters each minute. What does the 50 represent in the model W = 50 - 3t?',
    'In a linear model, the constant term represents the starting amount before time begins.',
    [
      { content: 'The amount of water in the tank at the start', isCorrect: true },
      { content: 'The amount drained each minute', isCorrect: false },
      { content: 'The time when the tank is empty', isCorrect: false },
      { content: 'The number of tanks being filled', isCorrect: false },
    ],
  ),
];

const modelingApplicationsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A taxi charges $4 to start plus $2 per mile. What is the total cost for 6 miles?',
    'Substitute 6 for the number of miles: 4 + 2(6) = 16.',
    [
      { content: '$16', isCorrect: true },
      { content: '$12', isCorrect: false },
      { content: '$10', isCorrect: false },
      { content: '$20', isCorrect: false },
    ],
  ),
  toCandidate(
    'A model shows temperature T = 72 - 4h after h hours. What is the temperature after 5 hours?',
    'Substitute 5 for h: 72 - 4(5) = 52.',
    [
      { content: '52', isCorrect: true },
      { content: '67', isCorrect: false },
      { content: '57', isCorrect: false },
      { content: '48', isCorrect: false },
    ],
  ),
];

const vectorsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which vector represents 3 units right and 4 units up on the coordinate plane?',
    'A vector can be written by listing its horizontal and vertical components.',
    [
      { content: '<3, 4>', isCorrect: true },
      { content: '<4, 3>', isCorrect: false },
      { content: '<-3, 4>', isCorrect: false },
      { content: '<3, -4>', isCorrect: false },
    ],
  ),
  toCandidate(
    'If vector u = <2, -1> and vector v = <3, 5>, what is u + v?',
    'Add vectors component by component: <2 + 3, -1 + 5> = <5, 4>.',
    [
      { content: '<5, 4>', isCorrect: true },
      { content: '<6, 5>', isCorrect: false },
      { content: '<1, -6>', isCorrect: false },
      { content: '<5, -4>', isCorrect: false },
    ],
  ),
];

const vectorsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A force vector is <6, 8>. What is its magnitude?',
    'The magnitude is sqrt(6^2 + 8^2) = sqrt(100) = 10.',
    [
      { content: '10', isCorrect: true },
      { content: '14', isCorrect: false },
      { content: '2', isCorrect: false },
      { content: '48', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which vector points in the opposite direction of <4, -7>?',
    'The opposite vector changes the sign of each component.',
    [
      { content: '<-4, 7>', isCorrect: true },
      { content: '<4, 7>', isCorrect: false },
      { content: '<-7, 4>', isCorrect: false },
      { content: '<7, -4>', isCorrect: false },
    ],
  ),
];

const complexNumbersVariants: CandidateQuestion[] = [
  toCandidate(
    'What is i^2 equal to?',
    'By definition of the imaginary unit, i^2 = -1.',
    [
      { content: '-1', isCorrect: true },
      { content: '1', isCorrect: false },
      { content: 'i', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression is equal to (3 + 2i) + (4 - 5i)?',
    'Add the real parts and imaginary parts separately: 3 + 4 = 7 and 2i + (-5i) = -3i.',
    [
      { content: '7 - 3i', isCorrect: true },
      { content: '7 + 7i', isCorrect: false },
      { content: '-1 - 3i', isCorrect: false },
      { content: '1 + 3i', isCorrect: false },
    ],
  ),
];

const complexNumbersSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the conjugate of 5 - 3i?',
    'The conjugate changes the sign of the imaginary part.',
    [
      { content: '5 + 3i', isCorrect: true },
      { content: '-5 - 3i', isCorrect: false },
      { content: '-5 + 3i', isCorrect: false },
      { content: '3 - 5i', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression is equal to (2i)(3i)?',
    'Multiply the coefficients and use i^2 = -1: 6i^2 = -6.',
    [
      { content: '-6', isCorrect: true },
      { content: '6', isCorrect: false },
      { content: '5i', isCorrect: false },
      { content: '-6i', isCorrect: false },
    ],
  ),
];

const polynomialRationalVariants: CandidateQuestion[] = [
  toCandidate(
    'Which expression is a polynomial?',
    'Polynomials have variables raised to whole-number exponents and no variables in denominators.',
    [
      { content: '3x^2 - 4x + 7', isCorrect: true },
      { content: '2/x + 5', isCorrect: false },
      { content: 'sqrt(x) + 1', isCorrect: false },
      { content: 'x^-1 + 3', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which value makes the rational expression 1/(x - 4) undefined?',
    'A rational expression is undefined when its denominator equals 0.',
    [
      { content: '4', isCorrect: true },
      { content: '0', isCorrect: false },
      { content: '-4', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
];

const polynomialRationalSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is (x + 3)(x + 2)?',
    'Multiply each term: x^2 + 2x + 3x + 6 = x^2 + 5x + 6.',
    [
      { content: 'x^2 + 5x + 6', isCorrect: true },
      { content: 'x^2 + 6x + 5', isCorrect: false },
      { content: 'x^2 + x + 6', isCorrect: false },
      { content: '2x^2 + 5x + 6', isCorrect: false },
    ],
  ),
  toCandidate(
    'How does the expression (x^2 - 9)/(x - 3) simplify for x ≠ 3?',
    'Factor the numerator as (x - 3)(x + 3) and cancel the common factor.',
    [
      { content: 'x + 3', isCorrect: true },
      { content: 'x - 3', isCorrect: false },
      { content: 'x^2 - 3', isCorrect: false },
      { content: '9', isCorrect: false },
    ],
  ),
];

const sequencesSeriesVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the next term in the arithmetic sequence 5, 8, 11, 14, ...?',
    'An arithmetic sequence adds the same difference each time. Here the common difference is 3.',
    [
      { content: '17', isCorrect: true },
      { content: '18', isCorrect: false },
      { content: '19', isCorrect: false },
      { content: '20', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the next term in the geometric sequence 3, 6, 12, 24, ...?',
    'A geometric sequence multiplies by the same factor each time. Here the common ratio is 2.',
    [
      { content: '48', isCorrect: true },
      { content: '36', isCorrect: false },
      { content: '27', isCorrect: false },
      { content: '30', isCorrect: false },
    ],
  ),
];

const sequencesSeriesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the sum of the first four terms of the arithmetic sequence 2, 5, 8, 11?',
    'Add the first four terms: 2 + 5 + 8 + 11 = 26.',
    [
      { content: '26', isCorrect: true },
      { content: '24', isCorrect: false },
      { content: '28', isCorrect: false },
      { content: '30', isCorrect: false },
    ],
  ),
  toCandidate(
    'In the sequence 7, 10, 13, 16, what is the explicit rule for the nth term?',
    'The first term is 7 and the common difference is 3, so a_n = 7 + 3(n - 1).',
    [
      { content: 'a_n = 7 + 3(n - 1)', isCorrect: true },
      { content: 'a_n = 7n + 3', isCorrect: false },
      { content: 'a_n = 3 + 7(n - 1)', isCorrect: false },
      { content: 'a_n = 10n', isCorrect: false },
    ],
  ),
];

const integralsVariants: CandidateQuestion[] = [
  toCandidate(
    'What is an antiderivative of 6x?',
    'Because the derivative of 3x^2 is 6x, an antiderivative of 6x is 3x^2 + C.',
    [
      { content: '3x^2 + C', isCorrect: true },
      { content: '6 + C', isCorrect: false },
      { content: 'x^6 + C', isCorrect: false },
      { content: '12x + C', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression equals the definite integral of a rate function over an interval?',
    'A definite integral gives the accumulated change, often interpreted as total area under the curve.',
    [
      { content: 'The net accumulated area under the curve on that interval', isCorrect: true },
      { content: 'Only the slope at one point', isCorrect: false },
      { content: 'The y-intercept of the graph', isCorrect: false },
      { content: 'A list of x-values with no meaning', isCorrect: false },
    ],
  ),
];

const integralsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the value of ∫_0^2 3 dx?',
    'The area under y = 3 from x = 0 to x = 2 is a rectangle with width 2 and height 3, so the integral is 6.',
    [
      { content: '6', isCorrect: true },
      { content: '3', isCorrect: false },
      { content: '5', isCorrect: false },
      { content: '9', isCorrect: false },
    ],
  ),
  toCandidate(
    'If F\'(x) = f(x), what does the Fundamental Theorem of Calculus say about ∫_a^b f(x) dx?',
    'The definite integral can be found by evaluating an antiderivative at the endpoints.',
    [
      { content: 'It equals F(b) - F(a).', isCorrect: true },
      { content: 'It always equals 0.', isCorrect: false },
      { content: 'It equals f(b) - f(a).', isCorrect: false },
      { content: 'It equals F(a) + F(b).', isCorrect: false },
    ],
  ),
];

const parametricPolarVariants: CandidateQuestion[] = [
  toCandidate(
    'In polar coordinates, what does r represent?',
    'In polar form, r is the distance from the origin to the point.',
    [
      { content: 'The distance from the origin', isCorrect: true },
      { content: 'The slope of the tangent line', isCorrect: false },
      { content: 'The x-coordinate only', isCorrect: false },
      { content: 'The degree measure of every angle in the graph', isCorrect: false },
    ],
  ),
  toCandidate(
    'If a parametric curve is given by x = 2t and y = t + 1, what point is on the curve when t = 3?',
    'Substitute t = 3 into both equations: x = 6 and y = 4.',
    [
      { content: '(6, 4)', isCorrect: true },
      { content: '(3, 4)', isCorrect: false },
      { content: '(2, 3)', isCorrect: false },
      { content: '(6, 3)', isCorrect: false },
    ],
  ),
];

const parametricPolarSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What rectangular point matches the polar point (2, 90°)?',
    'A point 2 units from the origin at 90 degrees lies on the positive y-axis.',
    [
      { content: '(0, 2)', isCorrect: true },
      { content: '(2, 0)', isCorrect: false },
      { content: '(0, -2)', isCorrect: false },
      { content: '(-2, 0)', isCorrect: false },
    ],
  ),
  toCandidate(
    'For x = t^2 and y = t + 1, what is y when x = 4 and t is positive?',
    'If x = t^2 = 4 and t is positive, then t = 2, so y = 3.',
    [
      { content: '3', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '2', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
];

const limitsVariants: CandidateQuestion[] = [
  toCandidate(
    'What is lim x->2 (x + 5)?',
    'For a continuous function like x + 5, evaluate the expression at x = 2.',
    [
      { content: '7', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '2', isCorrect: false },
      { content: '10', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does it mean if lim x->a f(x) exists?',
    'It means the left-hand and right-hand values approach the same number as x approaches a.',
    [
      { content: 'The outputs approach a single value from both sides.', isCorrect: true },
      { content: 'The function must equal 0 at a.', isCorrect: false },
      { content: 'The graph cannot have any points near a.', isCorrect: false },
      { content: 'The function is automatically linear.', isCorrect: false },
    ],
  ),
];

const limitsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is lim x->3 (2x - 1)?',
    'Substitute x = 3 into the linear expression: 2(3) - 1 = 5.',
    [
      { content: '5', isCorrect: true },
      { content: '6', isCorrect: false },
      { content: '3', isCorrect: false },
      { content: '4', isCorrect: false },
    ],
  ),
  toCandidate(
    'If the left-hand limit of f(x) at x = 1 is 4 and the right-hand limit is 7, what can you conclude?',
    'If the one-sided limits are different, the two-sided limit does not exist.',
    [
      { content: 'The limit as x approaches 1 does not exist.', isCorrect: true },
      { content: 'The limit is 11.', isCorrect: false },
      { content: 'The limit is 4.', isCorrect: false },
      { content: 'The limit is 7.', isCorrect: false },
    ],
  ),
];

const normalDistributionVariants: CandidateQuestion[] = [
  toCandidate(
    'In a normal distribution, where is the mean located?',
    'A normal distribution is symmetric, so the mean is at the center of the curve.',
    [
      { content: 'At the center of the bell-shaped curve', isCorrect: true },
      { content: 'At the far left tail only', isCorrect: false },
      { content: 'At the highest x-value in the data set', isCorrect: false },
      { content: 'Always one standard deviation below the median', isCorrect: false },
    ],
  ),
  toCandidate(
    'What percentage of data in a normal distribution is approximately within 1 standard deviation of the mean?',
    'By the empirical rule, about 68% of the data lie within 1 standard deviation of the mean.',
    [
      { content: '68%', isCorrect: true },
      { content: '50%', isCorrect: false },
      { content: '95%', isCorrect: false },
      { content: '99.7%', isCorrect: false },
    ],
  ),
];

const normalDistributionSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If a normal distribution has mean 70 and standard deviation 5, what value is 2 standard deviations above the mean?',
    'Two standard deviations above 70 is 70 + 2(5) = 80.',
    [
      { content: '80', isCorrect: true },
      { content: '75', isCorrect: false },
      { content: '85', isCorrect: false },
      { content: '90', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why are z-scores useful in a normal distribution?',
    'A z-score tells how many standard deviations a value is from the mean.',
    [
      { content: 'They show how far a value is from the mean in standard deviation units.', isCorrect: true },
      { content: 'They turn every distribution into a straight line.', isCorrect: false },
      { content: 'They replace the mean with the median.', isCorrect: false },
      { content: 'They guarantee a data point is an outlier.', isCorrect: false },
    ],
  ),
];

const regressionVariants: CandidateQuestion[] = [
  toCandidate(
    'What does the slope of a regression line represent?',
    'The slope represents the predicted change in y for each 1-unit increase in x.',
    [
      { content: 'The predicted change in y for each 1-unit increase in x', isCorrect: true },
      { content: 'The y-value when x is at its maximum', isCorrect: false },
      { content: 'The number of data points in the sample', isCorrect: false },
      { content: 'The standard deviation of the residuals only', isCorrect: false },
    ],
  ),
  toCandidate(
    'A regression line is y = 2x + 5. What is the predicted y-value when x = 4?',
    'Substitute x = 4 into the equation: y = 2(4) + 5 = 13.',
    [
      { content: '13', isCorrect: true },
      { content: '11', isCorrect: false },
      { content: '8', isCorrect: false },
      { content: '10', isCorrect: false },
    ],
  ),
];

const regressionSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What does a residual measure in regression?',
    'A residual is the difference between the observed value and the predicted value.',
    [
      { content: 'Observed value minus predicted value', isCorrect: true },
      { content: 'Predicted slope minus the x-value', isCorrect: false },
      { content: 'The distance from the origin to the point', isCorrect: false },
      { content: 'The total number of data points', isCorrect: false },
    ],
  ),
  toCandidate(
    'If points on a scatterplot lie close to the regression line, what does that usually suggest?',
    'Points close to the line suggest the model fits the data reasonably well.',
    [
      { content: 'The regression model is a fairly good fit for the data.', isCorrect: true },
      { content: 'There is no association between the variables.', isCorrect: false },
      { content: 'Every residual must be exactly 0.', isCorrect: false },
      { content: 'The slope of the line is undefined.', isCorrect: false },
    ],
  ),
];

const polynomialIdentitiesVariants: CandidateQuestion[] = [
  toCandidate(
    'Which expression is the expanded form of (x + 4)^2?',
    'Use the identity (a + b)^2 = a^2 + 2ab + b^2.',
    [
      { content: 'x^2 + 8x + 16', isCorrect: true },
      { content: 'x^2 + 16', isCorrect: false },
      { content: 'x^2 + 4x + 16', isCorrect: false },
      { content: '2x^2 + 16', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which identity matches x^2 - 25?',
    'A difference of squares factors as a^2 - b^2 = (a - b)(a + b).',
    [
      { content: '(x - 5)(x + 5)', isCorrect: true },
      { content: '(x - 25)(x + 1)', isCorrect: false },
      { content: '(x - 5)^2', isCorrect: false },
      { content: '(x + 25)(x - 1)', isCorrect: false },
    ],
  ),
];

const polynomialIdentitiesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the factored form of x^2 + 6x + 9?',
    'Recognize the perfect-square trinomial: x^2 + 6x + 9 = (x + 3)^2.',
    [
      { content: '(x + 3)^2', isCorrect: true },
      { content: '(x + 9)(x - 1)', isCorrect: false },
      { content: '(x + 6)^2', isCorrect: false },
      { content: '(x - 3)^2', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression is equivalent to (2x - 3)(2x + 3)?',
    'Use the difference-of-squares identity: (a - b)(a + b) = a^2 - b^2.',
    [
      { content: '4x^2 - 9', isCorrect: true },
      { content: '4x^2 + 9', isCorrect: false },
      { content: '2x^2 - 3', isCorrect: false },
      { content: '4x - 9', isCorrect: false },
    ],
  ),
];

const rationalRadicalVariants: CandidateQuestion[] = [
  toCandidate(
    'Which value is in the domain of f(x) = sqrt(x - 2)?',
    'For a square root, the expression inside the radical must be greater than or equal to 0.',
    [
      { content: '5', isCorrect: true },
      { content: '1', isCorrect: false },
      { content: '0', isCorrect: false },
      { content: '-3', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which x-value is excluded from the domain of f(x) = 3/(x + 7)?',
    'A rational function is undefined where its denominator equals 0.',
    [
      { content: '-7', isCorrect: true },
      { content: '7', isCorrect: false },
      { content: '0', isCorrect: false },
      { content: '3', isCorrect: false },
    ],
  ),
];

const rationalRadicalSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'How does sqrt(49) simplify?',
    'The principal square root of 49 is 7.',
    [
      { content: '7', isCorrect: true },
      { content: '-7', isCorrect: false },
      { content: '14', isCorrect: false },
      { content: '24.5', isCorrect: false },
    ],
  ),
  toCandidate(
    'How does 6/sqrt(3) simplify after rationalizing the denominator?',
    'Multiply numerator and denominator by sqrt(3): 6sqrt(3)/3 = 2sqrt(3).',
    [
      { content: '2sqrt(3)', isCorrect: true },
      { content: '6sqrt(3)', isCorrect: false },
      { content: '3sqrt(2)', isCorrect: false },
      { content: 'sqrt(18)', isCorrect: false },
    ],
  ),
];

const derivativesVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the derivative of x^3?',
    'Use the power rule: d/dx of x^n is nx^(n-1), so the derivative is 3x^2.',
    [
      { content: '3x^2', isCorrect: true },
      { content: 'x^2', isCorrect: false },
      { content: '3x', isCorrect: false },
      { content: 'x^4', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does the derivative of a function represent on its graph?',
    'The derivative gives the instantaneous rate of change, which appears as the slope of the tangent line.',
    [
      { content: 'The slope of the tangent line at a point', isCorrect: true },
      { content: 'The y-intercept of the graph', isCorrect: false },
      { content: 'The total area under the graph', isCorrect: false },
      { content: 'The maximum x-value only', isCorrect: false },
    ],
  ),
];

const derivativesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the derivative of 5x^2?',
    'Apply the power rule: the derivative is 10x.',
    [
      { content: '10x', isCorrect: true },
      { content: '5x', isCorrect: false },
      { content: '10x^2', isCorrect: false },
      { content: '2x', isCorrect: false },
    ],
  ),
  toCandidate(
    'If the derivative of a function is positive on an interval, what is the function doing there?',
    'A positive derivative means the function is increasing on that interval.',
    [
      { content: 'It is increasing.', isCorrect: true },
      { content: 'It is decreasing.', isCorrect: false },
      { content: 'It is constant at 0.', isCorrect: false },
      { content: 'It has no graph.', isCorrect: false },
    ],
  ),
];

const descriptiveInferentialVariants: CandidateQuestion[] = [
  toCandidate(
    'Which statement describes inferential statistics rather than descriptive statistics?',
    'Inferential statistics use sample data to make conclusions about a larger population.',
    [
      { content: 'Using a sample to estimate a population mean', isCorrect: true },
      { content: 'Calculating the average of one class quiz', isCorrect: false },
      { content: 'Listing the scores in order', isCorrect: false },
      { content: 'Finding the range of one data set only', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which measure is used to describe the center of a data set?',
    'Measures of center include the mean, median, and mode.',
    [
      { content: 'The median', isCorrect: true },
      { content: 'The interquartile range only', isCorrect: false },
      { content: 'The sample size only', isCorrect: false },
      { content: 'A residual plot', isCorrect: false },
    ],
  ),
];

const descriptiveInferentialSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A sample of students has an average height of 64 inches. Using that sample mean to estimate the school\'s average height is an example of what?',
    'Using sample data to estimate a population value is inferential statistics.',
    [
      { content: 'Inferential statistics', isCorrect: true },
      { content: 'Only descriptive statistics', isCorrect: false },
      { content: 'A geometry transformation', isCorrect: false },
      { content: 'A calculus derivative', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which graph is commonly used to display the distribution of one quantitative data set?',
    'Histograms help show the shape and spread of a quantitative data distribution.',
    [
      { content: 'A histogram', isCorrect: true },
      { content: 'A dialogue script', isCorrect: false },
      { content: 'A citation page', isCorrect: false },
      { content: 'A two-column proof', isCorrect: false },
    ],
  ),
];

const exponentialLogVariants: CandidateQuestion[] = [
  toCandidate(
    'Which function shows exponential growth?',
    'Exponential growth has the variable in the exponent and multiplies by a constant factor.',
    [
      { content: 'y = 3(2^x)', isCorrect: true },
      { content: 'y = 2x + 3', isCorrect: false },
      { content: 'y = x^2 + 1', isCorrect: false },
      { content: 'y = 3/x', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the value of log10(1000)?',
    'Because 10^3 = 1000, log10(1000) = 3.',
    [
      { content: '3', isCorrect: true },
      { content: '10', isCorrect: false },
      { content: '100', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
];

const exponentialLogSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If y = 2^x, what is y when x = 4?',
    'Substitute x = 4: 2^4 = 16.',
    [
      { content: '16', isCorrect: true },
      { content: '8', isCorrect: false },
      { content: '6', isCorrect: false },
      { content: '12', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which statement about logarithms is true?',
    'A logarithm asks what exponent gives a certain value.',
    [
      { content: 'A logarithm tells what exponent produces a given value.', isCorrect: true },
      { content: 'A logarithm is always negative.', isCorrect: false },
      { content: 'A logarithm can never equal 0.', isCorrect: false },
      { content: 'A logarithm means the same thing as a derivative.', isCorrect: false },
    ],
  ),
];

const americanBritishLitVariants: CandidateQuestion[] = [
  toCandidate(
    'Why might two texts from different literary traditions still be worth comparing?',
    'Comparing texts from different traditions helps readers analyze shared themes and distinct cultural perspectives.',
    [
      { content: 'They can reveal both common themes and different cultural perspectives.', isCorrect: true },
      { content: 'Texts from different traditions cannot be compared at all.', isCorrect: false },
      { content: 'Only the longer text matters in literary analysis.', isCorrect: false },
      { content: 'Literary traditions remove the need for textual evidence.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which question best supports analysis of a British or American literary work?',
    'Literary analysis focuses on how details, structure, and language build meaning.',
    [
      { content: 'How does the author develop theme through character and conflict?', isCorrect: true },
      { content: 'Which page has the biggest paragraph?', isCorrect: false },
      { content: 'How many commas are on one random page?', isCorrect: false },
      { content: 'Why should evidence be ignored in literary discussion?', isCorrect: false },
    ],
  ),
];

const rhetoricArgumentVariants: CandidateQuestion[] = [
  toCandidate(
    'Which statement best describes a strong argument?',
    'A strong argument includes a clear claim supported by relevant evidence and reasoning.',
    [
      { content: 'A clear claim backed by relevant evidence and reasoning', isCorrect: true },
      { content: 'A loud opinion with no evidence', isCorrect: false },
      { content: 'A list of unrelated facts', isCorrect: false },
      { content: 'A sentence that avoids any position', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why is it important to identify an author\'s rhetorical appeal?',
    'Recognizing appeals such as ethos, pathos, and logos helps readers evaluate how the argument is trying to persuade.',
    [
      { content: 'It helps readers analyze how the author tries to persuade the audience.', isCorrect: true },
      { content: 'It proves the author is always correct.', isCorrect: false },
      { content: 'It replaces the need to read the argument carefully.', isCorrect: false },
      { content: 'It matters only in fictional stories, not arguments.', isCorrect: false },
    ],
  ),
];

const trigonometryRightUnitsVariants: CandidateQuestion[] = [
  toCandidate(
    'In a right triangle, which ratio equals sin(theta)?',
    'Sine is the ratio of the opposite side to the hypotenuse.',
    [
      { content: 'opposite / hypotenuse', isCorrect: true },
      { content: 'adjacent / hypotenuse', isCorrect: false },
      { content: 'opposite / adjacent', isCorrect: false },
      { content: 'adjacent / opposite', isCorrect: false },
    ],
  ),
  toCandidate(
    'A right triangle has legs 3 and 4. What is the length of the hypotenuse?',
    'Use the Pythagorean theorem: 3^2 + 4^2 = 5^2, so the hypotenuse is 5.',
    [
      { content: '5', isCorrect: true },
      { content: '6', isCorrect: false },
      { content: '7', isCorrect: false },
      { content: '25', isCorrect: false },
    ],
  ),
];

const trigonometryRightUnitsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If cos(theta) = 12/13 in a right triangle, which side is 12?',
    'Cosine compares the adjacent side to the hypotenuse.',
    [
      { content: 'The side adjacent to theta', isCorrect: true },
      { content: 'The side opposite theta', isCorrect: false },
      { content: 'The hypotenuse', isCorrect: false },
      { content: 'The angle itself', isCorrect: false },
    ],
  ),
  toCandidate(
    'A ladder leans against a wall making a right triangle. Which measure would trigonometry help you find?',
    'Right-triangle trigonometry helps connect angles and side lengths in real situations.',
    [
      { content: 'A missing side length or angle of the right triangle', isCorrect: true },
      { content: 'The number of pages in a textbook', isCorrect: false },
      { content: 'A random person\'s favorite color', isCorrect: false },
      { content: 'Whether the wall is made of bricks or paint', isCorrect: false },
    ],
  ),
];

const trigonometricIdentitiesVariants: CandidateQuestion[] = [
  toCandidate(
    'Which identity is always true?',
    'The Pythagorean identity states sin^2(theta) + cos^2(theta) = 1.',
    [
      { content: 'sin^2(theta) + cos^2(theta) = 1', isCorrect: true },
      { content: 'sin(theta) + cos(theta) = 1', isCorrect: false },
      { content: 'tan(theta) = sin(theta) + cos(theta)', isCorrect: false },
      { content: 'sin(theta) = cos(theta) for every angle', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression is equivalent to tan(theta)?',
    'Tangent is the ratio of sine to cosine.',
    [
      { content: 'sin(theta) / cos(theta)', isCorrect: true },
      { content: 'cos(theta) / sin(theta)', isCorrect: false },
      { content: 'sin(theta) + cos(theta)', isCorrect: false },
      { content: '1 / sin(theta)', isCorrect: false },
    ],
  ),
];

const trigonometricIdentitiesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If sin(theta) = 3/5 and cos(theta) = 4/5, what is tan(theta)?',
    'tan(theta) = sin(theta) / cos(theta) = (3/5) / (4/5) = 3/4.',
    [
      { content: '3/4', isCorrect: true },
      { content: '4/3', isCorrect: false },
      { content: '7/5', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why are trig identities useful?',
    'Trig identities help rewrite expressions in equivalent forms so equations and proofs are easier to solve.',
    [
      { content: 'They let you rewrite trig expressions into equivalent forms.', isCorrect: true },
      { content: 'They make every angle equal to 90 degrees.', isCorrect: false },
      { content: 'They remove the need to justify any steps.', isCorrect: false },
      { content: 'They only work in non-math subjects.', isCorrect: false },
    ],
  ),
];

const matricesVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the dimension of the matrix [[1, 2, 3], [4, 5, 6]]?',
    'A matrix with 2 rows and 3 columns has dimension 2 x 3.',
    [
      { content: '2 x 3', isCorrect: true },
      { content: '3 x 2', isCorrect: false },
      { content: '2 x 2', isCorrect: false },
      { content: '3 x 3', isCorrect: false },
    ],
  ),
  toCandidate(
    'When can two matrices be added?',
    'Matrices can be added only when they have the same number of rows and columns.',
    [
      { content: 'When they have the same dimensions', isCorrect: true },
      { content: 'Whenever both matrices contain numbers', isCorrect: false },
      { content: 'Only when one matrix is square', isCorrect: false },
      { content: 'Only when both matrices have the same determinant', isCorrect: false },
    ],
  ),
];

const matricesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the sum of [[1, 2], [3, 4]] and [[5, 6], [7, 8]]?',
    'Add corresponding entries: [[1+5, 2+6], [3+7, 4+8]] = [[6, 8], [10, 12]].',
    [
      { content: '[[6, 8], [10, 12]]', isCorrect: true },
      { content: '[[5, 12], [21, 32]]', isCorrect: false },
      { content: '[[6, 6], [10, 10]]', isCorrect: false },
      { content: '[[1, 2], [7, 8]]', isCorrect: false },
    ],
  ),
  toCandidate(
    'If a 2 x 3 matrix is multiplied by a 3 x 4 matrix, what is the dimension of the product?',
    'The inner dimensions match, and the product keeps the outer dimensions: 2 x 4.',
    [
      { content: '2 x 4', isCorrect: true },
      { content: '3 x 3', isCorrect: false },
      { content: '2 x 3', isCorrect: false },
      { content: '4 x 2', isCorrect: false },
    ],
  ),
];

const conicSectionsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which graph is a parabola?',
    'A parabola is the graph of a quadratic relation such as y = x^2.',
    [
      { content: 'y = x^2', isCorrect: true },
      { content: 'x^2 + y^2 = 1', isCorrect: false },
      { content: 'x/4 + y/3 = 1', isCorrect: false },
      { content: 'xy = 6', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which equation represents a circle centered at the origin?',
    'A circle centered at the origin has the form x^2 + y^2 = r^2.',
    [
      { content: 'x^2 + y^2 = 16', isCorrect: true },
      { content: 'y = x^2 - 4', isCorrect: false },
      { content: 'xy = 5', isCorrect: false },
      { content: 'x^2 - y^2 = 9', isCorrect: false },
    ],
  ),
];

const conicSectionsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the radius of the circle x^2 + y^2 = 25?',
    'In standard form x^2 + y^2 = r^2, the radius is sqrt(25) = 5.',
    [
      { content: '5', isCorrect: true },
      { content: '25', isCorrect: false },
      { content: '10', isCorrect: false },
      { content: '2.5', isCorrect: false },
    ],
  ),
  toCandidate(
    'A parabola has equation y = (x - 2)^2 + 3. What is its vertex?',
    'In vertex form y = (x - h)^2 + k, the vertex is (h, k).',
    [
      { content: '(2, 3)', isCorrect: true },
      { content: '(-2, 3)', isCorrect: false },
      { content: '(3, 2)', isCorrect: false },
      { content: '(2, -3)', isCorrect: false },
    ],
  ),
];

const poetryDramaVariants: CandidateQuestion[] = [
  toCandidate(
    'Which feature is most characteristic of drama rather than prose?',
    'Drama is usually written with dialogue and stage directions for performance.',
    [
      { content: 'Dialogue and stage directions', isCorrect: true },
      { content: 'A paragraph explaining the weather', isCorrect: false },
      { content: 'A data table with no speakers', isCorrect: false },
      { content: 'Only a list of vocabulary definitions', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which detail would best help a reader identify figurative language in a poem?',
    'Poetry often uses imagery and comparisons such as similes and metaphors.',
    [
      { content: 'A line comparing the Moon to a silver lantern', isCorrect: true },
      { content: 'A sentence giving a room number', isCorrect: false },
      { content: 'A list of page numbers', isCorrect: false },
      { content: 'A chart of lunch prices', isCorrect: false },
    ],
  ),
];

const academicVocabularyVariants: CandidateQuestion[] = [
  toCandidate(
    'In a science article, what is the best strategy for figuring out the meaning of an unfamiliar discipline-specific term?',
    'Readers use nearby context, prefixes or roots, and the sentence around the term to infer meaning.',
    [
      { content: 'Use context clues in the sentence and surrounding paragraph.', isCorrect: true },
      { content: 'Skip the term and assume it means anything you want.', isCorrect: false },
      { content: 'Replace it with a random everyday word.', isCorrect: false },
      { content: 'Ignore all of the text after the term appears.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why is precise academic vocabulary important on reading and writing assessments?',
    'Precise vocabulary helps readers and writers communicate ideas accurately and understand what a question is asking.',
    [
      { content: 'It helps communicate ideas accurately and understand prompts clearly.', isCorrect: true },
      { content: 'It makes evidence unnecessary.', isCorrect: false },
      { content: 'It guarantees every answer is correct.', isCorrect: false },
      { content: 'It replaces the need to read the passage.', isCorrect: false },
    ],
  ),
];

const researchWritingVariants: CandidateQuestion[] = [
  toCandidate(
    'Which source is most appropriate to cite in a research paper about water quality?',
    'A credible research paper should cite reliable, relevant sources such as a government environmental report.',
    [
      { content: 'A recent government report with water-quality data', isCorrect: true },
      { content: 'An anonymous comment with no evidence', isCorrect: false },
      { content: 'A meme with no source listed', isCorrect: false },
      { content: 'A fictional story unrelated to water quality', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the main purpose of MLA or APA citation in academic writing?',
    'Citation gives credit to sources and helps readers trace where information came from.',
    [
      { content: 'To credit sources and help readers locate the evidence used', isCorrect: true },
      { content: 'To make the paper longer without adding information', isCorrect: false },
      { content: 'To remove the need for quotations or paraphrases', isCorrect: false },
      { content: 'To prove every source agrees with the writer', isCorrect: false },
    ],
  ),
];

const seminarPresentationVariants: CandidateQuestion[] = [
  toCandidate(
    'During an academic discussion, which response best builds on another speaker\'s idea?',
    'Strong discussion responses refer to another speaker\'s point and then extend it with evidence or reasoning.',
    [
      { content: 'I want to add to Maya\'s point by using the evidence from paragraph 3.', isCorrect: true },
      { content: 'That is wrong because I said so.', isCorrect: false },
      { content: 'I will repeat my opinion without listening to anyone else.', isCorrect: false },
      { content: 'The text does not matter in this discussion.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which feature most improves a formal presentation?',
    'A clear claim supported by organized evidence helps an audience follow the presentation.',
    [
      { content: 'A clear claim supported by organized evidence', isCorrect: true },
      { content: 'Speaking as fast as possible without structure', isCorrect: false },
      { content: 'Reading random facts with no connection', isCorrect: false },
      { content: 'Avoiding all visuals and explanations on purpose', isCorrect: false },
    ],
  ),
];

const primarySourcesVariants: CandidateQuestion[] = [
  toCandidate(
    'Why is a primary source valuable when studying history or informational texts?',
    'A primary source gives direct evidence from the time, event, or person being studied.',
    [
      { content: 'It provides firsthand evidence connected to the event or time period.', isCorrect: true },
      { content: 'It always explains every event perfectly with no need for analysis.', isCorrect: false },
      { content: 'It replaces the need to check any details or context.', isCorrect: false },
      { content: 'It is always more recent than every secondary source.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which source is most likely a primary source for a study of the Civil Rights Movement?',
    'A primary source comes directly from the period being studied, such as a speech, letter, or photograph from that time.',
    [
      { content: 'A speech delivered by a civil rights leader during the movement', isCorrect: true },
      { content: 'A modern textbook chapter summarizing the movement', isCorrect: false },
      { content: 'A recent encyclopedia article', isCorrect: false },
      { content: 'A student\'s opinion written last week with no evidence', isCorrect: false },
    ],
  ),
];

const showTellRetellingVariants: CandidateQuestion[] = [
  toCandidate(
    'Why is retelling a story important after reading?',
    'Retelling helps a reader remember the important events in the correct order.',
    [
      { content: 'It helps the reader remember the important events in order.', isCorrect: true },
      { content: 'It means the story can change every time with no reason.', isCorrect: false },
      { content: 'It replaces listening to the story in the first place.', isCorrect: false },
      { content: 'It only matters if the story has animals.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which detail belongs in a retelling of a story?',
    'A retelling includes key events, not unrelated opinions or random details.',
    [
      { content: 'An important event that happened in the story', isCorrect: true },
      { content: 'A random fact that was never in the story', isCorrect: false },
      { content: 'Only the reader\'s favorite snack', isCorrect: false },
      { content: 'A made-up ending with no connection to the text', isCorrect: false },
    ],
  ),
];

const simpleNonfictionVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do readers use headings in a nonfiction book about animals?',
    'Headings help readers find information and understand what each section is about.',
    [
      { content: 'They help readers find and organize information.', isCorrect: true },
      { content: 'They turn the book into a poem.', isCorrect: false },
      { content: 'They make all the pictures disappear.', isCorrect: false },
      { content: 'They are only used in made-up stories.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which text feature would best help a reader learn where a place is located?',
    'A map is a nonfiction text feature that shows location.',
    [
      { content: 'A map', isCorrect: true },
      { content: 'A speech bubble', isCorrect: false },
      { content: 'A joke page', isCorrect: false },
      { content: 'A table of contents from another book', isCorrect: false },
    ],
  ),
];

const fablesFolktalesVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do readers pay attention to the lesson in a fable?',
    'Many fables teach a lesson or moral through the events in the story.',
    [
      { content: 'Because the story often teaches a lesson or moral', isCorrect: true },
      { content: 'Because fables never have characters', isCorrect: false },
      { content: 'Because only the title matters in a fable', isCorrect: false },
      { content: 'Because the moral is always hidden in the page number', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is a folktale?',
    'A folktale is a story passed down and told again over time.',
    [
      { content: 'A story that is told and retold over time', isCorrect: true },
      { content: 'A list of science facts only', isCorrect: false },
      { content: 'A graph used in math class', isCorrect: false },
      { content: 'A rule for measuring length', isCorrect: false },
    ],
  ),
];

const poetryShortFormsVariants: CandidateQuestion[] = [
  toCandidate(
    'What makes a short poem different from a paragraph?',
    'Poems are often arranged in lines and may use rhythm or repeated sounds.',
    [
      { content: 'It is written in lines and may use rhythm or repeated sounds.', isCorrect: true },
      { content: 'It always has to be longer than a paragraph.', isCorrect: false },
      { content: 'It cannot use any describing words.', isCorrect: false },
      { content: 'It is only used for nonfiction reports.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which line sounds like part of a poem?',
    'Poems often use rhythm or vivid language to create a feeling or image.',
    [
      { content: 'The rain tapped a tiny song on the roof.', isCorrect: true },
      { content: 'Page 4 has 2 pictures and 1 chart.', isCorrect: false },
      { content: 'Put the book on shelf 3 after lunch.', isCorrect: false },
      { content: 'My class has 18 students and 2 teachers.', isCorrect: false },
    ],
  ),
];

const compareNumbersVariants: CandidateQuestion[] = [
  toCandidate(
    'Which number is greater: 42 or 39?',
    'Compare the tens first. 42 has 4 tens and 39 has 3 tens, so 42 is greater.',
    [
      { content: '42', isCorrect: true },
      { content: '39', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'There is no way to tell', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which symbol shows 18 is less than 21?',
    'The less-than symbol points to the smaller number: 18 < 21.',
    [
      { content: '<', isCorrect: true },
      { content: '>', isCorrect: false },
      { content: '=', isCorrect: false },
      { content: '+', isCorrect: false },
    ],
  ),
];

const compareNumbersSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which number is smaller: 56 or 65?',
    'Compare the tens digits: 5 tens is less than 6 tens, so 56 is smaller.',
    [
      { content: '56', isCorrect: true },
      { content: '65', isCorrect: false },
      { content: 'They are the same', isCorrect: false },
      { content: 'There is no smaller number', isCorrect: false },
    ],
  ),
  toCandidate(
    'If a number has 2 tens and another has 4 tens, which number is greater?',
    'The number with more tens is greater.',
    [
      { content: 'The number with 4 tens', isCorrect: true },
      { content: 'The number with 2 tens', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'You should compare only the ones digits', isCorrect: false },
    ],
  ),
];

const simpleProbabilityVariants: CandidateQuestion[] = [
  toCandidate(
    'If a bag has 3 red cubes and 1 blue cube, which color are you more likely to pick?',
    'The color with more cubes is more likely to be chosen.',
    [
      { content: 'red', isCorrect: true },
      { content: 'blue', isCorrect: false },
      { content: 'They are equally likely', isCorrect: false },
      { content: 'Neither color can be picked', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which event is impossible?',
    'An impossible event cannot happen.',
    [
      { content: 'Rolling a 7 on a standard number cube', isCorrect: true },
      { content: 'Rolling a 3 on a standard number cube', isCorrect: false },
      { content: 'Picking one marble from a bag', isCorrect: false },
      { content: 'Flipping a coin', isCorrect: false },
    ],
  ),
];

const simpleProbabilitySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A spinner has 4 equal parts: 2 green, 1 yellow, and 1 red. Which color is most likely?',
    'A color that appears on more equal sections is more likely.',
    [
      { content: 'green', isCorrect: true },
      { content: 'yellow', isCorrect: false },
      { content: 'red', isCorrect: false },
      { content: 'yellow and red together as one color', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does likely mean?',
    'Likely means something has a good chance of happening.',
    [
      { content: 'It has a good chance of happening.', isCorrect: true },
      { content: 'It can never happen.', isCorrect: false },
      { content: 'It already happened yesterday.', isCorrect: false },
      { content: 'It always happens every single time.', isCorrect: false },
    ],
  ),
];

const probabilityExperimentalVariants: CandidateQuestion[] = [
  toCandidate(
    'A spinner is spun 20 times and lands on blue 12 times. What is the experimental probability of landing on blue?',
    'Experimental probability is based on what happened in the trials, so use 12 successes out of 20 spins.',
    [
      { content: '12/20', isCorrect: true },
      { content: '1/2', isCorrect: false },
      { content: '20/12', isCorrect: false },
      { content: '8/20', isCorrect: false },
    ],
  ),
  toCandidate(
    'A coin is flipped 10 times and lands on heads 7 times. What is the experimental probability of heads?',
    'Use the results from the experiment: heads happened 7 times out of 10 flips.',
    [
      { content: '7/10', isCorrect: true },
      { content: '1/2', isCorrect: false },
      { content: '3/10', isCorrect: false },
      { content: '10/7', isCorrect: false },
    ],
  ),
];

const probabilityExperimentalSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A bag was tested by drawing a marble 15 times with replacement. Red appeared 9 times. Which fraction shows the experimental probability of red?',
    'Experimental probability compares how many times red happened to the total number of trials.',
    [
      { content: '9/15', isCorrect: true },
      { content: '6/15', isCorrect: false },
      { content: '15/9', isCorrect: false },
      { content: '1/2', isCorrect: false },
    ],
  ),
  toCandidate(
    'A spinner landed on green 4 times out of 12 spins. Which statement is true?',
    'The experimental probability is 4 out of 12 because that is what happened in the trials.',
    [
      { content: 'The experimental probability of green is 4/12.', isCorrect: true },
      { content: 'The experimental probability of green is always 1/2.', isCorrect: false },
      { content: 'Green is impossible.', isCorrect: false },
      { content: 'The result must be 12/4.', isCorrect: false },
    ],
  ),
];

const ratiosProportionalVariants: CandidateQuestion[] = [
  toCandidate(
    'A recipe uses 2 cups of rice for 6 servings. How many cups of rice are needed for 12 servings if the ratio stays the same?',
    'Twelve servings is double 6 servings, so double the rice from 2 cups to 4 cups.',
    [
      { content: '4 cups', isCorrect: true },
      { content: '3 cups', isCorrect: false },
      { content: '6 cups', isCorrect: false },
      { content: '12 cups', isCorrect: false },
    ],
  ),
  toCandidate(
    'A car travels 180 miles in 3 hours at a constant rate. What is the unit rate?',
    'Divide total miles by total hours to find the constant rate: 180 ÷ 3 = 60.',
    [
      { content: '60 miles per hour', isCorrect: true },
      { content: '90 miles per hour', isCorrect: false },
      { content: '30 miles per hour', isCorrect: false },
      { content: '540 miles per hour', isCorrect: false },
    ],
  ),
];

const ratiosProportionalSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A store sells 5 notebooks for $10. If the price is proportional, how much do 2 notebooks cost?',
    'Find the unit price first: $10 ÷ 5 = $2 per notebook. Then multiply by 2 notebooks.',
    [
      { content: '$4', isCorrect: true },
      { content: '$2', isCorrect: false },
      { content: '$5', isCorrect: false },
      { content: '$20', isCorrect: false },
    ],
  ),
  toCandidate(
    'A table shows x = 2, 4, 6 and y = 6, 12, 18. What is the constant of proportionality?',
    'Divide y by x to check the ratio. Each pair gives 3, so the constant of proportionality is 3.',
    [
      { content: '3', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '6', isCorrect: false },
      { content: '12', isCorrect: false },
    ],
  ),
];

const presentationsSummariesVariants: CandidateQuestion[] = [
  toCandidate(
    'Which detail belongs in a good summary of an article?',
    'A summary includes the main idea and the most important supporting details, not every tiny fact.',
    [
      { content: 'the main idea and key details', isCorrect: true },
      { content: 'every sentence copied word for word', isCorrect: false },
      { content: 'only the page number', isCorrect: false },
      { content: 'a random opinion unrelated to the text', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do speakers organize a presentation before they begin?',
    'Good presentations are organized so the audience can follow the main idea and supporting points.',
    [
      { content: 'to help the audience follow the ideas clearly', isCorrect: true },
      { content: 'to make the presentation as confusing as possible', isCorrect: false },
      { content: 'so no evidence is needed', isCorrect: false },
      { content: 'because presentations never have a main point', isCorrect: false },
    ],
  ),
];

const academicVocabularyRootsVariants: CandidateQuestion[] = [
  toCandidate(
    'If the root "bio" means life, what does biology study?',
    'Knowing Greek and Latin roots helps readers figure out word meanings. "Bio" means life.',
    [
      { content: 'living things', isCorrect: true },
      { content: 'only rocks', isCorrect: false },
      { content: 'weather maps only', isCorrect: false },
      { content: 'musical rhythms', isCorrect: false },
    ],
  ),
  toCandidate(
    'The root "graph" means write. Which word is most connected to writing or recording information?',
    'Greek and Latin roots can help readers connect unfamiliar words to known meanings.',
    [
      { content: 'autograph', isCorrect: true },
      { content: 'triangle', isCorrect: false },
      { content: 'subtract', isCorrect: false },
      { content: 'volcano', isCorrect: false },
    ],
  ),
];

const rootsPrefixesSuffixesVariants: CandidateQuestion[] = [
  toCandidate(
    'If the prefix "re-" means again, what does the word "rewrite" mean?',
    'Knowing prefixes helps readers figure out meanings. "Re-" means again.',
    [
      { content: 'to write again', isCorrect: true },
      { content: 'to stop writing', isCorrect: false },
      { content: 'to write very slowly', isCorrect: false },
      { content: 'to read once', isCorrect: false },
    ],
  ),
  toCandidate(
    'If the suffix "-less" means without, what does "hopeless" mean?',
    'Suffixes change word meanings. "-less" means without.',
    [
      { content: 'without hope', isCorrect: true },
      { content: 'full of hope', isCorrect: false },
      { content: 'hoping once', isCorrect: false },
      { content: 'a place to hop', isCorrect: false },
    ],
  ),
];

const nonfictionArticlesVariants: CandidateQuestion[] = [
  toCandidate(
    'What should a reader look for first in a nonfiction article?',
    'Nonfiction articles usually present a main idea supported by facts, headings, and details.',
    [
      { content: 'the main idea and the facts that support it', isCorrect: true },
      { content: 'a made-up dragon character', isCorrect: false },
      { content: 'a rhyme scheme in every paragraph', isCorrect: false },
      { content: 'only the page number', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do nonfiction articles often use headings and captions?',
    'Text features help readers find important information and understand what the article is explaining.',
    [
      { content: 'to help readers organize and understand information', isCorrect: true },
      { content: 'to hide the important facts', isCorrect: false },
      { content: 'to turn the article into fiction', isCorrect: false },
      { content: 'to remove the need for reading the text', isCorrect: false },
    ],
  ),
];

const mythsLegendsVariants: CandidateQuestion[] = [
  toCandidate(
    'What do myths and legends often explain?',
    'Myths and legends often explain natural events, cultural beliefs, or heroic stories.',
    [
      { content: 'important stories, beliefs, or events people wanted to explain', isCorrect: true },
      { content: 'only math formulas', isCorrect: false },
      { content: 'directions for using technology', isCorrect: false },
      { content: 'weather data tables only', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do readers look for a lesson or theme in myths and legends?',
    'These stories often communicate values, warnings, or explanations through characters and events.',
    [
      { content: 'because the story often teaches an idea or lesson', isCorrect: true },
      { content: 'because myths never have characters', isCorrect: false },
      { content: 'because only the title matters', isCorrect: false },
      { content: 'because they are always nonfiction reports', isCorrect: false },
    ],
  ),
];

const novellasVariants: CandidateQuestion[] = [
  toCandidate(
    'How is a novella or short novel different from a short story?',
    'A novella is longer than a short story and usually develops characters and plot in more depth.',
    [
      { content: 'It is longer and often develops the story in more detail.', isCorrect: true },
      { content: 'It has no plot or characters.', isCorrect: false },
      { content: 'It can only be one paragraph long.', isCorrect: false },
      { content: 'It is always a poem.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do readers track how conflicts change across chapters in a short novel?',
    'Following conflict helps readers understand how the story develops over time.',
    [
      { content: 'to understand how the story develops', isCorrect: true },
      { content: 'to ignore the main events', isCorrect: false },
      { content: 'because chapter books never change', isCorrect: false },
      { content: 'to replace reading with guessing', isCorrect: false },
    ],
  ),
];

const shortStoriesVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do readers pay attention to conflict in a short story?',
    'Conflict helps drive the plot and reveals what characters want or face.',
    [
      { content: 'It helps show what the story is really about.', isCorrect: true },
      { content: 'It is never connected to the plot.', isCorrect: false },
      { content: 'Only the title matters in a short story.', isCorrect: false },
      { content: 'Short stories do not have problems to solve.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What should a reader notice about the ending of a short story?',
    'The ending often resolves the conflict or reveals the theme.',
    [
      { content: 'how it resolves the conflict or reveals the theme', isCorrect: true },
      { content: 'only the font size on the last page', isCorrect: false },
      { content: 'whether the story has chapter numbers', isCorrect: false },
      { content: 'a random unrelated fact', isCorrect: false },
    ],
  ),
];

const historicalDocumentsVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do historians read historical documents?',
    'Historical documents provide evidence from the time being studied.',
    [
      { content: 'to learn from evidence created during the time period', isCorrect: true },
      { content: 'to replace all maps and timelines', isCorrect: false },
      { content: 'to avoid using facts', isCorrect: false },
      { content: 'to read only fictional stories', isCorrect: false },
    ],
  ),
  toCandidate(
    'What should a reader ask when reading a historical document?',
    'Readers should think about who created it, when it was made, and what point of view it shows.',
    [
      { content: 'Who created it, and what point of view does it show?', isCorrect: true },
      { content: 'Does it rhyme like a poem?', isCorrect: false },
      { content: 'Is it the shortest source available?', isCorrect: false },
      { content: 'What color is the paper only?', isCorrect: false },
    ],
  ),
];

const chapterBooksVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do readers pay attention to how a character changes across a chapter book?',
    'Chapter books often develop characters over time, so readers track how events affect them.',
    [
      { content: 'It helps readers understand the character and the story better.', isCorrect: true },
      { content: 'Characters in chapter books never change.', isCorrect: false },
      { content: 'Only the cover matters in a chapter book.', isCorrect: false },
      { content: 'Readers should ignore important events.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What helps a reader keep track of important events in a chapter book?',
    'Readers follow the sequence of chapters and major events to understand how the story unfolds.',
    [
      { content: 'paying attention to the sequence of chapters and events', isCorrect: true },
      { content: 'reading only the last page', isCorrect: false },
      { content: 'skipping every chapter title and detail', isCorrect: false },
      { content: 'looking only at page numbers', isCorrect: false },
    ],
  ),
];

const essaysResearchArgumentVariants: CandidateQuestion[] = [
  toCandidate(
    'What makes a strong argumentative paragraph?',
    'A strong argumentative paragraph states a claim and supports it with reasons and evidence.',
    [
      { content: 'a clear claim supported by reasons and evidence', isCorrect: true },
      { content: 'a random opinion with no support', isCorrect: false },
      { content: 'a list of unrelated words', isCorrect: false },
      { content: 'only copied sentences with no point', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do writers use evidence in an essay or research response?',
    'Evidence supports the writer\'s ideas and helps convince or inform the reader.',
    [
      { content: 'to support the main idea or claim', isCorrect: true },
      { content: 'to make the essay longer without meaning', isCorrect: false },
      { content: 'to avoid having a topic', isCorrect: false },
      { content: 'to replace every complete sentence', isCorrect: false },
    ],
  ),
];

const debatesMultimediaVariants: CandidateQuestion[] = [
  toCandidate(
    'What makes a speaker\'s argument stronger in a debate or presentation?',
    'A strong argument uses clear reasons and evidence to support the speaker\'s claim.',
    [
      { content: 'reasons and evidence that support the claim', isCorrect: true },
      { content: 'speaking the loudest without support', isCorrect: false },
      { content: 'changing topics every sentence', isCorrect: false },
      { content: 'using only unrelated pictures', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why might a presenter use a chart or image during a multimedia presentation?',
    'Multimedia elements can help the audience understand information more clearly.',
    [
      { content: 'to help explain or support the ideas being presented', isCorrect: true },
      { content: 'to replace every spoken word', isCorrect: false },
      { content: 'to hide the main point', isCorrect: false },
      { content: 'because evidence is not needed in presentations', isCorrect: false },
    ],
  ),
];

const samplingInferenceVariants: CandidateQuestion[] = [
  toCandidate(
    'A school wants to know students\' favorite lunch. Which sample is most likely to be representative?',
    'A representative sample should include students from across the school, not just one small group.',
    [
      { content: 'students chosen from several grades and classes', isCorrect: true },
      { content: 'only the basketball team', isCorrect: false },
      { content: 'only one table in the cafeteria', isCorrect: false },
      { content: 'only students who arrive first in the morning', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is an inference in statistics?',
    'An inference is a conclusion about a larger group based on data from a sample.',
    [
      { content: 'a conclusion about a population based on sample data', isCorrect: true },
      { content: 'a random guess with no data', isCorrect: false },
      { content: 'the same thing as a census every time', isCorrect: false },
      { content: 'a graph title', isCorrect: false },
    ],
  ),
];

const scatterplotsCorrelationVariants: CandidateQuestion[] = [
  toCandidate(
    'What does a positive correlation on a scatterplot mean?',
    'A positive correlation means the points tend to rise from left to right as both variables increase together.',
    [
      { content: 'As one variable increases, the other tends to increase.', isCorrect: true },
      { content: 'As one variable increases, the other always decreases.', isCorrect: false },
      { content: 'The variables are categories instead of numbers.', isCorrect: false },
      { content: 'There is no pattern at all.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A scatterplot shows study time and test score. The points rise from left to right. What is the best description?',
    'Rising points suggest a positive association between the two variables.',
    [
      { content: 'There is a positive correlation.', isCorrect: true },
      { content: 'There is a negative correlation.', isCorrect: false },
      { content: 'There is no relationship.', isCorrect: false },
      { content: 'The graph is a bar chart.', isCorrect: false },
    ],
  ),
];

const scatterplotsCorrelationSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What should you check first when reading a scatterplot?',
    'Start by identifying the two variables shown on the axes and then look for a pattern.',
    [
      { content: 'the variables on the x-axis and y-axis', isCorrect: true },
      { content: 'only the title color', isCorrect: false },
      { content: 'the last point only', isCorrect: false },
      { content: 'whether all points are the same shape', isCorrect: false },
    ],
  ),
  toCandidate(
    'If points on a scatterplot are spread randomly with no clear trend, what does that suggest?',
    'A random spread suggests little or no correlation.',
    [
      { content: 'There is little or no correlation.', isCorrect: true },
      { content: 'There is a strong positive correlation.', isCorrect: false },
      { content: 'There is a perfect negative correlation.', isCorrect: false },
      { content: 'The graph must be incorrect.', isCorrect: false },
    ],
  ),
];

const areaPerimeterVariants: CandidateQuestion[] = [
  toCandidate(
    'A rectangle is 6 units long and 4 units wide. What is its area?',
    'Area of a rectangle is length multiplied by width: 6 x 4 = 24.',
    [
      { content: '24 square units', isCorrect: true },
      { content: '20 units', isCorrect: false },
      { content: '10 square units', isCorrect: false },
      { content: '24 units', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does perimeter measure?',
    'Perimeter is the total distance around a shape.',
    [
      { content: 'the distance around a shape', isCorrect: true },
      { content: 'the space inside a shape', isCorrect: false },
      { content: 'the number of corners only', isCorrect: false },
      { content: 'the height of a shape', isCorrect: false },
    ],
  ),
];

const areaPerimeterSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A square has side length 5 units. What is its perimeter?',
    'A square has four equal sides, so add 5 four times: 20.',
    [
      { content: '20 units', isCorrect: true },
      { content: '25 square units', isCorrect: false },
      { content: '10 units', isCorrect: false },
      { content: '15 units', isCorrect: false },
    ],
  ),
  toCandidate(
    'When should you use square units in an answer?',
    'Square units are used for area because area measures the surface inside a shape.',
    [
      { content: 'when finding area', isCorrect: true },
      { content: 'when finding perimeter', isCorrect: false },
      { content: 'when counting vertices only', isCorrect: false },
      { content: 'when naming an angle', isCorrect: false },
    ],
  ),
];

const transformationsSymmetryVariants: CandidateQuestion[] = [
  toCandidate(
    'Which figure has line symmetry?',
    'A figure has line symmetry if it can be folded along a line so both halves match.',
    [
      { content: 'a square', isCorrect: true },
      { content: 'a scalene triangle', isCorrect: false },
      { content: 'an irregular scribble', isCorrect: false },
      { content: 'an open zigzag line', isCorrect: false },
    ],
  ),
  toCandidate(
    'What transformation flips a figure across a line?',
    'A reflection flips a figure over a line of reflection.',
    [
      { content: 'reflection', isCorrect: true },
      { content: 'translation', isCorrect: false },
      { content: 'dilation', isCorrect: false },
      { content: 'scaling', isCorrect: false },
    ],
  ),
];

const transformationsSymmetrySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If a shape slides 3 units to the right without turning, what transformation happened?',
    'A translation slides a figure without rotating or flipping it.',
    [
      { content: 'translation', isCorrect: true },
      { content: 'reflection', isCorrect: false },
      { content: 'rotation', isCorrect: false },
      { content: 'dilation', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does rotational symmetry mean?',
    'A figure has rotational symmetry if it matches itself after being turned less than a full turn.',
    [
      { content: 'It matches itself after a turn.', isCorrect: true },
      { content: 'It only matches after being stretched.', isCorrect: false },
      { content: 'It has no sides.', isCorrect: false },
      { content: 'It can only be reflected, never turned.', isCorrect: false },
    ],
  ),
];

const roundingEstimationVariants: CandidateQuestion[] = [
  toCandidate(
    'Round 347 to the nearest hundred.',
    '347 is closer to 300 than 400 because the tens digit is 4, which is less than 5.',
    [
      { content: '300', isCorrect: true },
      { content: '350', isCorrect: false },
      { content: '400', isCorrect: false },
      { content: '347', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which estimate is closest to 198 + 203?',
    'Round 198 to 200 and 203 to 200, so the sum is about 400.',
    [
      { content: '400', isCorrect: true },
      { content: '200', isCorrect: false },
      { content: '300', isCorrect: false },
      { content: '500', isCorrect: false },
    ],
  ),
];

const roundingEstimationSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What digit helps you decide whether to round 6,482 to 6,500 or 6,400 when rounding to the nearest hundred?',
    'Look at the tens digit to decide how to round to the nearest hundred.',
    [
      { content: 'the tens digit', isCorrect: true },
      { content: 'the thousands digit', isCorrect: false },
      { content: 'the ones digit only', isCorrect: false },
      { content: 'the decimal point', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why is estimation useful?',
    'Estimation helps you make quick reasonable answers and check whether exact answers make sense.',
    [
      { content: 'It helps you judge whether an answer is reasonable.', isCorrect: true },
      { content: 'It replaces exact math forever.', isCorrect: false },
      { content: 'It only works for geometry.', isCorrect: false },
      { content: 'It means you never use numbers.', isCorrect: false },
    ],
  ),
];

const decimalsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which decimal is equal to 3 tenths?',
    'Three tenths is written as 0.3.',
    [
      { content: '0.3', isCorrect: true },
      { content: '3.0', isCorrect: false },
      { content: '0.03', isCorrect: false },
      { content: '30.0', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which number is greater: 0.7 or 0.65?',
    'Write 0.7 as 0.70. Since 70 hundredths is greater than 65 hundredths, 0.7 is greater.',
    [
      { content: '0.7', isCorrect: true },
      { content: '0.65', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'There is no way to compare them', isCorrect: false },
    ],
  ),
];

const decimalsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What digit is in the hundredths place in 4.28?',
    'The hundredths digit is the second digit to the right of the decimal point.',
    [
      { content: '8', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '4', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is 0.4 + 0.2?',
    'Add tenths: 4 tenths plus 2 tenths equals 6 tenths.',
    [
      { content: '0.6', isCorrect: true },
      { content: '0.42', isCorrect: false },
      { content: '0.2', isCorrect: false },
      { content: '0.8', isCorrect: false },
    ],
  ),
];

const coordinateGeometryVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the distance between (2, 3) and (2, 8)?',
    'The x-coordinates are the same, so count the vertical difference: 8 - 3 = 5.',
    [
      { content: '5 units', isCorrect: true },
      { content: '10 units', isCorrect: false },
      { content: '3 units', isCorrect: false },
      { content: '6 units', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which point lies on the y-axis?',
    'Points on the y-axis have an x-coordinate of 0.',
    [
      { content: '(0, 4)', isCorrect: true },
      { content: '(4, 0)', isCorrect: false },
      { content: '(2, 3)', isCorrect: false },
      { content: '(5, 1)', isCorrect: false },
    ],
  ),
];

const coordinateGeometrySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'How can you tell whether a point is on the x-axis?',
    'Points on the x-axis have a y-coordinate of 0.',
    [
      { content: 'Its y-coordinate is 0.', isCorrect: true },
      { content: 'Its x-coordinate is 0.', isCorrect: false },
      { content: 'Both coordinates are negative.', isCorrect: false },
      { content: 'The coordinates are equal.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does the ordered pair (5, 2) tell you to do on a coordinate grid?',
    'Move 5 units along the x-axis and then 2 units along the y-axis.',
    [
      { content: 'Go 5 right, then 2 up.', isCorrect: true },
      { content: 'Go 2 right, then 5 up.', isCorrect: false },
      { content: 'Go 5 up, then 2 left.', isCorrect: false },
      { content: 'Stay at the origin.', isCorrect: false },
    ],
  ),
];

const biographiesVariants: CandidateQuestion[] = [
  toCandidate(
    'What makes a biography different from a fictional story?',
    'A biography tells about a real person\'s life using true information.',
    [
      { content: 'It tells true information about a real person.', isCorrect: true },
      { content: 'It always includes magic and made-up creatures.', isCorrect: false },
      { content: 'It never uses dates or facts.', isCorrect: false },
      { content: 'It is only a list of chapter titles.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do readers pay attention to important events in a biography?',
    'Important events help readers understand the person\'s life and accomplishments.',
    [
      { content: 'They show how the person\'s life changed over time.', isCorrect: true },
      { content: 'They are not connected to the person at all.', isCorrect: false },
      { content: 'Only the illustration style matters in a biography.', isCorrect: false },
      { content: 'Biographies never include major events.', isCorrect: false },
    ],
  ),
];

const fractionsConceptsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which fraction is equivalent to 1/2?',
    'Equivalent fractions name the same amount. 2/4 is the same as 1/2.',
    [
      { content: '2/4', isCorrect: true },
      { content: '1/4', isCorrect: false },
      { content: '3/4', isCorrect: false },
      { content: '2/3', isCorrect: false },
    ],
  ),
  toCandidate(
    'A shape is divided into 4 equal parts and 3 are shaded. Which fraction is shaded?',
    'The numerator counts shaded parts and the denominator counts all equal parts.',
    [
      { content: '3/4', isCorrect: true },
      { content: '1/4', isCorrect: false },
      { content: '4/3', isCorrect: false },
      { content: '2/4', isCorrect: false },
    ],
  ),
];

const fractionsConceptsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which fraction is equivalent to 3/6?',
    'Simplify 3/6 by dividing numerator and denominator by 3 to get 1/2.',
    [
      { content: '1/2', isCorrect: true },
      { content: '3/12', isCorrect: false },
      { content: '2/3', isCorrect: false },
      { content: '6/3', isCorrect: false },
    ],
  ),
  toCandidate(
    'A pizza is cut into 8 equal slices and 4 are eaten. What fraction of the pizza was eaten?',
    'The fraction eaten is the number of slices eaten over the total number of slices: 4/8.',
    [
      { content: '4/8', isCorrect: true },
      { content: '8/4', isCorrect: false },
      { content: '1/8', isCorrect: false },
      { content: '3/8', isCorrect: false },
    ],
  ),
];

const multiplicationDivisionVariants: CandidateQuestion[] = [
  toCandidate(
    'What is 6 x 4?',
    'Multiplication combines equal groups. 6 groups of 4 make 24.',
    [
      { content: '24', isCorrect: true },
      { content: '10', isCorrect: false },
      { content: '20', isCorrect: false },
      { content: '26', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is 18 ÷ 3?',
    'Division finds how many equal groups or how many are in each group. 18 divided by 3 is 6.',
    [
      { content: '6', isCorrect: true },
      { content: '9', isCorrect: false },
      { content: '3', isCorrect: false },
      { content: '15', isCorrect: false },
    ],
  ),
];

const multiplicationDivisionSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A class has 20 markers shared equally among 5 tables. How many markers does each table get?',
    'Divide 20 by 5 to find how many markers are in each equal group.',
    [
      { content: '4', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '15', isCorrect: false },
      { content: '25', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which multiplication fact can help solve 7 x 3?',
    'Using known facts helps solve multiplication efficiently. 7 groups of 3 is 21.',
    [
      { content: '7 + 7 + 7 = 21', isCorrect: true },
      { content: '7 + 3 = 10', isCorrect: false },
      { content: '7 - 3 = 4', isCorrect: false },
      { content: '21 - 7 = 7', isCorrect: false },
    ],
  ),
];

const integersRationalVariants: CandidateQuestion[] = [
  toCandidate(
    'Which number is less than 0?',
    'Negative numbers are less than zero.',
    [
      { content: '-4', isCorrect: true },
      { content: '3', isCorrect: false },
      { content: '1/2', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which number is greater: -2 or -5?',
    'On a number line, numbers farther to the right are greater. -2 is to the right of -5.',
    [
      { content: '-2', isCorrect: true },
      { content: '-5', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'Neither number is greater', isCorrect: false },
    ],
  ),
];

const integersRationalSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the opposite of 7?',
    'Opposites are the same distance from 0 on the number line but on different sides.',
    [
      { content: '-7', isCorrect: true },
      { content: '7', isCorrect: false },
      { content: '0', isCorrect: false },
      { content: '1/7', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which rational number is closest to 0?',
    'Compare distance from 0 on the number line. The closest value has the smallest absolute value.',
    [
      { content: '1/4', isCorrect: true },
      { content: '3', isCorrect: false },
      { content: '-2', isCorrect: false },
      { content: '5/2', isCorrect: false },
    ],
  ),
];

const samplingInferenceSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A survey of 100 voters from across a city shows 62 prefer Candidate A. What is the best inference?',
    'An inference uses the sample result to make a cautious conclusion about the larger population.',
    [
      { content: 'Candidate A may be preferred by many voters in the city.', isCorrect: true },
      { content: 'Every voter in the city definitely prefers Candidate A.', isCorrect: false },
      { content: 'The sample proves no one prefers Candidate B.', isCorrect: false },
      { content: 'The survey result cannot suggest anything at all.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why should a sample be random when possible?',
    'Random sampling helps reduce bias so the sample better represents the larger population.',
    [
      { content: 'It helps reduce bias in the results.', isCorrect: true },
      { content: 'It guarantees every answer will be the same.', isCorrect: false },
      { content: 'It means no data needs to be collected.', isCorrect: false },
      { content: 'It only matters for sports scores.', isCorrect: false },
    ],
  ),
];

const expressionsEquationsVariants: CandidateQuestion[] = [
  toCandidate(
    'What is the value of 3x + 2 when x = 4?',
    'Substitute 4 for x, then compute 3(4) + 2 = 12 + 2 = 14.',
    [
      { content: '14', isCorrect: true },
      { content: '12', isCorrect: false },
      { content: '10', isCorrect: false },
      { content: '18', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which equation matches the sentence "a number increased by 7 is 15"?',
    'Translate the words into symbols: a number plus 7 equals 15.',
    [
      { content: 'x + 7 = 15', isCorrect: true },
      { content: 'x - 7 = 15', isCorrect: false },
      { content: '7x = 15', isCorrect: false },
      { content: '15 + 7 = x', isCorrect: false },
    ],
  ),
];

const expressionsEquationsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Solve x + 9 = 14.',
    'Undo the addition by subtracting 9 from both sides, so x = 5.',
    [
      { content: '5', isCorrect: true },
      { content: '23', isCorrect: false },
      { content: '9', isCorrect: false },
      { content: '14', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which expression shows "5 less than y"?',
    'The phrase "less than" reverses the order, so subtract 5 from y.',
    [
      { content: 'y - 5', isCorrect: true },
      { content: '5 - y', isCorrect: false },
      { content: '5y', isCorrect: false },
      { content: 'y + 5', isCorrect: false },
    ],
  ),
];

const coordinatePlaneQuadrantOneVariants: CandidateQuestion[] = [
  toCandidate(
    'Which point is located 3 units right and 2 units up from the origin?',
    'In Quadrant I, both coordinates are positive, so the point is (3, 2).',
    [
      { content: '(3, 2)', isCorrect: true },
      { content: '(2, 3)', isCorrect: false },
      { content: '(-3, 2)', isCorrect: false },
      { content: '(3, -2)', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which ordered pair names the point with x = 5 and y = 1?',
    'An ordered pair is written as (x, y), so use (5, 1).',
    [
      { content: '(5, 1)', isCorrect: true },
      { content: '(1, 5)', isCorrect: false },
      { content: '5, 1', isCorrect: false },
      { content: '(5, -1)', isCorrect: false },
    ],
  ),
];

const coordinatePlaneQuadrantOneSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A point is plotted at (4, 3). What does the 4 tell you?',
    'The first coordinate tells how far to move left or right on the x-axis.',
    [
      { content: 'Move 4 units to the right on the x-axis.', isCorrect: true },
      { content: 'Move 4 units up on the y-axis.', isCorrect: false },
      { content: 'Move 3 units to the right.', isCorrect: false },
      { content: 'Stay at the origin.', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which point is in Quadrant I?',
    'Quadrant I contains points with positive x- and y-coordinates.',
    [
      { content: '(2, 6)', isCorrect: true },
      { content: '(-2, 6)', isCorrect: false },
      { content: '(2, -6)', isCorrect: false },
      { content: '(-2, -6)', isCorrect: false },
    ],
  ),
];

const percentRatesVariants: CandidateQuestion[] = [
  toCandidate(
    'What is 25% of 40?',
    'Twenty-five percent means one fourth, and one fourth of 40 is 10.',
    [
      { content: '10', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '25', isCorrect: false },
      { content: '15', isCorrect: false },
    ],
  ),
  toCandidate(
    'A runner goes 18 miles in 3 hours. What is the unit rate?',
    'A unit rate compares to 1 unit. Divide 18 by 3 to get 6 miles per hour.',
    [
      { content: '6 miles per hour', isCorrect: true },
      { content: '9 miles per hour', isCorrect: false },
      { content: '15 miles per hour', isCorrect: false },
      { content: '54 miles per hour', isCorrect: false },
    ],
  ),
];

const percentRatesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A shirt costs $20 and is on sale for 10% off. How much is the discount?',
    'Ten percent of 20 is 2, so the discount is $2.',
    [
      { content: '$2', isCorrect: true },
      { content: '$10', isCorrect: false },
      { content: '$18', isCorrect: false },
      { content: '$1', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which rate is a unit rate?',
    'A unit rate compares an amount to 1 unit.',
    [
      { content: '5 dollars per 1 notebook', isCorrect: true },
      { content: '10 dollars per 2 notebooks', isCorrect: false },
      { content: '12 miles in 3 hours', isCorrect: false },
      { content: '8 apples in 4 bags', isCorrect: false },
    ],
  ),
];

const interpretingTablesChartsVariants: CandidateQuestion[] = [
  toCandidate(
    'A table shows Monday: 12 books, Tuesday: 15 books, Wednesday: 9 books. Which day had the most books read?',
    'To interpret a table, compare the values in each row or column and identify the greatest one.',
    [
      { content: 'Tuesday', isCorrect: true },
      { content: 'Monday', isCorrect: false },
      { content: 'Wednesday', isCorrect: false },
      { content: 'All three days', isCorrect: false },
    ],
  ),
  toCandidate(
    'A bar chart shows Class A raised $30 and Class B raised $45. How much more did Class B raise?',
    'Compare the chart values by subtracting 30 from 45.',
    [
      { content: '$15', isCorrect: true },
      { content: '$75', isCorrect: false },
      { content: '$10', isCorrect: false },
      { content: '$5', isCorrect: false },
    ],
  ),
];

const interpretingTablesChartsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A chart shows 8 students chose soccer, 5 chose basketball, and 3 chose tennis. Which sport was chosen least often?',
    'Look for the smallest value on the chart. The smallest count is 3.',
    [
      { content: 'tennis', isCorrect: true },
      { content: 'soccer', isCorrect: false },
      { content: 'basketball', isCorrect: false },
      { content: 'soccer and basketball', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do readers look at labels on a graph before answering questions?',
    'Labels tell what the numbers and categories represent, which helps you interpret the data correctly.',
    [
      { content: 'They show what the numbers and categories mean.', isCorrect: true },
      { content: 'They make the graph taller.', isCorrect: false },
      { content: 'They replace the data values.', isCorrect: false },
      { content: 'They are only decorative.', isCorrect: false },
    ],
  ),
];

const probabilityRulesVariants: CandidateQuestion[] = [
  toCandidate(
    'If the probability of an event is 0, what does that mean?',
    'A probability of 0 means the event is impossible.',
    [
      { content: 'The event is impossible.', isCorrect: true },
      { content: 'The event is certain.', isCorrect: false },
      { content: 'The event happens half the time.', isCorrect: false },
      { content: 'The event already happened.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the probability of rolling an even number on a fair six-sided number cube?',
    'The even numbers are 2, 4, and 6, so 3 of the 6 outcomes are even.',
    [
      { content: '3/6', isCorrect: true },
      { content: '1/6', isCorrect: false },
      { content: '2/6', isCorrect: false },
      { content: '6/3', isCorrect: false },
    ],
  ),
];

const probabilityRulesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A bag has 4 red marbles and 1 blue marble. What is the probability of picking blue?',
    'There is 1 blue marble out of 5 total marbles, so the probability is 1/5.',
    [
      { content: '1/5', isCorrect: true },
      { content: '4/5', isCorrect: false },
      { content: '1/4', isCorrect: false },
      { content: '5/1', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does a probability of 1 mean?',
    'A probability of 1 means the event is certain to happen.',
    [
      { content: 'The event is certain.', isCorrect: true },
      { content: 'The event is impossible.', isCorrect: false },
      { content: 'The event is unlikely.', isCorrect: false },
      { content: 'The event has not been defined.', isCorrect: false },
    ],
  ),
];

const functionsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which table shows a function?',
    'A relation is a function when each input has exactly one output.',
    [
      { content: 'x: 1, 2, 3 and y: 4, 5, 6', isCorrect: true },
      { content: 'x: 2, 2, 3 and y: 5, 7, 8', isCorrect: false },
      { content: 'x: 1, 1, 1 and y: 2, 3, 4', isCorrect: false },
      { content: 'An input matched to two different outputs', isCorrect: false },
    ],
  ),
  toCandidate(
    'In the function y = 2x + 1, what is y when x = 3?',
    'Substitute 3 for x: 2(3) + 1 = 7.',
    [
      { content: '7', isCorrect: true },
      { content: '6', isCorrect: false },
      { content: '5', isCorrect: false },
      { content: '8', isCorrect: false },
    ],
  ),
];

const functionsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If a rule sends x to x + 4, what is the output when x = 5?',
    'Apply the rule to the input: 5 + 4 = 9.',
    [
      { content: '9', isCorrect: true },
      { content: '1', isCorrect: false },
      { content: '20', isCorrect: false },
      { content: '54', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why is a relation not a function if one input has two outputs?',
    'A function must assign exactly one output to each input.',
    [
      { content: 'Because each input can have only one output in a function', isCorrect: true },
      { content: 'Because functions cannot use numbers', isCorrect: false },
      { content: 'Because outputs must always be larger than inputs', isCorrect: false },
      { content: 'Because relations never use tables', isCorrect: false },
    ],
  ),
];

const twoWayTablesVariants: CandidateQuestion[] = [
  toCandidate(
    'A two-way table shows favorite pets by grade level. What does a two-way table help you compare?',
    'A two-way table organizes data from two categories so you can compare groups.',
    [
      { content: 'how two different categories are related', isCorrect: true },
      { content: 'only one number with no categories', isCorrect: false },
      { content: 'the perimeter of a shape', isCorrect: false },
      { content: 'a sequence of story events', isCorrect: false },
    ],
  ),
  toCandidate(
    'In a two-way table, the row for Grade 6 and the column for soccer meet at 12. What does 12 mean?',
    'The value where a row and column meet shows how many items fit both categories.',
    [
      { content: '12 Grade 6 students chose soccer', isCorrect: true },
      { content: '12 students are in every grade', isCorrect: false },
      { content: 'Soccer is worth 12 points', isCorrect: false },
      { content: 'There are 12 rows in the table', isCorrect: false },
    ],
  ),
];

const twoWayTablesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Why should you read the row and column labels before answering a question about a two-way table?',
    'The labels tell what each category represents, which helps you read the correct value.',
    [
      { content: 'They tell what categories the numbers belong to.', isCorrect: true },
      { content: 'They are only decoration.', isCorrect: false },
      { content: 'They replace the need to read the table.', isCorrect: false },
      { content: 'They show the answer is always the largest number.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A two-way table shows 8 students in Grade 5 chose art and 6 chose music. How many Grade 5 students chose either art or music?',
    'Add the counts in the same row when the question asks for the total in both categories.',
    [
      { content: '14', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '48', isCorrect: false },
      { content: '56', isCorrect: false },
    ],
  ),
];

const volumeVariants: CandidateQuestion[] = [
  toCandidate(
    'A rectangular prism has length 4, width 3, and height 2. What is its volume?',
    'Volume of a rectangular prism is found by multiplying length, width, and height: 4 x 3 x 2 = 24.',
    [
      { content: '24 cubic units', isCorrect: true },
      { content: '9 square units', isCorrect: false },
      { content: '12 cubic units', isCorrect: false },
      { content: '18 cubic units', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does volume measure?',
    'Volume measures how much space a three-dimensional object takes up.',
    [
      { content: 'the amount of space inside a 3D object', isCorrect: true },
      { content: 'the distance around a shape', isCorrect: false },
      { content: 'the length of one side only', isCorrect: false },
      { content: 'the number of corners on a polygon', isCorrect: false },
    ],
  ),
];

const volumeSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A prism is built from 10 unit cubes. What is its volume?',
    'Each unit cube is 1 cubic unit, so 10 unit cubes make a volume of 10 cubic units.',
    [
      { content: '10 cubic units', isCorrect: true },
      { content: '10 square units', isCorrect: false },
      { content: '5 cubic units', isCorrect: false },
      { content: '20 cubic units', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why are volume answers written in cubic units?',
    'Volume counts space in three dimensions, so cubic units describe that measurement.',
    [
      { content: 'Because volume measures space in three dimensions', isCorrect: true },
      { content: 'Because volume is always a line segment', isCorrect: false },
      { content: 'Because all shapes are flat', isCorrect: false },
      { content: 'Because volume does not use numbers', isCorrect: false },
    ],
  ),
];

const placeValueLargeVariants: CandidateQuestion[] = [
  toCandidate(
    'In the number 405,672, what value does the 5 represent?',
    'The 5 is in the thousands place, so it represents 5,000.',
    [
      { content: '5,000', isCorrect: true },
      { content: '500', isCorrect: false },
      { content: '50,000', isCorrect: false },
      { content: '5', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which digit is in the millions place in 3,482,190?',
    'Read the place values from left to right. The leftmost digit here is the millions digit.',
    [
      { content: '3', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '8', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
];

const placeValueLargeSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'In 672,304, which digit is in the hundreds place?',
    'Count place values from right to left: ones, tens, hundreds. The hundreds digit is 3.',
    [
      { content: '3', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '0', isCorrect: false },
      { content: '7', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is the value of the 8 in 8,150,000?',
    'The 8 is in the millions place, so its value is 8,000,000.',
    [
      { content: '8,000,000', isCorrect: true },
      { content: '800,000', isCorrect: false },
      { content: '80,000', isCorrect: false },
      { content: '8,000', isCorrect: false },
    ],
  ),
];

const anglesLinesVariants: CandidateQuestion[] = [
  toCandidate(
    'Which pair of lines will never intersect because they stay the same distance apart?',
    'Parallel lines stay the same distance apart and never meet.',
    [
      { content: 'parallel lines', isCorrect: true },
      { content: 'intersecting lines', isCorrect: false },
      { content: 'perpendicular lines', isCorrect: false },
      { content: 'curved lines', isCorrect: false },
    ],
  ),
  toCandidate(
    'What kind of angle measures exactly 90 degrees?',
    'A right angle measures exactly 90 degrees.',
    [
      { content: 'right angle', isCorrect: true },
      { content: 'acute angle', isCorrect: false },
      { content: 'obtuse angle', isCorrect: false },
      { content: 'straight angle', isCorrect: false },
    ],
  ),
];

const anglesLinesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Two lines cross to make square corners. What kind of lines are they?',
    'Lines that form right angles where they meet are perpendicular.',
    [
      { content: 'perpendicular lines', isCorrect: true },
      { content: 'parallel lines', isCorrect: false },
      { content: 'curved lines', isCorrect: false },
      { content: 'broken lines', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which angle is smaller than a right angle?',
    'An acute angle measures less than 90 degrees.',
    [
      { content: 'acute angle', isCorrect: true },
      { content: 'straight angle', isCorrect: false },
      { content: 'right angle', isCorrect: false },
      { content: 'full turn', isCorrect: false },
    ],
  ),
];

const socialStudiesEvaluateInformationVariants: CandidateQuestion[] = [
  toCandidate(
    'A student is researching a historical event. Which source would be best to use first?',
    'A trustworthy source should be connected to the topic and provide reliable information or evidence.',
    [
      { content: 'a textbook chapter with dates, sources, and explanations', isCorrect: true },
      { content: 'an unsigned meme with no evidence', isCorrect: false },
      { content: 'a random ad for shoes', isCorrect: false },
      { content: 'a comic that does not mention the event', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which question best helps you evaluate whether a source is reliable?',
    'Evaluating a source means checking who made it and whether the information is supported by evidence.',
    [
      { content: 'Who created it, and what evidence does it use?', isCorrect: true },
      { content: 'Does it use the most colorful font?', isCorrect: false },
      { content: 'Is it the shortest source available?', isCorrect: false },
      { content: 'Does it avoid all dates and facts?', isCorrect: false },
    ],
  ),
];

const askImaginePlanCreateTestCandidates = (): CandidateQuestion =>
  toCandidate(
    'A class is building a paper bridge. Which step happens when students test the bridge?',
    'In the design cycle, testing means trying the solution and observing how well it works.',
    [
      { content: 'They try the bridge and see how much weight it can hold.', isCorrect: true },
      { content: 'They choose a random color for the bridge.', isCorrect: false },
      { content: 'They skip building and guess the answer.', isCorrect: false },
      { content: 'They erase the problem before starting.', isCorrect: false },
    ],
  );

const plantsAnimalsNeedsCandidates = (): CandidateQuestion =>
  toCandidate(
    'What do plants need to live and grow?',
    'Plants need basic resources such as water, light, air, and space.',
    [
      { content: 'water, sunlight, air, and space', isCorrect: true },
      { content: 'only rocks and shadows', isCorrect: false },
      { content: 'television and pencils', isCorrect: false },
      { content: 'nothing at all', isCorrect: false },
    ],
  );

const forcesMotionCandidates = (): CandidateQuestion =>
  toCandidate(
    'What can a push do to an object?',
    'A push can start motion, stop motion, or change how an object moves.',
    [
      { content: 'It can make the object move.', isCorrect: true },
      { content: 'It can only change the object\'s color.', isCorrect: false },
      { content: 'It can turn the object into water.', isCorrect: false },
      { content: 'It means the object disappears.', isCorrect: false },
    ],
  );

const sunMoonStarsCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which pattern happens in the sky every day?',
    'The Sun appears to move across the sky in a daily pattern.',
    [
      { content: 'The Sun appears in the sky during the day and changes position.', isCorrect: true },
      { content: 'The stars stay in exactly the same spot every minute.', isCorrect: false },
      { content: 'The Moon appears only once a year.', isCorrect: false },
      { content: 'Day and night happen at the same time everywhere.', isCorrect: false },
    ],
  );

const solarSystemRelativeScaleCandidates = (): CandidateQuestion =>
  toCandidate(
    'Why is Neptune much farther from the Sun than Earth on a scale model of the solar system?',
    'A scale model keeps relative distances in proportion, so planets that are farther in space are also farther apart on the model.',
    [
      { content: 'Because the model keeps the planets\' distances in proportion', isCorrect: true },
      { content: 'Because distant planets must always be larger in size', isCorrect: false },
      { content: 'Because all outer planets are placed randomly', isCorrect: false },
      { content: 'Because Earth and Neptune are actually the same distance away', isCorrect: false },
    ],
  );

const plateTectonicsCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which evidence best supports the idea that Earth\'s plates move?',
    'Evidence for plate tectonics includes matching fossils, rock patterns, and measured plate movement.',
    [
      { content: 'Matching fossils and rock layers found on continents far apart', isCorrect: true },
      { content: 'One cloudy day in a city', isCorrect: false },
      { content: 'A mountain\'s favorite color', isCorrect: false },
      { content: 'The fact that maps use symbols', isCorrect: false },
    ],
  );

const humanBodySystemsCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which body system moves oxygen from the lungs into the blood so the body can use it?',
    'The respiratory system brings oxygen into the lungs, where it enters the bloodstream.',
    [
      { content: 'the respiratory system', isCorrect: true },
      { content: 'the skeletal system', isCorrect: false },
      { content: 'the integumentary system', isCorrect: false },
      { content: 'the reproductive system', isCorrect: false },
    ],
  );

const habitatsScienceCandidates = (): CandidateQuestion =>
  toCandidate(
    'A rabbit lives in a grassland habitat. Which evidence would best help a student understand why the rabbit can live there?',
    'A good science answer uses observations about food, shelter, and the environment in the habitat.',
    [
      { content: 'Information about the rabbit\'s food, shelter, and space in the grassland', isCorrect: true },
      { content: 'A guess about the rabbit\'s favorite color', isCorrect: false },
      { content: 'Only the name of the student studying it', isCorrect: false },
      { content: 'A picture with no habitat details', isCorrect: false },
    ],
  );

const earthMaterialsCandidates = (): CandidateQuestion =>
  toCandidate(
    'A student compares sand, clay, and gravel. Which observation would best help identify each earth material?',
    'Earth materials can be compared using observable properties such as size, texture, and how they feel.',
    [
      { content: 'Their texture, particle size, and how they feel', isCorrect: true },
      { content: 'Which one has the funniest name', isCorrect: false },
      { content: 'The color of the student\'s notebook', isCorrect: false },
      { content: 'A random guess with no observation', isCorrect: false },
    ],
  );

const weatherSeasonsCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which evidence would best help a student explain why winter weather is different from summer weather?',
    'Weather and seasons are studied using observations collected over time, such as temperature and daylight.',
    [
      { content: 'Temperature and daylight observations collected in different seasons', isCorrect: true },
      { content: 'One person saying winter feels long', isCorrect: false },
      { content: 'Only the color of a winter coat', isCorrect: false },
      { content: 'A guess made before looking outside', isCorrect: false },
    ],
  );

const perimeterVariants: CandidateQuestion[] = [
  toCandidate(
    'What does perimeter measure?',
    'Perimeter is the total distance around the outside of a shape.',
    [
      { content: 'The distance around a shape', isCorrect: true },
      { content: 'The space inside a shape', isCorrect: false },
      { content: 'How tall a shape is', isCorrect: false },
      { content: 'The number of corners only', isCorrect: false },
    ],
  ),
  toCandidate(
    'A rectangle has side lengths 3 units and 5 units. What is its perimeter?',
    'Add all four side lengths: 3 + 5 + 3 + 5 = 16.',
    [
      { content: '16 units', isCorrect: true },
      { content: '15 units', isCorrect: false },
      { content: '8 units', isCorrect: false },
      { content: '30 units', isCorrect: false },
    ],
  ),
];

const perimeterSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A square has side length 4 units. What is its perimeter?',
    'A square has 4 equal sides, so the perimeter is 4 + 4 + 4 + 4 = 16.',
    [
      { content: '16 units', isCorrect: true },
      { content: '8 units', isCorrect: false },
      { content: '12 units', isCorrect: false },
      { content: '4 units', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which lengths would you add to find the perimeter of a triangle?',
    'To find perimeter, add all the side lengths of the shape.',
    [
      { content: 'All three side lengths', isCorrect: true },
      { content: 'Only the longest side', isCorrect: false },
      { content: 'Only two side lengths', isCorrect: false },
      { content: 'The area and one side length', isCorrect: false },
    ],
  ),
];

const pictureBarGraphsVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do students use a bar graph?',
    'A bar graph helps compare how many are in different categories.',
    [
      { content: 'To compare amounts in different groups', isCorrect: true },
      { content: 'To show how to spell every word', isCorrect: false },
      { content: 'To measure the perimeter of a shape', isCorrect: false },
      { content: 'To replace counting completely', isCorrect: false },
    ],
  ),
  toCandidate(
    'In a picture graph, what does the key tell the reader?',
    'The key tells how much each picture stands for.',
    [
      { content: 'How many each picture represents', isCorrect: true },
      { content: 'Which picture is the prettiest', isCorrect: false },
      { content: 'What the title should be changed to', isCorrect: false },
      { content: 'How long the graph took to draw', isCorrect: false },
    ],
  ),
];

const pictureBarGraphsSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A bar graph shows 6 apples and 4 bananas. Which fruit has more votes?',
    'Compare the bar heights: the taller bar represents the larger amount.',
    [
      { content: 'Apples', isCorrect: true },
      { content: 'Bananas', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'There is no way to tell', isCorrect: false },
    ],
  ),
  toCandidate(
    'If one picture in a graph stands for 2 pets, how many pets do 3 pictures show?',
    'Multiply the number of pictures by the value of each picture: 3 x 2 = 6.',
    [
      { content: '6 pets', isCorrect: true },
      { content: '5 pets', isCorrect: false },
      { content: '3 pets', isCorrect: false },
      { content: '2 pets', isCorrect: false },
    ],
  ),
];

const categorizeTallyVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do students use tally marks?',
    'Tally marks help count and organize data quickly into categories.',
    [
      { content: 'To count and organize how many are in each group', isCorrect: true },
      { content: 'To measure angles in a triangle', isCorrect: false },
      { content: 'To replace all words in a book', isCorrect: false },
      { content: 'To guess without counting', isCorrect: false },
    ],
  ),
  toCandidate(
    'A tally chart has |||| in the cat column and || in the dog column. Which category has more?',
    'The category with more tally marks has the greater count.',
    [
      { content: 'Cats', isCorrect: true },
      { content: 'Dogs', isCorrect: false },
      { content: 'They are equal', isCorrect: false },
      { content: 'There is no category with more', isCorrect: false },
    ],
  ),
];

const categorizeTallySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'How many tally marks are in one complete group with a slash across it?',
    'A complete tally group stands for 5.',
    [
      { content: '5', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '6', isCorrect: false },
      { content: '10', isCorrect: false },
    ],
  ),
  toCandidate(
    'If a tally chart shows 7 stickers in one category, what could the tally marks look like?',
    'Seven can be shown as one group of 5 and 2 more marks.',
    [
      { content: 'A group of 5 and 2 more tally marks', isCorrect: true },
      { content: 'Only 3 tally marks', isCorrect: false },
      { content: 'One group of 10', isCorrect: false },
      { content: 'A single line only', isCorrect: false },
    ],
  ),
];

const handwritingConventionsVariants: CandidateQuestion[] = [
  toCandidate(
    'Which sentence begins with a capital letter and ends with the correct punctuation?',
    'Sentences begin with a capital letter and end with punctuation such as a period, question mark, or exclamation point.',
    [
      { content: 'My dog runs fast.', isCorrect: true },
      { content: 'my dog runs fast', isCorrect: false },
      { content: 'my dog runs fast.', isCorrect: false },
      { content: 'My dog runs fast', isCorrect: false },
    ],
  ),
  toCandidate(
    'Why do writers leave spaces between words in a sentence?',
    'Spaces help readers tell where one word ends and the next word begins.',
    [
      { content: 'They help readers see each word clearly.', isCorrect: true },
      { content: 'They make every sentence a question.', isCorrect: false },
      { content: 'They turn letters into numbers.', isCorrect: false },
      { content: 'They are only used in titles.', isCorrect: false },
    ],
  ),
];

const pictureBooksVariants: CandidateQuestion[] = [
  toCandidate(
    'How do pictures help a reader understand a story?',
    'Pictures give clues about characters, setting, and what is happening.',
    [
      { content: 'They give clues about the story and what is happening.', isCorrect: true },
      { content: 'They replace every word in the book.', isCorrect: false },
      { content: 'They only matter on the last page.', isCorrect: false },
      { content: 'They make the story nonfiction automatically.', isCorrect: false },
    ],
  ),
  toCandidate(
    'What can a reader learn from looking closely at a picture in a book?',
    'Illustrations can help readers notice details the words are describing.',
    [
      { content: 'Important details about the characters or setting', isCorrect: true },
      { content: 'A random math answer not in the book', isCorrect: false },
      { content: 'Only the page number', isCorrect: false },
      { content: 'Nothing at all', isCorrect: false },
    ],
  ),
];

const sightWordsPhonicsVariants: CandidateQuestion[] = [
  toCandidate(
    'Why do readers practice sight words?',
    'Sight words are common words readers learn to recognize quickly.',
    [
      { content: 'So they can read common words quickly and smoothly', isCorrect: true },
      { content: 'So they never have to read any other words', isCorrect: false },
      { content: 'So every word sounds the same', isCorrect: false },
      { content: 'So punctuation disappears', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which word starts with the same sound as sun?',
    'The word sun begins with the /s/ sound.',
    [
      { content: 'sock', isCorrect: true },
      { content: 'map', isCorrect: false },
      { content: 'dog', isCorrect: false },
      { content: 'pig', isCorrect: false },
    ],
  ),
];

const skipCountingVariants: CandidateQuestion[] = [
  toCandidate(
    'What number comes next when you skip count by 5s: 5, 10, 15, ...?',
    'Skip counting by 5 means adding 5 each time.',
    [
      { content: '20', isCorrect: true },
      { content: '18', isCorrect: false },
      { content: '25', isCorrect: false },
      { content: '16', isCorrect: false },
    ],
  ),
  toCandidate(
    'What number comes next when you skip count by 2s: 2, 4, 6, ...?',
    'Skip counting by 2 means adding 2 each time.',
    [
      { content: '8', isCorrect: true },
      { content: '7', isCorrect: false },
      { content: '10', isCorrect: false },
      { content: '9', isCorrect: false },
    ],
  ),
];

const skipCountingSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which list shows skip counting by 10s?',
    'Skip counting by 10 means each number is 10 more than the one before.',
    [
      { content: '10, 20, 30, 40', isCorrect: true },
      { content: '10, 15, 20, 25', isCorrect: false },
      { content: '1, 2, 3, 4', isCorrect: false },
      { content: '5, 6, 7, 8', isCorrect: false },
    ],
  ),
  toCandidate(
    'If you skip count by 5 starting at 0, what is the third number you say?',
    'Starting at 0 and counting by 5 gives 0, 5, 10, 15, so the third number said after 0 is 10.',
    [
      { content: '10', isCorrect: true },
      { content: '5', isCorrect: false },
      { content: '15', isCorrect: false },
      { content: '20', isCorrect: false },
    ],
  ),
];

const describeDataVariants: CandidateQuestion[] = [
  toCandidate(
    'A graph shows 7 cats and 4 dogs. Which group has more?',
    'Compare the amounts: 7 is more than 4.',
    [
      { content: 'Cats', isCorrect: true },
      { content: 'Dogs', isCorrect: false },
      { content: 'They are the same', isCorrect: false },
      { content: 'There is no way to tell', isCorrect: false },
    ],
  ),
  toCandidate(
    'If one jar has 3 marbles and another has 6 marbles, which jar has fewer marbles?',
    'A smaller number means fewer objects.',
    [
      { content: 'The jar with 3 marbles', isCorrect: true },
      { content: 'The jar with 6 marbles', isCorrect: false },
      { content: 'Both jars have fewer', isCorrect: false },
      { content: 'They have the same amount', isCorrect: false },
    ],
  ),
];

const describeDataSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'A picture graph shows 5 apples and 2 oranges. How many more apples than oranges are there?',
    'Find how many more by subtracting: 5 - 2 = 3.',
    [
      { content: '3', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '5', isCorrect: false },
      { content: '7', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which word tells about a group with the bigger number?',
    'The word more describes the larger amount.',
    [
      { content: 'more', isCorrect: true },
      { content: 'less', isCorrect: false },
      { content: 'equal', isCorrect: false },
      { content: 'none', isCorrect: false },
    ],
  ),
];

const shapesAttributesVariants: CandidateQuestion[] = [
  toCandidate(
    'Which shape is a 3D shape?',
    'A cube is a solid shape with length, width, and height.',
    [
      { content: 'cube', isCorrect: true },
      { content: 'triangle', isCorrect: false },
      { content: 'square', isCorrect: false },
      { content: 'circle', isCorrect: false },
    ],
  ),
  toCandidate(
    'How many sides does a triangle have?',
    'A triangle is a 2D shape with 3 sides.',
    [
      { content: '3', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '2', isCorrect: false },
      { content: '5', isCorrect: false },
    ],
  ),
];

const shapesAttributesSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which shape has 4 equal sides?',
    'A square has 4 equal sides.',
    [
      { content: 'square', isCorrect: true },
      { content: 'triangle', isCorrect: false },
      { content: 'circle', isCorrect: false },
      { content: 'cone', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which shape can roll because it is round?',
    'A sphere is round all the way around and can roll.',
    [
      { content: 'sphere', isCorrect: true },
      { content: 'cube', isCorrect: false },
      { content: 'rectangle', isCorrect: false },
      { content: 'triangle', isCorrect: false },
    ],
  ),
];

const timeMoneyVariants: CandidateQuestion[] = [
  toCandidate(
    'How many quarters make one dollar?',
    'Four quarters equal 100 cents, which is one dollar.',
    [
      { content: '4', isCorrect: true },
      { content: '2', isCorrect: false },
      { content: '3', isCorrect: false },
      { content: '5', isCorrect: false },
    ],
  ),
  toCandidate(
    'If the clock shows the minute hand at 12 and the hour hand at 3, what time is it?',
    'When the minute hand is at 12, it is exactly on the hour.',
    [
      { content: '3:00', isCorrect: true },
      { content: '12:15', isCorrect: false },
      { content: '3:30', isCorrect: false },
      { content: '6:00', isCorrect: false },
    ],
  ),
];

const timeMoneySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which coin is worth 10 cents?',
    'A dime is worth 10 cents.',
    [
      { content: 'dime', isCorrect: true },
      { content: 'nickel', isCorrect: false },
      { content: 'penny', isCorrect: false },
      { content: 'quarter', isCorrect: false },
    ],
  ),
  toCandidate(
    'How many minutes are in one hour?',
    'One hour has 60 minutes.',
    [
      { content: '60', isCorrect: true },
      { content: '30', isCorrect: false },
      { content: '100', isCorrect: false },
      { content: '12', isCorrect: false },
    ],
  ),
];

const placeValueVariants: CandidateQuestion[] = [
  toCandidate(
    'In the number 34, what does the 3 mean?',
    'The 3 is in the tens place, so it means 3 tens.',
    [
      { content: '3 tens', isCorrect: true },
      { content: '3 ones', isCorrect: false },
      { content: '30 ones and 4 tens', isCorrect: false },
      { content: '4 tens', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which number has 5 tens and 2 ones?',
    '5 tens is 50 and 2 ones makes 52.',
    [
      { content: '52', isCorrect: true },
      { content: '25', isCorrect: false },
      { content: '502', isCorrect: false },
      { content: '57', isCorrect: false },
    ],
  ),
];

const placeValueSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which digit is in the ones place in the number 47?',
    'The ones place is the digit on the right.',
    [
      { content: '7', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '47', isCorrect: false },
      { content: '0', isCorrect: false },
    ],
  ),
  toCandidate(
    'What number is made from 6 tens and 1 one?',
    '6 tens is 60 and 1 one makes 61.',
    [
      { content: '61', isCorrect: true },
      { content: '16', isCorrect: false },
      { content: '6001', isCorrect: false },
      { content: '67', isCorrect: false },
    ],
  ),
];

const countingCardinalityVariants: CandidateQuestion[] = [
  toCandidate(
    'How many objects are there if you count 1, 2, 3, 4, 5?',
    'The last number you say when counting tells how many objects are in the group.',
    [
      { content: '5', isCorrect: true },
      { content: '4', isCorrect: false },
      { content: '6', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which group has more objects?',
    'Compare the number of objects in each group to decide which has more.',
    [
      { content: 'The group with 7 objects', isCorrect: true },
      { content: 'The group with 5 objects', isCorrect: false },
      { content: 'They must be the same', isCorrect: false },
      { content: 'There is no way to compare groups', isCorrect: false },
    ],
  ),
];

const countingCardinalitySupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If you count 8 blocks, what number tells how many blocks there are?',
    'The last counting number tells the total amount.',
    [
      { content: '8', isCorrect: true },
      { content: '7', isCorrect: false },
      { content: '9', isCorrect: false },
      { content: '1', isCorrect: false },
    ],
  ),
  toCandidate(
    'What does one-to-one counting mean?',
    'One-to-one counting means saying one number for each object you count.',
    [
      { content: 'You say one number for each object.', isCorrect: true },
      { content: 'You count two objects with one number every time.', isCorrect: false },
      { content: 'You only count the last object.', isCorrect: false },
      { content: 'You skip all the numbers in the middle.', isCorrect: false },
    ],
  ),
];

const additionSubtractionWithin20Variants: CandidateQuestion[] = [
  toCandidate(
    'What is 8 + 5?',
    'Add the two numbers: 8 + 5 = 13.',
    [
      { content: '13', isCorrect: true },
      { content: '12', isCorrect: false },
      { content: '14', isCorrect: false },
      { content: '15', isCorrect: false },
    ],
  ),
  toCandidate(
    'What is 14 - 6?',
    'Subtract 6 from 14 to get 8.',
    [
      { content: '8', isCorrect: true },
      { content: '7', isCorrect: false },
      { content: '9', isCorrect: false },
      { content: '10', isCorrect: false },
    ],
  ),
];

const additionSubtractionWithin20SupportVariants: CandidateQuestion[] = [
  toCandidate(
    'If you have 9 apples and get 3 more, how many apples do you have now?',
    'Adding 3 more to 9 gives 12.',
    [
      { content: '12', isCorrect: true },
      { content: '11', isCorrect: false },
      { content: '13', isCorrect: false },
      { content: '6', isCorrect: false },
    ],
  ),
  toCandidate(
    'If you have 15 stickers and give away 4, how many are left?',
    'Subtract 4 from 15 to find how many remain: 11.',
    [
      { content: '11', isCorrect: true },
      { content: '10', isCorrect: false },
      { content: '9', isCorrect: false },
      { content: '19', isCorrect: false },
    ],
  ),
];

const measurementVariants: CandidateQuestion[] = [
  toCandidate(
    'Which tool would you use to measure the length of a book?',
    'A ruler is used to measure how long an object is.',
    [
      { content: 'a ruler', isCorrect: true },
      { content: 'a clock', isCorrect: false },
      { content: 'a coin', isCorrect: false },
      { content: 'a crayon box', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which container would hold the most water?',
    'Capacity is about how much a container can hold.',
    [
      { content: 'a bucket', isCorrect: true },
      { content: 'a spoon', isCorrect: false },
      { content: 'a bottle cap', isCorrect: false },
      { content: 'a thimble', isCorrect: false },
    ],
  ),
];

const measurementSupportVariants: CandidateQuestion[] = [
  toCandidate(
    'Which object is likely heavier?',
    'Weight compares how heavy or light objects are.',
    [
      { content: 'a full backpack', isCorrect: true },
      { content: 'a feather', isCorrect: false },
      { content: 'a paper clip', isCorrect: false },
      { content: 'an empty leaf', isCorrect: false },
    ],
  ),
  toCandidate(
    'If one pencil is shorter than another, which pencil has less length?',
    'The shorter object has less length.',
    [
      { content: 'the shorter pencil', isCorrect: true },
      { content: 'the longer pencil', isCorrect: false },
      { content: 'both have less length', isCorrect: false },
      { content: 'there is no way to tell', isCorrect: false },
    ],
  ),
];

const energyHeatSunCandidates = (): CandidateQuestion =>
  toCandidate(
    'A student places one ice cube in sunlight and one in shade. Which observation would best help show how sunlight changes temperature?',
    'Comparing what happens in sunlight and shade helps show how heat from the Sun affects objects.',
    [
      { content: 'How fast each ice cube melts in sunlight and shade', isCorrect: true },
      { content: 'The name of the student holding the tray', isCorrect: false },
      { content: 'A guess made before watching the ice cubes', isCorrect: false },
      { content: 'Only the color of the tray', isCorrect: false },
    ],
  );

const lifeCyclesCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which observation would best help a student describe an animal\'s life cycle?',
    'A life cycle is described by the stages an organism goes through as it grows and changes.',
    [
      { content: 'Pictures or notes showing the organism at different growth stages', isCorrect: true },
      { content: 'Only the weather on one day', isCorrect: false },
      { content: 'A random guess about its favorite food', isCorrect: false },
      { content: 'The color of the classroom wall', isCorrect: false },
    ],
  );

const matterPropertiesCandidates = (): CandidateQuestion =>
  toCandidate(
    'Which observation would help a student tell whether something is a solid or a liquid?',
    'Students can compare whether the material keeps its own shape or takes the shape of a container.',
    [
      { content: 'Whether it keeps its own shape or takes the shape of a container', isCorrect: true },
      { content: 'Whether its name starts with a vowel', isCorrect: false },
      { content: 'Only whether it is colorful', isCorrect: false },
      { content: 'A guess with no observation', isCorrect: false },
    ],
  );

const lightSoundCandidates = (): CandidateQuestion =>
  toCandidate(
    'A student is testing how sound changes when a drum is hit harder or softer. Which evidence would be most useful?',
    'A good light or sound investigation compares observations when one part of the test changes.',
    [
      { content: 'Observations of how loud the sound is when the drum is hit in different ways', isCorrect: true },
      { content: 'Only the color of the drum', isCorrect: false },
      { content: 'A random guess before making any sound', isCorrect: false },
      { content: 'The student\'s favorite song title', isCorrect: false },
    ],
  );

const exactMatchCandidates = new Map<string, CandidateQuestion>([
  [
    'What is the main concept of Euclidean Proofs?',
    toCandidate(
      'Which reason correctly justifies the statement "∠1 ≅ ∠2" when the two angles are vertical angles?',
      'Vertical angles are always congruent, so that reason directly supports the statement.',
      [
        { content: 'Vertical angles are congruent.', isCorrect: true },
        { content: 'All acute angles are congruent.', isCorrect: false },
        { content: 'Adjacent angles are always equal.', isCorrect: false },
        { content: 'Parallel lines make all angles congruent.', isCorrect: false },
      ],
    ),
  ],
  [
    'When working with euclidean proofs, which strategy is most helpful?',
    toCandidate(
      'You know AB ≅ DE, BC ≅ EF, and ∠B ≅ ∠E. Which theorem can prove ΔABC ≅ ΔDEF?',
      'Two sides and the included angle match, so the triangles are congruent by SAS.',
      [
        { content: 'SAS', isCorrect: true },
        { content: 'AAA', isCorrect: false },
        { content: 'SSA', isCorrect: false },
        { content: 'Only perimeter', isCorrect: false },
      ],
    ),
  ],
  [
    'Which real-life situation might involve euclidean proofs?',
    toCandidate(
      'A builder draws two right triangles for roof supports. Which extra fact would allow the builder to use HL to prove the triangles congruent?',
      'HL works for right triangles when the hypotenuse and one corresponding leg are congruent.',
      [
        { content: 'The hypotenuse and one leg are congruent.', isCorrect: true },
        { content: 'Only one acute angle looks the same.', isCorrect: false },
        { content: 'The triangles have the same area estimate.', isCorrect: false },
        { content: 'The bases are parallel.', isCorrect: false },
      ],
    ),
  ],
  [
    'What should you do if you get stuck on a euclidean proofs problem?',
    toCandidate(
      'Lines l and m are parallel and cut by a transversal. Which reason justifies saying two alternate interior angles are congruent?',
      'When parallel lines are cut by a transversal, alternate interior angles are congruent.',
      [
        { content: 'Alternate interior angles formed by parallel lines are congruent.', isCorrect: true },
        { content: 'All interior angles are equal.', isCorrect: false },
        { content: 'Vertical angles only exist on triangles.', isCorrect: false },
        { content: 'A transversal makes every angle supplementary.', isCorrect: false },
      ],
    ),
  ],
  [
    'What can you learn from studying algorithms (unplugged)?',
    toCandidate(
      'Which set of directions is the clearest algorithm for a robot to move one square forward and then turn left?',
      'An algorithm should list exact steps in the correct order so the robot can follow them without guessing.',
      [
        { content: 'Move forward 1 square, then turn left 90 degrees.', isCorrect: true },
        { content: 'Do the next thing to get to the goal.', isCorrect: false },
        { content: 'Go somewhere useful and maybe turn.', isCorrect: false },
        { content: 'Keep moving until it feels correct.', isCorrect: false },
      ],
    ),
  ],
  [
    'How might algorithms (unplugged) apply to future careers?',
    toCandidate(
      'A delivery robot must move: forward, forward, right, forward. Which answer shows the correct ordered algorithm?',
      'An algorithm is an ordered list of steps. The robot has to follow the instructions in the exact sequence.',
      [
        { content: 'Forward, forward, right, forward', isCorrect: true },
        { content: 'Right, forward, forward, forward', isCorrect: false },
        { content: 'Forward, right, forward, right', isCorrect: false },
        { content: 'Turn around, forward, stop', isCorrect: false },
      ],
    ),
  ],
  [
    'What makes learning algorithms (unplugged) engaging?',
    toCandidate(
      'A student wrote an algorithm to clap three times, but the steps only say "clap twice." What is the bug?',
      'Debugging means finding the step that does not match the intended outcome.',
      [
        { content: 'The algorithm is missing one clap.', isCorrect: true },
        { content: 'The algorithm has too many turns.', isCorrect: false },
        { content: 'The algorithm should start with a jump.', isCorrect: false },
        { content: 'There is no bug because two and three are the same.', isCorrect: false },
      ],
    ),
  ],
  [
    'Why is algorithms (unplugged) valuable for personal growth?',
    toCandidate(
      'Which instruction is precise enough for a classmate to draw a square path on the floor?',
      'Precise algorithms use exact amounts and directions so another person can follow them successfully.',
      [
        { content: 'Take 2 steps forward, turn right, and repeat 4 times.', isCorrect: true },
        { content: 'Walk around until it looks square-ish.', isCorrect: false },
        { content: 'Move however you want to make a shape.', isCorrect: false },
        { content: 'Take one step and hope it works out.', isCorrect: false },
      ],
    ),
  ],
  [
    'Why is studying exploration to civil war important?',
    toCandidate(
      'Which event from U.S. history increased tension because people argued whether new territories would allow slavery?',
      'As the United States added territory, debates over slavery in those areas increased tension before the Civil War.',
      [
        { content: 'The expansion into new western territories', isCorrect: true },
        { content: 'A debate about recess length at school', isCorrect: false },
        { content: 'The invention of the telephone', isCorrect: false },
        { content: 'A local weather report', isCorrect: false },
      ],
    ),
  ],
  [
    'How does exploration to civil war connect to current events?',
    toCandidate(
      'Which source would best help a student study westward expansion before the Civil War?',
      'A map showing changing territories helps students trace how expansion created new political questions.',
      [
        { content: 'A map showing U.S. territory changes over time', isCorrect: true },
        { content: 'A recipe card with no dates or locations', isCorrect: false },
        { content: 'A sports poster from today', isCorrect: false },
        { content: 'A random list of first names', isCorrect: false },
      ],
    ),
  ],
  [
    'What skills do you develop when learning about exploration to civil war?',
    toCandidate(
      'Which statement best shows cause and effect in the period from exploration to the Civil War?',
      'A strong history answer explains how one event led to another instead of listing facts with no connection.',
      [
        { content: 'New territories led to arguments about whether slavery would expand.', isCorrect: true },
        { content: 'Territories appeared with no effect on anything else.', isCorrect: false },
        { content: 'Every region agreed on the same policies immediately.', isCorrect: false },
        { content: 'Historical events never affect later choices.', isCorrect: false },
      ],
    ),
  ],
  [
    'How can understanding exploration to civil war help you be a better citizen?',
    toCandidate(
      'Which question best helps a historian understand the path from exploration to the Civil War?',
      'A good historical question focuses on how events changed the country over time.',
      [
        { content: 'How did expansion create new conflicts between regions?', isCorrect: true },
        { content: 'Which snack was most popular on one random day?', isCorrect: false },
        { content: 'Why do maps have paper?', isCorrect: false },
        { content: 'Which answer sounds the funniest?', isCorrect: false },
      ],
    ),
  ],
  [
    'Why is studying supply/demand important?',
    toCandidate(
      'A concert has only 100 tickets, but many more people want to buy them. What is the most likely result?',
      'When demand is high and supply is limited, prices tend to rise.',
      [
        { content: 'The ticket price is likely to rise.', isCorrect: true },
        { content: 'The price must drop to zero.', isCorrect: false },
        { content: 'The number of tickets automatically doubles.', isCorrect: false },
        { content: 'Demand disappears because supply is low.', isCorrect: false },
      ],
    ),
  ],
  [
    'How does supply/demand connect to current events?',
    toCandidate(
      'A farm harvests many more apples than usual. If demand stays the same, what is most likely to happen?',
      'When supply increases and demand stays the same, prices often fall.',
      [
        { content: 'Apple prices are likely to fall.', isCorrect: true },
        { content: 'Apple prices are likely to rise sharply.', isCorrect: false },
        { content: 'Stores will stop selling apples.', isCorrect: false },
        { content: 'Demand becomes impossible to measure.', isCorrect: false },
      ],
    ),
  ],
  [
    'What skills do you develop when learning about supply/demand?',
    toCandidate(
      'Which situation is the best example of demand increasing?',
      'Demand increases when more people want to buy the same product at the same time.',
      [
        { content: 'A new video game becomes popular and more students want to buy it.', isCorrect: true },
        { content: 'A store gets a bigger shipment of notebooks.', isCorrect: false },
        { content: 'A factory closes for repairs.', isCorrect: false },
        { content: 'A seller lowers quality and fewer buyers are interested.', isCorrect: false },
      ],
    ),
  ],
  [
    'How can understanding supply/demand help you be a better citizen?',
    toCandidate(
      'Which example best shows supply decreasing?',
      'Supply decreases when fewer units of a good are available for buyers.',
      [
        { content: 'A storm damages crops and fewer oranges reach stores.', isCorrect: true },
        { content: 'A sale makes more people want sneakers.', isCorrect: false },
        { content: 'A class votes on a field trip.', isCorrect: false },
        { content: 'A library opens later on Fridays.', isCorrect: false },
      ],
    ),
  ],
  [
    'Why is studying world regions (physical/human): important?',
    toCandidate(
      'Which feature is a physical characteristic of a world region?',
      'Physical features are natural parts of Earth such as mountains, deserts, and rivers.',
      [
        { content: 'A mountain range', isCorrect: true },
        { content: 'A city subway map', isCorrect: false },
        { content: 'A school building', isCorrect: false },
        { content: 'A language spoken by a community', isCorrect: false },
      ],
    ),
  ],
  [
    'How does world regions (physical/human): connect to current events?',
    toCandidate(
      'Which example describes a human characteristic of a region?',
      'Human characteristics are created by people, such as cities, languages, and transportation systems.',
      [
        { content: 'A busy port city', isCorrect: true },
        { content: 'A chain of volcanoes', isCorrect: false },
        { content: 'A desert climate', isCorrect: false },
        { content: 'A river valley', isCorrect: false },
      ],
    ),
  ],
  [
    'What skills do you develop when learning about world regions (physical/human):?',
    toCandidate(
      'Why do many large cities develop near rivers or coasts?',
      'Rivers and coasts often support trade, transportation, and access to resources for people.',
      [
        { content: 'They offer transportation routes and access to resources.', isCorrect: true },
        { content: 'Cities can only exist where there are no landforms.', isCorrect: false },
        { content: 'People are required to live only next to oceans.', isCorrect: false },
        { content: 'Rivers prevent all farming and trade.', isCorrect: false },
      ],
    ),
  ],
  [
    'How can understanding world regions (physical/human): help you be a better citizen?',
    toCandidate(
      'A region has steep mountains and narrow valleys. Which human activity is most likely shaped by that physical geography?',
      'Physical geography affects where people build roads, towns, and farms.',
      [
        { content: 'Where roads and towns can be built', isCorrect: true },
        { content: 'Whether gravity exists there', isCorrect: false },
        { content: 'Whether people need food', isCorrect: false },
        { content: 'Whether the Sun rises in the east', isCorrect: false },
      ],
    ),
  ],
  [
    'What is the purpose of ledger lines in sheet music?',
    toCandidate(
      'Why do musicians use ledger lines in sheet music?',
      'Ledger lines extend the staff so notes above or below the five main lines can still be read accurately.',
      [
        { content: 'To show notes that are above or below the staff', isCorrect: true },
        { content: 'To mark where a song should end forever', isCorrect: false },
        { content: 'To replace the clef symbol', isCorrect: false },
        { content: 'To show that every note is played loudly', isCorrect: false },
      ],
    ),
  ],
]);

const literaryNonfictionVariants: CandidateQuestion[] = [
  toCandidate(
    'A literary nonfiction passage describes a climber reaching the summit. Which detail most clearly shows it is literary nonfiction?',
    'Literary nonfiction tells a true story or real event while using vivid description and narrative techniques.',
    [
      { content: 'It tells a true event using descriptive scenes and real details.', isCorrect: true },
      { content: 'It makes up a dragon to create fantasy suspense.', isCorrect: false },
      { content: 'It uses no facts, people, or real setting.', isCorrect: false },
      { content: 'It avoids any sequence of real events.', isCorrect: false },
    ],
  ),
  toCandidate(
    'When reading literary nonfiction, which question best helps a reader analyze the author\'s message?',
    'Readers should connect factual details and narrative choices to the main idea the author wants to communicate.',
    [
      { content: 'How do the real details and scenes support the author\'s main idea?', isCorrect: true },
      { content: 'Which made-up character uses magic first?', isCorrect: false },
      { content: 'Why are facts unimportant in this kind of text?', isCorrect: false },
      { content: 'How can the title replace reading the passage?', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which piece of evidence would best support a response about a literary nonfiction text?',
    'Strong reading responses use a specific detail from the real event or experience described in the passage.',
    [
      { content: 'A quoted line that describes a real event from the text', isCorrect: true },
      { content: 'A random opinion with no text detail', isCorrect: false },
      { content: 'A fact from an unrelated book', isCorrect: false },
      { content: 'A guess based only on the cover art', isCorrect: false },
    ],
  ),
];

const worldLitVariants: CandidateQuestion[] = [
  toCandidate(
    'Why might two world literature texts from different countries still share a similar theme?',
    'Writers from different cultures often explore universal ideas such as courage, belonging, or justice.',
    [
      { content: 'Different cultures can still write about universal human experiences.', isCorrect: true },
      { content: 'All authors are required to use the same exact plot.', isCorrect: false },
      { content: 'Themes only exist in one country at a time.', isCorrect: false },
      { content: 'Readers are not supposed to compare texts from different places.', isCorrect: false },
    ],
  ),
  toCandidate(
    'A reader compares a folktale from West Africa and a myth from Greece. What should the reader look for first?',
    'Comparing central ideas, characters, and lessons helps reveal meaningful similarities and differences.',
    [
      { content: 'Important themes or lessons in both texts', isCorrect: true },
      { content: 'Only the number of paragraphs', isCorrect: false },
      { content: 'Whether the titles start with the same letter', isCorrect: false },
      { content: 'Only which text is longer', isCorrect: false },
    ],
  ),
  toCandidate(
    'Which response best explains why reading world literature matters?',
    'World literature helps readers understand multiple cultures while also noticing shared human concerns.',
    [
      { content: 'It helps readers understand different cultures and perspectives.', isCorrect: true },
      { content: 'It proves all stories are exactly the same.', isCorrect: false },
      { content: 'It removes the need to look at evidence from texts.', isCorrect: false },
      { content: 'It only matters if every story happens in the present day.', isCorrect: false },
    ],
  ),
];

const scientificTopicCandidates = (topic: string): CandidateQuestion | null => {
  const normalized = topic.toLowerCase();

  if (normalized.includes('thermodynamics')) {
    return toCandidate(
      'A class heats two metal rods for the same amount of time and records the temperature every minute. Which change would make the investigation more reliable?',
      'Reliable thermodynamics investigations keep conditions controlled and record repeated measurements consistently.',
      [
        { content: 'Use the same heater setting and measure both rods at the same time intervals.', isCorrect: true },
        { content: 'Change the heater setting whenever the data looks unexpected.', isCorrect: false },
        { content: 'Measure one rod in Celsius and the other in inches.', isCorrect: false },
        { content: 'Record only the hottest temperature and ignore the rest.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('geology') || normalized.includes('minerals/rocks')) {
    return toCandidate(
      'A geologist is identifying an unknown mineral sample. Which observation would be most useful evidence?',
      'Minerals are identified by measurable properties such as hardness, streak, luster, and cleavage.',
      [
        { content: 'Its hardness, streak, and luster', isCorrect: true },
        { content: 'Which color the student likes best', isCorrect: false },
        { content: 'How heavy the textbook feels nearby', isCorrect: false },
        { content: 'Whether the sample was found on a Tuesday', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('astronomy') || normalized.includes('astrophysics')) {
    return toCandidate(
      'An astronomer tracks the brightness of a star over many nights. Which evidence would best support the claim that the star is variable?',
      'Repeated measurements that show a pattern of changing brightness provide evidence for a variable star.',
      [
        { content: 'A data table showing the star\'s brightness changes over time', isCorrect: true },
        { content: 'One person saying the star looks interesting', isCorrect: false },
        { content: 'A drawing with no measurements', isCorrect: false },
        { content: 'The color of a telescope case', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('experiment design') || normalized.includes('statistics in labs')) {
    return toCandidate(
      'A lab group is testing which paper towel absorbs the most water. Which change would make the experiment more reliable?',
      'Reliable lab design keeps conditions the same except for the factor being tested and repeats measurements carefully.',
      [
        { content: 'Use the same amount of water for each towel and repeat the trial several times.', isCorrect: true },
        { content: 'Change the amount of water whenever one towel seems better.', isCorrect: false },
        { content: 'Choose the winner after only one quick guess.', isCorrect: false },
        { content: 'Test different towels in different-sized cups and compare anyway.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('climate science')) {
    return toCandidate(
      'Which data would best help scientists study long-term climate change?',
      'Climate science relies on measurements collected over many years, not just one day of weather.',
      [
        { content: 'Average temperature records collected over many decades', isCorrect: true },
        { content: 'A single afternoon weather report', isCorrect: false },
        { content: 'One student saying it felt cold today', isCorrect: false },
        { content: 'The color of a weather app icon', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('weather and climate') || normalized.includes('weather climate systems')) {
    return toCandidate(
      'Which evidence would best help a student explain why winter weather is different from summer weather?',
      'Weather and climate explanations rely on observations of temperature, precipitation, and seasonal patterns over time.',
      [
        { content: 'temperature and precipitation patterns recorded across seasons', isCorrect: true },
        { content: 'one student\'s favorite season', isCorrect: false },
        { content: 'the color of a jacket', isCorrect: false },
        { content: 'a guess with no observations', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('natural resources')) {
    return toCandidate(
      'Which example is a natural resource people use from Earth?',
      'Natural resources are materials from nature that people use, such as water, soil, minerals, and trees.',
      [
        { content: 'fresh water from a river', isCorrect: true },
        { content: 'a plastic toy made in a factory', isCorrect: false },
        { content: 'a worksheet printed at school', isCorrect: false },
        { content: 'a video on a tablet', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('earth history')) {
    return toCandidate(
      'Which kind of evidence helps scientists learn about Earth\'s past life and environments?',
      'Fossils and rock layers provide evidence about organisms and environments from long ago.',
      [
        { content: 'fossils and rock layers', isCorrect: true },
        { content: 'today\'s lunch menu', isCorrect: false },
        { content: 'a guess with no observations', isCorrect: false },
        { content: 'the color of a backpack', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('earth systems geosphere hydrosphere')) {
    return toCandidate(
      'How can water affect rocks in the geosphere over time?',
      'Water in the hydrosphere can weather and erode rocks in the geosphere over long periods.',
      [
        { content: 'It can weather and erode rocks.', isCorrect: true },
        { content: 'It turns all rocks into metal instantly.', isCorrect: false },
        { content: 'It removes gravity from Earth.', isCorrect: false },
        { content: 'It stops the water cycle forever.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('computational modeling')) {
    return toCandidate(
      'Why do scientists use computational models?',
      'Computational models help test ideas and predict how a system might behave under different conditions.',
      [
        { content: 'To simulate systems and compare possible outcomes', isCorrect: true },
        { content: 'To replace all observations with guesses', isCorrect: false },
        { content: 'To avoid using any data at all', isCorrect: false },
        { content: 'To guarantee every prediction is perfect', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('modeling and optimization')) {
    return toCandidate(
      'An engineer tests three bridge designs to see which uses the least material while holding the most weight. What is the engineer doing?',
      'Optimization means comparing designs to find the best solution while meeting the goal.',
      [
        { content: 'optimizing a design by comparing how well each option works', isCorrect: true },
        { content: 'guessing without testing any design', isCorrect: false },
        { content: 'changing the problem into a history question', isCorrect: false },
        { content: 'proving that every design is equally effective', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('tradeoffs and constraints')) {
    return toCandidate(
      'A team designing a playground wants it to be safe, low-cost, and large, but the budget is limited. What is the budget in this situation?',
      'A constraint is a limit the design must work within, such as cost, time, or materials.',
      [
        { content: 'a constraint', isCorrect: true },
        { content: 'a variable that can be ignored', isCorrect: false },
        { content: 'proof that the design is complete', isCorrect: false },
        { content: 'the final answer key', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('criteria and constraints')) {
    return toCandidate(
      'A team is designing a water bottle holder. Which statement describes a criterion?',
      'A criterion is a goal the design should achieve, such as holding the bottle securely.',
      [
        { content: 'It should hold the bottle without tipping over.', isCorrect: true },
        { content: 'The budget is only $10.', isCorrect: false },
        { content: 'Only two materials may be used.', isCorrect: false },
        { content: 'The design must be finished by Friday.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('prototypes and iteration')) {
    return toCandidate(
      'Why do engineers test a prototype more than once?',
      'Iteration means testing, improving, and trying again to make a design work better.',
      [
        { content: 'to improve the design after learning from each test', isCorrect: true },
        { content: 'because the first test must be ignored', isCorrect: false },
        { content: 'to avoid making any changes', isCorrect: false },
        { content: 'because prototypes are final products', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('data driven design')) {
    return toCandidate(
      'Why do engineers collect data when testing a design?',
      'Data helps engineers decide what to improve instead of relying only on guesses.',
      [
        { content: 'to make design decisions based on evidence', isCorrect: true },
        { content: 'to avoid comparing results', isCorrect: false },
        { content: 'to make sure no changes are ever needed', isCorrect: false },
        { content: 'to replace all testing with opinions', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('ecology') || normalized.includes('population/community')) {
    return toCandidate(
      'An ecologist is studying why a rabbit population drops after a drought. Which evidence would be most useful?',
      'Ecology relies on data about populations, resources, and environmental changes to explain what affects a community.',
      [
        { content: 'Population counts and rainfall data collected over time', isCorrect: true },
        { content: 'A random guess about what rabbits prefer', isCorrect: false },
        { content: 'Only the color of the rabbits', isCorrect: false },
        { content: 'One photo with no dates or measurements', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('ecosystems and food webs') || normalized.includes('biodiversity')) {
    return toCandidate(
      'If the number of hawks in a food web drops sharply, which population might increase first?',
      'When a predator decreases, one of its prey populations may increase because fewer are being eaten.',
      [
        { content: 'a prey population such as mice', isCorrect: true },
        { content: 'the Sun', isCorrect: false },
        { content: 'all plants instantly disappear', isCorrect: false },
        { content: 'every species stays exactly the same', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('evolution')) {
    return toCandidate(
      'Which observation would best support the idea of natural selection in a population?',
      'Natural selection is supported when inherited traits that improve survival become more common over generations.',
      [
        { content: 'A trait that helps survival becomes more common over several generations.', isCorrect: true },
        { content: 'All organisms stay exactly the same forever.', isCorrect: false },
        { content: 'One organism decides to change its traits overnight.', isCorrect: false },
        { content: 'A species never shows variation.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('heredity')) {
    return toCandidate(
      'Which trait can be passed from parents to offspring?',
      'Inherited traits are passed from parents to offspring through genetic information.',
      [
        { content: 'eye color', isCorrect: true },
        { content: 'a broken arm', isCorrect: false },
        { content: 'the shirt someone wears', isCorrect: false },
        { content: 'the homework finished last night', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('biochemistry')) {
    return toCandidate(
      'A scientist is testing how temperature affects enzyme activity. Which setup best isolates the variable?',
      'A good biochemistry experiment changes one factor, like temperature, while keeping the others the same.',
      [
        { content: 'Use the same enzyme and substrate amounts while changing only the temperature.', isCorrect: true },
        { content: 'Change the temperature, enzyme, and substrate all at once.', isCorrect: false },
        { content: 'Measure only one trial and ignore the rest.', isCorrect: false },
        { content: 'Choose the result you expected before collecting data.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('stoichiometry') || normalized.includes('equilibrium') || normalized.includes('acids-bases')) {
    return toCandidate(
      'A chemistry student tests how concentration affects reaction rate. Which evidence would best support the conclusion?',
      'Chemistry conclusions should be based on measured reaction data collected while other conditions stay controlled.',
      [
        { content: 'Timed reaction data from several trials at different concentrations', isCorrect: true },
        { content: 'A single guess about which beaker looked fastest', isCorrect: false },
        { content: 'Only the color of the lab table', isCorrect: false },
        { content: 'A conclusion written before the test begins', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('atoms bonding reactions')) {
    return toCandidate(
      'What happens to atoms in a chemical reaction?',
      'Atoms are rearranged to form new substances, but they are not created or destroyed.',
      [
        { content: 'They rearrange to make new substances.', isCorrect: true },
        { content: 'They disappear completely.', isCorrect: false },
        { content: 'They turn into energy only.', isCorrect: false },
        { content: 'They stop existing when bonds break.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('molecular genetics')) {
    return toCandidate(
      'A scientist compares DNA sequences from two organisms. What kind of evidence would best support the claim that they share a close relationship?',
      'Molecular genetics uses sequence similarities as evidence when comparing organisms.',
      [
        { content: 'Many matching DNA sequence segments', isCorrect: true },
        { content: 'The organisms have the same favorite habitat color', isCorrect: false },
        { content: 'They were found on the same day', isCorrect: false },
        { content: 'One organism is larger than the other', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('matter particles')) {
    return toCandidate(
      'Which statement best describes particles in matter?',
      'Matter is made of tiny particles that are always moving, even when we cannot see them.',
      [
        { content: 'All matter is made of tiny particles that are always moving.', isCorrect: true },
        { content: 'Particles only exist in liquids.', isCorrect: false },
        { content: 'Solid matter has no particles at all.', isCorrect: false },
        { content: 'Particles stop existing when matter changes shape.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('cells and organelles')) {
    return toCandidate(
      'Which organelle is known as the control center because it contains the cell\'s genetic material?',
      'The nucleus contains DNA and helps direct the cell\'s activities.',
      [
        { content: 'the nucleus', isCorrect: true },
        { content: 'the cell membrane', isCorrect: false },
        { content: 'the ribosome', isCorrect: false },
        { content: 'the vacuole', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('oceanography') || normalized.includes('atmospheric science')) {
    return toCandidate(
      'An oceanographer tracks ocean temperature and air pressure before a storm. Why are repeated measurements important?',
      'Earth science depends on repeated measurements to identify patterns and changes in large systems.',
      [
        { content: 'They reveal patterns and changes over time in the system.', isCorrect: true },
        { content: 'They guarantee storms can be controlled by scientists.', isCorrect: false },
        { content: 'They make graphs unnecessary.', isCorrect: false },
        { content: 'They replace all other weather observations forever.', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('waves') || normalized.includes('optics')) {
    return toCandidate(
      'A student tests how changing frequency affects wavelength in the same medium. Which evidence would best support the results?',
      'A waves and optics investigation should compare measured frequencies and wavelengths while keeping the medium the same.',
      [
        { content: 'A data table of measured frequencies and wavelengths in the same medium', isCorrect: true },
        { content: 'A single drawing with no measurements', isCorrect: false },
        { content: 'Only the student\'s guess before the test', isCorrect: false },
        { content: 'The color of the lab notebook cover', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('mechanics')) {
    return toCandidate(
      'A physics student rolls carts down ramps of different heights. Which evidence would best support a claim about acceleration?',
      'Mechanics claims should be based on repeated measurements of motion, such as time, distance, or velocity.',
      [
        { content: 'Timed motion data collected for each ramp height across several trials', isCorrect: true },
        { content: 'A guess about which cart looked fastest', isCorrect: false },
        { content: 'Only the color of the carts', isCorrect: false },
        { content: 'A conclusion written before testing begins', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('electricity') || normalized.includes('magnetism')) {
    return toCandidate(
      'A student changes the number of batteries in a circuit and measures bulb brightness. Which evidence is most useful?',
      'Electricity and magnetism investigations should compare measured circuit outcomes while changing one variable at a time.',
      [
        { content: 'Brightness measurements from circuits tested with different battery counts', isCorrect: true },
        { content: 'One opinion about which bulb looked nicest', isCorrect: false },
        { content: 'Only the wire color', isCorrect: false },
        { content: 'A random diagram with no data', isCorrect: false },
      ],
    );
  }

  if (normalized.includes('physiology')) {
    return toCandidate(
      'A student measures heart rate before and after exercise for several classmates. Which evidence would best support a claim about how exercise affects heart rate?',
      'A physiology claim should be based on repeated body-system measurements collected before and after the change being studied.',
      [
        { content: 'Heart-rate data collected before and after exercise across several trials', isCorrect: true },
        { content: 'One student saying exercise feels hard', isCorrect: false },
        { content: 'Only the color of the stopwatch', isCorrect: false },
        { content: 'A conclusion written before measuring anything', isCorrect: false },
      ],
    );
  }

  return null;
};

const nextVariant = <T>(variants: T[], key: string, counters: Map<string, number>): T => {
  const nextIndex = counters.get(key) ?? 0;
  counters.set(key, nextIndex + 1);
  return variants[nextIndex % variants.length];
};

const canonicalizePrompt = (prompt: string): string =>
  prompt
    .replace(/\s+\(grade k\)(?= in reading and writing\?)/i, '')
    .replace(/\s+\(grade k\)(?= problem\?$)/i, '')
    .replace(/\s+\(grade k\)(?=\?$)/i, '')
    .replace(/\s+\(Grade K\)(?=\?$)/, '')
    .replace(/\s+\(Grade 6\): Grade 6(?=\?$)/i, '')
    .replace(/\s+\(grade 6\): grade 6(?= problem\?$)/i, '')
    .replace(/Picture\/Bar Graphs \(intro\)/gi, 'Picture/Bar Graphs')
    .replace(/Time & Money \(intro\)/gi, 'Time & Money')
    .replace(/Ratios and Proportional Reasoning/gi, 'Ratios & Proportional Reasoning')
    .replace(/duction to Fractions/gi, 'Fractions (concepts, equivalence)')
    .replace(/earth systems \(geosphere\/hydrosphere\)/gi, 'earth systems geosphere hydrosphere');

const buildCandidate = (
  row: QuestionRow,
  counters: Map<string, number>,
): CandidateQuestion | null => {
  const rawPrompt = row.prompt.trim();
  const prompt = canonicalizePrompt(rawPrompt);

  if (rawPrompt === 'What should you do if you get stuck on a picture/bar graphs (intro) (grade k) problem?') {
    return nextVariant(pictureBarGraphsSupportVariants, 'picture_bar_graphs_support', counters);
  }

  if (rawPrompt === 'What should you do if you get stuck on a ratios and proportional reasoning problem?') {
    return nextVariant(ratiosProportionalSupportVariants, 'ratios_proportional_support', counters);
  }

  if (rawPrompt === 'What should you do if you get stuck on a ratios and proportional reasoning (grade 6): grade 6 problem?') {
    return nextVariant(ratiosProportionalSupportVariants, 'ratios_proportional_support', counters);
  }

  if (rawPrompt === 'What should you do if you get stuck on a time & money (intro) (grade k) problem?') {
    return nextVariant(timeMoneySupportVariants, 'time_money_support', counters);
  }

  const exact = exactMatchCandidates.get(prompt);
  if (exact) {
    return exact;
  }

  if (prompt === 'What is the main concept of Transformations?') {
    return nextVariant(createTransformationsMainVariants(), 'transformations_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a transformations problem?') {
    return nextVariant(createTransformationsSupportVariants(), 'transformations_support', counters);
  }

  if (prompt === 'What is the purpose of literary nonfiction (pd/open) in reading and writing?') {
    return nextVariant(literaryNonfictionVariants, 'literary_nonfiction', counters);
  }

  if (prompt === 'What is the purpose of world lit (pd where possible) in reading and writing?') {
    return nextVariant(worldLitVariants, 'world_lit', counters);
  }

  if (prompt === 'What is the purpose of a presentation?') {
    return toCandidate(
      'Why do speakers organize a presentation before sharing it with an audience?',
      'A presentation should be organized so the audience can follow the main idea and supporting details clearly.',
      [
        { content: 'to help the audience understand the main ideas clearly', isCorrect: true },
        { content: 'to avoid using any details or examples', isCorrect: false },
        { content: 'to make the topic harder to follow', isCorrect: false },
        { content: 'to replace speaking with silence', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of bar lines in sheet music?') {
    return toCandidate(
      'Why do musicians use bar lines in sheet music?',
      'Bar lines divide music into measures, which helps musicians read rhythm and keep track of the beat.',
      [
        { content: 'to divide music into measures and organize the beat', isCorrect: true },
        { content: 'to show that every note should be skipped', isCorrect: false },
        { content: 'to replace the staff completely', isCorrect: false },
        { content: 'to make all notes louder', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of debugging?') {
    return toCandidate(
      'Why do programmers debug their code?',
      'Debugging means finding and fixing mistakes so the program works the way it should.',
      [
        { content: 'to find and fix errors in the program', isCorrect: true },
        { content: 'to add random bugs on purpose', isCorrect: false },
        { content: 'to avoid testing the code', isCorrect: false },
        { content: 'to make the program stop working', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of a function block?') {
    return toCandidate(
      'Why do programmers use a function block?',
      'A function groups steps into a reusable block of code that can be called when needed.',
      [
        { content: 'to reuse a named set of instructions', isCorrect: true },
        { content: 'to store pictures instead of code', isCorrect: false },
        { content: 'to make every line run forever', isCorrect: false },
        { content: 'to remove all input from a program', isCorrect: false },
      ],
    );
  }

  if (prompt === "What is the purpose of an 'if' block in programming?") {
    return toCandidate(
      'What does an "if" statement help a program do?',
      'An if statement lets a program choose what to do based on whether a condition is true or false.',
      [
        { content: 'make a decision based on a condition', isCorrect: true },
        { content: 'repeat forever with no condition', isCorrect: false },
        { content: 'rename every variable automatically', isCorrect: false },
        { content: 'turn text into music', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of comments in code?') {
    return toCandidate(
      'Why do programmers add comments to code?',
      'Comments help explain what code does so people can read and maintain it more easily.',
      [
        { content: 'to explain the code for readers', isCorrect: true },
        { content: 'to make the computer run comments as commands', isCorrect: false },
        { content: 'to delete the rest of the program', isCorrect: false },
        { content: 'to replace variables with sentences', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of a variable in Python or JavaScript?') {
    return toCandidate(
      'Why do programmers use a variable in code?',
      'A variable stores a value that a program can use or change later.',
      [
        { content: 'to store a value for later use', isCorrect: true },
        { content: 'to draw graphics by itself', isCorrect: false },
        { content: 'to force every answer to be the same', isCorrect: false },
        { content: 'to stop the program from using data', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of a for loop in coding?') {
    return toCandidate(
      'Why do programmers use a for loop?',
      'A for loop repeats a set of instructions for each item or for a certain number of times.',
      [
        { content: 'to repeat instructions in a controlled way', isCorrect: true },
        { content: 'to store text like a variable', isCorrect: false },
        { content: 'to make decisions like an if statement only', isCorrect: false },
        { content: 'to erase the program after one step', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the main concept of Confidence Intervals & Hypothesis Tests (intro HS Stats)?') {
    return nextVariant(createStatsMainVariants(), 'stats_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a confidence intervals & hypothesis tests (intro hs stats) problem?') {
    return nextVariant(createStatsSupportVariants(), 'stats_support', counters);
  }

  if (prompt === 'What is the main concept of Linear/Quadratic Functions?') {
    return nextVariant(linearQuadraticVariants, 'linear_quadratic_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a linear/quadratic functions problem?') {
    return nextVariant(linearQuadraticSupportVariants, 'linear_quadratic_support', counters);
  }

  if (prompt === 'What is the main concept of Piecewise/Absolute Value?') {
    return nextVariant(piecewiseVariants, 'piecewise_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a piecewise/absolute value problem?') {
    return nextVariant(piecewiseSupportVariants, 'piecewise_support', counters);
  }

  if (prompt === 'What is the main concept of Modeling & Applications?') {
    return nextVariant(modelingApplicationsVariants, 'modeling_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a modeling & applications problem?') {
    return nextVariant(modelingApplicationsSupportVariants, 'modeling_support', counters);
  }

  if (prompt === 'What is the main concept of Vectors?') {
    return nextVariant(vectorsVariants, 'vectors_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a vectors problem?') {
    return nextVariant(vectorsSupportVariants, 'vectors_support', counters);
  }

  if (prompt === 'What is the main concept of Complex Numbers?') {
    return nextVariant(complexNumbersVariants, 'complex_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a complex numbers problem?') {
    return nextVariant(complexNumbersSupportVariants, 'complex_support', counters);
  }

  if (prompt === 'What is the main concept of Polynomial & Rational Expressions?') {
    return nextVariant(polynomialRationalVariants, 'poly_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a polynomial & rational expressions problem?') {
    return nextVariant(polynomialRationalSupportVariants, 'poly_support', counters);
  }

  if (prompt === 'What is the main concept of Sequences & Series?') {
    return nextVariant(sequencesSeriesVariants, 'sequences_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a sequences & series problem?') {
    return nextVariant(sequencesSeriesSupportVariants, 'sequences_support', counters);
  }

  if (prompt === 'What is the main concept of Integrals?') {
    return nextVariant(integralsVariants, 'integrals_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a integrals problem?') {
    return nextVariant(integralsSupportVariants, 'integrals_support', counters);
  }

  if (prompt === 'What is the main concept of Parametric/Polar (optional)?') {
    return nextVariant(parametricPolarVariants, 'parametric_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a parametric/polar (optional) problem?') {
    return nextVariant(parametricPolarSupportVariants, 'parametric_support', counters);
  }

  if (prompt === 'What is the main concept of Limits?') {
    return nextVariant(limitsVariants, 'limits_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a limits problem?') {
    return nextVariant(limitsSupportVariants, 'limits_support', counters);
  }

  if (prompt === 'What is the main concept of Normal Distribution?') {
    return nextVariant(normalDistributionVariants, 'normal_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a normal distribution problem?') {
    return nextVariant(normalDistributionSupportVariants, 'normal_support', counters);
  }

  if (prompt === 'What is the main concept of Regression (linear/multiple)?') {
    return nextVariant(regressionVariants, 'regression_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a regression (linear/multiple) problem?') {
    return nextVariant(regressionSupportVariants, 'regression_support', counters);
  }

  if (prompt === 'What is the main concept of Polynomial/Polynomial Identities?') {
    return nextVariant(polynomialIdentitiesVariants, 'poly_id_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a polynomial/polynomial identities problem?') {
    return nextVariant(polynomialIdentitiesSupportVariants, 'poly_id_support', counters);
  }

  if (prompt === 'What is the main concept of Rational/ Radical Functions?') {
    return nextVariant(rationalRadicalVariants, 'rational_radical_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a rational/ radical functions problem?') {
    return nextVariant(rationalRadicalSupportVariants, 'rational_radical_support', counters);
  }

  if (prompt === 'What is the main concept of Derivatives?') {
    return nextVariant(derivativesVariants, 'derivatives_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a derivatives problem?') {
    return nextVariant(derivativesSupportVariants, 'derivatives_support', counters);
  }

  if (prompt === 'What is the main concept of Descriptive/Inferential Statistics?') {
    return nextVariant(descriptiveInferentialVariants, 'descriptive_inferential_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a descriptive/inferential statistics problem?') {
    return nextVariant(descriptiveInferentialSupportVariants, 'descriptive_inferential_support', counters);
  }

  if (prompt === 'What is the main concept of Exponential/Logarithmic Functions?') {
    return nextVariant(exponentialLogVariants, 'exp_log_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a exponential/logarithmic functions problem?') {
    return nextVariant(exponentialLogSupportVariants, 'exp_log_support', counters);
  }

  if (prompt === 'What is the purpose of poetry/drama (pd) in reading and writing?') {
    return nextVariant(poetryDramaVariants, 'poetry_drama', counters);
  }

  if (prompt === 'What is the purpose of discipline-specific terms, test prep in reading and writing?') {
    return nextVariant(academicVocabularyVariants, 'academic_vocab', counters);
  }

  if (prompt === 'What is the purpose of research papers, rhetoric, style, mla/apa basics, grammar review in reading and writing?') {
    return nextVariant(researchWritingVariants, 'research_writing', counters);
  }

  if (prompt === 'What is the purpose of seminars, academic discussions, formal presentations in reading and writing?') {
    return nextVariant(seminarPresentationVariants, 'seminar_presentation', counters);
  }

  if (prompt === 'What is the purpose of primary sources (pd) in reading and writing?') {
    return nextVariant(primarySourcesVariants, 'primary_sources', counters);
  }

  if (prompt === 'What is the purpose of show & tell, retelling in reading and writing?') {
    return nextVariant(showTellRetellingVariants, 'show_tell_retelling', counters);
  }

  if (prompt === 'What is the purpose of fables & folktales (pd) in reading and writing?') {
    return nextVariant(fablesFolktalesVariants, 'fables_folktales', counters);
  }

  if (prompt === 'What is the purpose of simple nonfiction (animals, places) in reading and writing?') {
    return nextVariant(simpleNonfictionVariants, 'simple_nonfiction', counters);
  }

  if (prompt === 'What is the purpose of handwriting, sentences, capitalization/punctuation in reading and writing?') {
    return nextVariant(handwritingConventionsVariants, 'handwriting_conventions', counters);
  }

  if (prompt === 'What is the purpose of picture books (pd) in reading and writing?') {
    return nextVariant(pictureBooksVariants, 'picture_books', counters);
  }

  if (prompt === 'What is the purpose of sight words & phonics in reading and writing?') {
    return nextVariant(sightWordsPhonicsVariants, 'sight_words_phonics', counters);
  }

  if (prompt === 'What is the purpose of poetry (short forms) in reading and writing?') {
    return nextVariant(poetryShortFormsVariants, 'poetry_short_forms', counters);
  }

  if (prompt === 'What is the purpose of american/british lit (pd works) in reading and writing?') {
    return nextVariant(americanBritishLitVariants, 'american_british_lit', counters);
  }

  if (prompt === 'What is the purpose of rhetoric & argument in reading and writing?') {
    return nextVariant(rhetoricArgumentVariants, 'rhetoric_argument', counters);
  }

  if (prompt === 'What is the main concept of Trigonometry (right/units)?') {
    return nextVariant(trigonometryRightUnitsVariants, 'trig_right_units_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a trigonometry (right/units) problem?') {
    return nextVariant(trigonometryRightUnitsSupportVariants, 'trig_right_units_support', counters);
  }

  if (prompt === 'What is the main concept of Trigonometric Identities?') {
    return nextVariant(trigonometricIdentitiesVariants, 'trig_identities_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a trigonometric identities problem?') {
    return nextVariant(trigonometricIdentitiesSupportVariants, 'trig_identities_support', counters);
  }

  if (prompt === 'What is the main concept of Matrices (optional)?') {
    return nextVariant(matricesVariants, 'matrices_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a matrices (optional) problem?') {
    return nextVariant(matricesSupportVariants, 'matrices_support', counters);
  }

  if (prompt === 'What is the main concept of Conic Sections?') {
    return nextVariant(conicSectionsVariants, 'conic_sections_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a conic sections problem?') {
    return nextVariant(conicSectionsSupportVariants, 'conic_sections_support', counters);
  }

  if (prompt === 'What is the main concept of Perimeter?') {
    return nextVariant(perimeterVariants, 'perimeter_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a perimeter problem?') {
    return nextVariant(perimeterSupportVariants, 'perimeter_support', counters);
  }

  if (prompt === 'What is the main concept of Picture/Bar Graphs?') {
    return nextVariant(pictureBarGraphsVariants, 'picture_bar_graphs_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a picture/bar graphs problem?') {
    return nextVariant(pictureBarGraphsSupportVariants, 'picture_bar_graphs_support', counters);
  }

  if (prompt === 'What is the main concept of Categorize & Tally?') {
    return nextVariant(categorizeTallyVariants, 'categorize_tally_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a categorize & tally problem?') {
    return nextVariant(categorizeTallySupportVariants, 'categorize_tally_support', counters);
  }

  if (prompt === 'What is the main concept of Skip Counting?') {
    return nextVariant(skipCountingVariants, 'skip_counting_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a skip counting problem?') {
    return nextVariant(skipCountingSupportVariants, 'skip_counting_support', counters);
  }

  if (prompt === 'What is the main concept of Describe Data (more/less)?') {
    return nextVariant(describeDataVariants, 'describe_data_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a describe data (more/less) problem?') {
    return nextVariant(describeDataSupportVariants, 'describe_data_support', counters);
  }

  if (prompt === 'What is the main concept of Compare Numbers?') {
    return nextVariant(compareNumbersVariants, 'compare_numbers_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a compare numbers problem?') {
    return nextVariant(compareNumbersSupportVariants, 'compare_numbers_support', counters);
  }

  if (prompt === 'What is the main concept of 2D/3D Shapes & Attributes?') {
    return nextVariant(shapesAttributesVariants, 'shapes_attributes_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a 2d/3d shapes & attributes problem?') {
    return nextVariant(shapesAttributesSupportVariants, 'shapes_attributes_support', counters);
  }

  if (prompt === 'What is the main concept of Time & Money?') {
    return nextVariant(timeMoneyVariants, 'time_money_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a time & money problem?') {
    return nextVariant(timeMoneySupportVariants, 'time_money_support', counters);
  }

  if (prompt === 'What is the main concept of Place Value (tens/ones)?') {
    return nextVariant(placeValueVariants, 'place_value_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a place value (tens/ones) problem?') {
    return nextVariant(placeValueSupportVariants, 'place_value_support', counters);
  }

  if (prompt === 'What is the main concept of Counting & Cardinality?') {
    return nextVariant(countingCardinalityVariants, 'counting_cardinality_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a counting & cardinality problem?') {
    return nextVariant(countingCardinalitySupportVariants, 'counting_cardinality_support', counters);
  }

  if (prompt === 'What is the main concept of Addition/Subtraction within 20?') {
    return nextVariant(additionSubtractionWithin20Variants, 'add_sub_20_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a addition/subtraction within 20 problem?') {
    return nextVariant(additionSubtractionWithin20SupportVariants, 'add_sub_20_support', counters);
  }

  if (prompt === 'What is the main concept of Probability (experimental)?') {
    return nextVariant(probabilityExperimentalVariants, 'probability_experimental_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a probability (experimental) problem?') {
    return nextVariant(probabilityExperimentalSupportVariants, 'probability_experimental_support', counters);
  }

  if (prompt === 'What is the main concept of Ratios & Proportional Reasoning?') {
    return nextVariant(ratiosProportionalVariants, 'ratios_proportional_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a ratios & proportional reasoning problem?') {
    return nextVariant(ratiosProportionalSupportVariants, 'ratios_proportional_support', counters);
  }

  if (prompt === 'What is the purpose of presentations, summaries in reading and writing?') {
    return nextVariant(presentationsSummariesVariants, 'presentations_summaries', counters);
  }

  if (prompt === 'What is the purpose of academic vocabulary, greek/latin roots in reading and writing?') {
    return nextVariant(academicVocabularyRootsVariants, 'academic_vocab_roots', counters);
  }

  if (prompt === 'What is the purpose of roots/prefixes/suffixes in reading and writing?') {
    return nextVariant(rootsPrefixesSuffixesVariants, 'roots_prefixes_suffixes', counters);
  }

  if (prompt === 'What is the purpose of nonfiction articles (open-licensed) in reading and writing?') {
    return nextVariant(nonfictionArticlesVariants, 'nonfiction_articles', counters);
  }

  if (prompt === 'What is the purpose of myths/legends (pd) in reading and writing?') {
    return nextVariant(mythsLegendsVariants, 'myths_legends', counters);
  }

  if (prompt === 'What is the purpose of novellas/short novels (pd) in reading and writing?') {
    return nextVariant(novellasVariants, 'novellas_short_novels', counters);
  }

  if (prompt === 'What is the purpose of short stories (pd) in reading and writing?') {
    return nextVariant(shortStoriesVariants, 'short_stories', counters);
  }

  if (prompt === 'What is the purpose of historical documents (pd) in reading and writing?') {
    return nextVariant(historicalDocumentsVariants, 'historical_documents', counters);
  }

  if (prompt === 'What is the purpose of paragraphs, narratives, expository writing, grammar basics in reading and writing?') {
    return toCandidate(
      'What helps a writer build a strong paragraph?',
      'A strong paragraph includes a clear main idea and supporting details that stay on topic.',
      [
        { content: 'a clear main idea with supporting details', isCorrect: true },
        { content: 'random sentences with no connection', isCorrect: false },
        { content: 'only punctuation marks', isCorrect: false },
        { content: 'a list of unrelated words', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of chapter books (pd) in reading and writing?') {
    return nextVariant(chapterBooksVariants, 'chapter_books', counters);
  }

  if (prompt === 'What is the purpose of essays, research, argumentative writing, grammar & usage in reading and writing?') {
    return nextVariant(essaysResearchArgumentVariants, 'essays_research_argument', counters);
  }

  if (prompt === 'What is the purpose of debates, multimedia presentations in reading and writing?') {
    return nextVariant(debatesMultimediaVariants, 'debates_multimedia', counters);
  }

  if (prompt === 'What is the purpose of data cleaning or preprocessing?') {
    return toCandidate(
      'Why do data scientists clean or preprocess data before analyzing it?',
      'Cleaning data helps remove errors, fill missing values, and make the dataset more reliable to analyze.',
      [
        { content: 'to fix errors and prepare the data for accurate analysis', isCorrect: true },
        { content: 'to make sure the data cannot be used', isCorrect: false },
        { content: 'to replace all analysis with guessing', isCorrect: false },
        { content: 'to hide the variables from the user', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the purpose of interest rates on loans?') {
    return toCandidate(
      'Why do lenders charge interest on a loan?',
      'Interest is the cost borrowers pay for using borrowed money over time.',
      [
        { content: 'to charge for borrowing money over time', isCorrect: true },
        { content: 'to make the loan amount disappear', isCorrect: false },
        { content: 'to cancel the need to repay the loan', isCorrect: false },
        { content: 'to turn the loan into a grant', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the main concept of Expressions & Equations?') {
    return nextVariant(expressionsEquationsVariants, 'expressions_equations_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a expressions & equations problem?') {
    return nextVariant(expressionsEquationsSupportVariants, 'expressions_equations_support', counters);
  }

  if (prompt === 'What is the main concept of Coordinate Plane (Quadrant I)?') {
    return nextVariant(coordinatePlaneQuadrantOneVariants, 'coordinate_plane_q1_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a coordinate plane (quadrant i) problem?') {
    return nextVariant(coordinatePlaneQuadrantOneSupportVariants, 'coordinate_plane_q1_support', counters);
  }

  if (prompt === 'What is the main concept of Percent & Rates?') {
    return nextVariant(percentRatesVariants, 'percent_rates_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a percent & rates problem?') {
    return nextVariant(percentRatesSupportVariants, 'percent_rates_support', counters);
  }

  if (prompt === 'What is the main concept of Interpreting Tables/Charts?') {
    return nextVariant(interpretingTablesChartsVariants, 'interpreting_tables_charts_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a interpreting tables/charts problem?') {
    return nextVariant(interpretingTablesChartsSupportVariants, 'interpreting_tables_charts_support', counters);
  }

  if (prompt === 'What is the main concept of Probability Rules?') {
    return nextVariant(probabilityRulesVariants, 'probability_rules_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a probability rules problem?') {
    return nextVariant(probabilityRulesSupportVariants, 'probability_rules_support', counters);
  }

  if (prompt === 'What is the main concept of Functions?') {
    return nextVariant(functionsVariants, 'functions_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a functions problem?') {
    return nextVariant(functionsSupportVariants, 'functions_support', counters);
  }

  if (prompt === 'What is the main concept of Two-way Tables?') {
    return nextVariant(twoWayTablesVariants, 'two_way_tables_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a two-way tables problem?') {
    return nextVariant(twoWayTablesSupportVariants, 'two_way_tables_support', counters);
  }

  if (prompt === 'What is the main concept of Volume?') {
    return nextVariant(volumeVariants, 'volume_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a volume problem?') {
    return nextVariant(volumeSupportVariants, 'volume_support', counters);
  }

  if (prompt === 'What is the main concept of Place Value (thousands/millions)?') {
    return nextVariant(placeValueLargeVariants, 'place_value_large_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a place value (thousands/millions) problem?') {
    return nextVariant(placeValueLargeSupportVariants, 'place_value_large_support', counters);
  }

  if (prompt === 'What is the main concept of Scatterplots & Correlation?') {
    return nextVariant(scatterplotsCorrelationVariants, 'scatterplots_correlation_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a scatterplots & correlation problem?') {
    return nextVariant(scatterplotsCorrelationSupportVariants, 'scatterplots_correlation_support', counters);
  }

  if (prompt === 'What is the main concept of Area/Perimeter?') {
    return nextVariant(areaPerimeterVariants, 'area_perimeter_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a area/perimeter problem?') {
    return nextVariant(areaPerimeterSupportVariants, 'area_perimeter_support', counters);
  }

  if (prompt === 'What is the main concept of Transformations & Symmetry?') {
    return nextVariant(transformationsSymmetryVariants, 'transformations_symmetry_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a transformations & symmetry problem?') {
    return nextVariant(transformationsSymmetrySupportVariants, 'transformations_symmetry_support', counters);
  }

  if (prompt === 'What is the main concept of Rounding & Estimation?') {
    return nextVariant(roundingEstimationVariants, 'rounding_estimation_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a rounding & estimation problem?') {
    return nextVariant(roundingEstimationSupportVariants, 'rounding_estimation_support', counters);
  }

  if (prompt === 'What is the main concept of Decimals?') {
    return nextVariant(decimalsVariants, 'decimals_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a decimals problem?') {
    return nextVariant(decimalsSupportVariants, 'decimals_support', counters);
  }

  if (prompt === 'What is the main concept of Coordinate Geometry?') {
    return nextVariant(coordinateGeometryVariants, 'coordinate_geometry_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a coordinate geometry problem?') {
    return nextVariant(coordinateGeometrySupportVariants, 'coordinate_geometry_support', counters);
  }

  if (prompt === 'What is the purpose of biographies (pd) in reading and writing?') {
    return nextVariant(biographiesVariants, 'biographies', counters);
  }

  if (prompt === 'What is the main concept of Volume & Surface Area?') {
    return nextVariant(volumeVariants, 'volume_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a volume & surface area problem?') {
    return nextVariant(volumeSupportVariants, 'volume_support', counters);
  }

  if (prompt === 'What is the main concept of Fractions (concepts, equivalence)?') {
    return nextVariant(fractionsConceptsVariants, 'fractions_concepts_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a fractions (concepts, equivalence) problem?') {
    return nextVariant(fractionsConceptsSupportVariants, 'fractions_concepts_support', counters);
  }

  if (prompt === 'What is the main concept of Multiplication/Division?') {
    return nextVariant(multiplicationDivisionVariants, 'multiplication_division_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a multiplication/division problem?') {
    return nextVariant(multiplicationDivisionSupportVariants, 'multiplication_division_support', counters);
  }

  if (prompt === 'What is the main concept of Integers & Rational Numbers?') {
    return nextVariant(integersRationalVariants, 'integers_rational_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a integers & rational numbers problem?') {
    return nextVariant(integersRationalSupportVariants, 'integers_rational_support', counters);
  }

  if (prompt === 'What should you do if you get stuck on a Fractions (concepts, equivalence) problem?') {
    return nextVariant(fractionsConceptsSupportVariants, 'fractions_concepts_support', counters);
  }

  if (prompt === 'What is the main concept of Nets and Prisms?') {
    return toCandidate(
      'What is a net of a 3D figure?',
      'A net is a flat pattern that can be folded to make a three-dimensional figure.',
      [
        { content: 'a flat pattern that folds into a 3D shape', isCorrect: true },
        { content: 'the space inside a prism', isCorrect: false },
        { content: 'the distance around a polygon', isCorrect: false },
        { content: 'a coordinate graph', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What should you do if you get stuck on a nets and prisms problem?') {
    return toCandidate(
      'Which solid can be made from a net of 6 equal squares?',
      'Six equal squares can fold to form a cube.',
      [
        { content: 'a cube', isCorrect: true },
        { content: 'a sphere', isCorrect: false },
        { content: 'a triangle', isCorrect: false },
        { content: 'a circle', isCorrect: false },
      ],
    );
  }

  if (prompt === 'What is the main concept of Simple Probability (informal)?') {
    return nextVariant(simpleProbabilityVariants, 'simple_probability_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a simple probability (informal) problem?') {
    return nextVariant(simpleProbabilitySupportVariants, 'simple_probability_support', counters);
  }

  if (prompt === 'What is the main concept of Length/Weight/Capacity (non-standard/standard)?') {
    return nextVariant(measurementVariants, 'measurement_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a length/weight/capacity (non-standard/standard) problem?') {
    return nextVariant(measurementSupportVariants, 'measurement_support', counters);
  }

  if (prompt === 'What is the main concept of Angles & Lines?') {
    return nextVariant(anglesLinesVariants, 'angles_lines_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a angles & lines problem?') {
    return nextVariant(anglesLinesSupportVariants, 'angles_lines_support', counters);
  }

  if (prompt === 'In Social Studies class, which step best evaluates information about this topic?') {
    return nextVariant(socialStudiesEvaluateInformationVariants, 'social_studies_evaluate', counters);
  }

  if (prompt === 'A frog starts life as a ___.') {
    return toCandidate(
      'Which stage comes first in a frog\'s life cycle?',
      'Frogs begin their life cycle as tadpoles before they grow legs and become adult frogs.',
      [
        { content: 'tadpole', isCorrect: true },
        { content: 'kitten', isCorrect: false },
        { content: 'seed', isCorrect: false },
        { content: 'puppy', isCorrect: false },
      ],
    );
  }

  if (prompt === 'Count by 2s: 2, 4, 6, ___.' || prompt === 'Count by 2s: 2, 4, 6, ___') {
    return toCandidate(
      'What number comes next when counting by 2s: 2, 4, 6, ...?',
      'Skip counting by 2 means add 2 each time, so the next number after 6 is 8.',
      [
        { content: '8', isCorrect: true },
        { content: '7', isCorrect: false },
        { content: '9', isCorrect: false },
        { content: '10', isCorrect: false },
      ],
    );
  }

  if (prompt === 'A baby dog is called a ___.') {
    return toCandidate(
      'What is a young dog called?',
      'A young dog is called a puppy.',
      [
        { content: 'puppy', isCorrect: true },
        { content: 'kit', isCorrect: false },
        { content: 'calf', isCorrect: false },
        { content: 'cub', isCorrect: false },
      ],
    );
  }

  const scientificMethodMatch = prompt.match(/^What is the scientific method used when studying (.+)\?$/i);
  if (scientificMethodMatch) {
    const topic = scientificMethodMatch[1]?.trim() ?? '';
    const normalizedTopic = topic.toLowerCase();
    if (topic.toLowerCase().includes('systems design')) {
      return nextVariant(systemsDesignVariants, 'systems_design', counters);
    }
    if (normalizedTopic.includes('habitats')) {
      return habitatsScienceCandidates();
    }
    if (normalizedTopic.includes('earth materials') || normalizedTopic.includes('rocks/soil')) {
      return earthMaterialsCandidates();
    }
    if (normalizedTopic.includes('weather') || normalizedTopic.includes('seasons')) {
      return weatherSeasonsCandidates();
    }
    if (normalizedTopic.includes('ask/imagine/plan/create/test') || normalizedTopic.includes('design cycle')) {
      return askImaginePlanCreateTestCandidates();
    }
    if (normalizedTopic.includes('energy') || normalizedTopic.includes('heat/sun')) {
      return energyHeatSunCandidates();
    }
    if (normalizedTopic.includes('life cycles')) {
      return lifeCyclesCandidates();
    }
    if (normalizedTopic.includes('matter properties') || normalizedTopic.includes('solids/liquids/gases')) {
      return matterPropertiesCandidates();
    }
    if (normalizedTopic.includes('light') || normalizedTopic.includes('sound')) {
      return lightSoundCandidates();
    }
    if (normalizedTopic.includes('plants/animals needs')) {
      return plantsAnimalsNeedsCandidates();
    }
    if (normalizedTopic.includes('forces') || normalizedTopic.includes('push/pull')) {
      return forcesMotionCandidates();
    }
    if (normalizedTopic.includes('sun/moon/stars') || normalizedTopic.includes('patterns')) {
      return sunMoonStarsCandidates();
    }
    if (normalizedTopic.includes('solar system relative scale')) {
      return solarSystemRelativeScaleCandidates();
    }
    if (normalizedTopic.includes('plate tectonics')) {
      return plateTectonicsCandidates();
    }
    if (normalizedTopic.includes('human body systems detailed')) {
      return humanBodySystemsCandidates();
    }
    return scientificTopicCandidates(topic);
  }

  if (prompt === 'What is the main concept of Sampling & Inference?') {
    return nextVariant(samplingInferenceVariants, 'sampling_inference_main', counters);
  }

  if (prompt === 'What should you do if you get stuck on a sampling & inference problem?') {
    return nextVariant(samplingInferenceSupportVariants, 'sampling_inference_support', counters);
  }

  return null;
};

const loadAuditRows = (auditCsvPath: string, top: number): AuditCsvRow[] => {
  const resolved = path.resolve(process.cwd(), auditCsvPath);
  const csv = fs.readFileSync(resolved, 'utf8');
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
  }).slice(0, top) as AuditCsvRow[];
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const auditRows = loadAuditRows(options.auditCsvPath, options.top);
  const targetIds = auditRows
    .map((row) => Number.parseInt(row.question_id, 10))
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  if (!targetIds.length) {
    console.log('No target question ids found in the audit CSV.');
    return;
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, prompt, question_type, solution_explanation, metadata, question_options(id, option_order, content, is_correct)')
    .in('id', targetIds)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`Failed to load target question rows: ${error.message}`);
  }

  const rows = ((data ?? []) as QuestionRow[]).sort(
    (left, right) => targetIds.indexOf(left.id) - targetIds.indexOf(right.id),
  );

  const counters = new Map<string, number>();
  const planned: ReplacementPlan[] = [];
  const skipped: Array<{ id: number; prompt: string }> = [];

  for (const row of rows) {
    const candidate = buildCandidate(row, counters);
    if (!candidate) {
      skipped.push({ id: row.id, prompt: row.prompt });
      continue;
    }
    validateCandidate(candidate);
    planned.push({
      id: row.id,
      oldPrompt: row.prompt,
      candidate,
    });
  }

  console.log(`Loaded ${rows.length} audited questions.`);
  console.log(`Planned remediations: ${planned.length}`);
  console.log(`Skipped (no supported template yet): ${skipped.length}`);

  if (planned.length > 0) {
    planned.slice(0, 20).forEach((entry) => {
      console.log(`- Q${entry.id}: "${entry.oldPrompt}" -> "${entry.candidate.prompt}"`);
    });
  }

  if (skipped.length > 0) {
    console.log('\nSkipped rows:');
    skipped.slice(0, 20).forEach((entry) => {
      console.log(`- Q${entry.id}: "${entry.prompt}"`);
    });
  }

  if (!options.apply) {
    console.log('\nRun with --apply to persist changes.');
    return;
  }

  for (const entry of planned) {
    const { error: updateError } = await supabase
      .from('question_bank')
      .update({
        prompt: entry.candidate.prompt,
        solution_explanation: entry.candidate.explanation,
      })
      .eq('id', entry.id);

    if (updateError) {
      throw new Error(`Failed to update question ${entry.id}: ${updateError.message}`);
    }

    const { error: deleteError } = await supabase
      .from('question_options')
      .delete()
      .eq('question_id', entry.id);

    if (deleteError) {
      throw new Error(`Failed to delete options for question ${entry.id}: ${deleteError.message}`);
    }

    const { error: insertError } = await supabase.from('question_options').insert(
      entry.candidate.options.map((option, index) => ({
        question_id: entry.id,
        option_order: index + 1,
        content: option.content,
        is_correct: option.isCorrect,
      })),
    );

    if (insertError) {
      throw new Error(`Failed to insert options for question ${entry.id}: ${insertError.message}`);
    }
  }

  console.log(`\nApplied ${planned.length} question remediations.`);
};

const invokedFromCli =
  process.argv[1]?.includes('remediate_top_question_bank_batch.ts') ||
  process.argv[1]?.includes('remediate_top_question_bank_batch.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
