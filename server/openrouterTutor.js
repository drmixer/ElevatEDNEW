/**
 * In-memory multi-turn K–12 tutoring helper powered by OpenRouter.
 * Exposes getTutoringResponse(studentId, studentQuestion) for reuse across the app.
 */

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'mistralai/mistral-7b-instruct:free';
const REQUEST_TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = [
  'You are a patient, friendly AI tutor for K–12 students.',
  'Explain concepts step by step.',
  'Use age-appropriate examples.',
  'Keep answers clear and concise.',
  'Suggest hints if the student struggles.',
  'Use short sentences for younger students, longer for older students.',
].join('\n');

// Simple in-memory conversation storage keyed by studentId
const conversationHistory = new Map();

const getHistory = (studentId) => conversationHistory.get(studentId) ?? [];

const saveExchange = (studentId, question, answer) => {
  const prior = getHistory(studentId);
  const nextHistory = [
    ...prior,
    { role: 'user', content: question, timestamp: Date.now() },
    { role: 'assistant', content: answer, timestamp: Date.now() },
  ];
  conversationHistory.set(studentId, nextHistory);
};

const buildMessages = (history, latestQuestion) => [
  { role: 'system', content: SYSTEM_PROMPT },
  ...history.map(({ role, content }) => ({ role, content })),
  { role: 'user', content: latestQuestion },
];

const callOpenRouter = async (messages) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_BASE_URL ?? 'https://elevated.chat',
        'X-Title': 'ElevatED Tutor',
      },
      body: JSON.stringify({ model: MODEL, messages }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${body}`);
    }

    const json = await response.json();
    const modelAnswer = json?.choices?.[0]?.message?.content?.trim();
    if (!modelAnswer) {
      throw new Error('OpenRouter response was empty.');
    }

    return modelAnswer;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Request a tutoring response with multi-turn context.
 * @param {string} studentId unique student/session identifier
 * @param {string} studentQuestion latest learner question
 * @returns {Promise<{studentQuestion: string, modelAnswer: string, skillTag: string|null, difficultyLevel: string|null, timestamp: string, error?: string}>}
 */
export const getTutoringResponse = async (studentId, studentQuestion) => {
  const timestamp = new Date().toISOString();
  const baseResponse = {
    studentQuestion,
    modelAnswer: '',
    skillTag: null,
    difficultyLevel: null,
    timestamp,
  };

  if (!studentId) {
    return {
      ...baseResponse,
      modelAnswer: 'A student identifier is required to continue this tutoring session.',
      error: 'missing_student_id',
    };
  }

  const trimmedQuestion = (studentQuestion ?? '').trim();
  if (!trimmedQuestion) {
    return {
      ...baseResponse,
      modelAnswer: 'Please share a question so I can help.',
      error: 'empty_question',
    };
  }

  const history = getHistory(studentId);
  const messages = buildMessages(history, trimmedQuestion);

  try {
    const modelAnswer = await callOpenRouter(messages);
    const responsePayload = {
      ...baseResponse,
      studentQuestion: trimmedQuestion,
      modelAnswer,
      // skillTag and difficultyLevel can be populated upstream if desired.
    };

    saveExchange(studentId, trimmedQuestion, modelAnswer);
    return responsePayload;
  } catch (error) {
    // Keep the app stable with a graceful fallback message.
    return {
      ...baseResponse,
      modelAnswer: 'Sorry, I had trouble reaching the tutor. Please try again in a moment.',
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
};

// Example usage (only runs when invoked directly, not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const response1 = await getTutoringResponse('student123', 'Explain fractions to a 5th grader');
    console.log(response1);

    const response2 = await getTutoringResponse('student123', 'Can you give me an example with pizza?');
    console.log(response2);
  })();
}
