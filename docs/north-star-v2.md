ElevatED Learning Platform: Implementation Specification
Version: 1.0 Last Updated: January 2026 Purpose: Complete source of truth for building the ElevatED adaptive learning platform Audience: AI coding assistants (Claude Opus, Codex), engineers, product team

Table of Contents
	1	Core Philosophy
	2	System Architecture
	3	Data Model Specification
	4	Content Structure Standards
	5	Session Engine Logic
	6	Content Authoring Process
	7	API Specifications
	8	Edge Cases & Error Handling
	9	Success Metrics
	10	Implementation Checklist

Core Philosophy
Vision
ElevatED is an AI-assisted learning platform built around guided understanding, not passive consumption. Learning is modeled as an interactive teaching conversation that continuously checks, responds, and adapts to the learner.
Fundamental Principles
	1	Teaching always comes first — but only in small, purposeful doses
	2	Understanding must be demonstrated, not assumed
	3	Practice is not separate from learning — it is learning
	4	Adaptation happens in real time, based on learner responses
	5	Progress is gated by understanding, not by reading or time spent
What Makes ElevatED Different
NOT:
	•	Markdown reader
	•	Slide deck
	•	"Lesson first, quiz later"
	•	Optional practice
	•	Passive learning
IS:
	•	Guided conversation
	•	Fair and supportive teacher
	•	Constant interaction
	•	Clear progress tied to understanding

System Architecture
High-Level Flow
Lesson Session Start
    ↓
Load Micro-Concept 1
    ↓
[TEACH STEP] → Present concept (3-6 sentences + example)
    ↓
[CHECK STEP] → Ask understanding question
    ↓
Evaluate Response → Generate Feedback
    ↓
[ADAPT LOGIC] → Decide next action
    ↓
    ├─ Correct? → Next Micro-Concept
    ├─ Incorrect (1st time)? → Reteach + Try Again
    ├─ Incorrect (2nd time)? → AI Tutor Intervention
    └─ Mastery Demonstrated? → [APPLY STEP]
    ↓
Repeat until all micro-concepts complete
    ↓
Lesson Complete
Key Components
	1	Lesson Repository (database)
	◦	Stores all lessons, micro-concepts, and steps
	◦	Source of truth for content
	2	Session Engine (server-side logic)
	◦	Manages learner progression
	◦	Evaluates responses
	◦	Executes adaptation logic
	◦	Tracks state
	3	Progress Tracker (database)
	◦	Records every learner action
	◦	Tracks attempts, responses, timestamps
	◦	Enables resumption and analytics
	4	Content Renderer (UI)
	◦	Displays steps based on type
	◦	Captures learner input
	◦	Shows feedback
	5	AI Tutor (LLM integration)
	◦	Intervenes when learner is stuck
	◦	Provides personalized explanations
	◦	Answers "why" questions

Data Model Specification
Database Schema
Table: lessons
CREATE TABLE lessons (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade_level INTEGER,
  learning_objectives TEXT[],
  prerequisite_lesson_ids INTEGER[],
  estimated_duration_minutes INTEGER, -- Auto-calculated from steps
  format_version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Notes:
	•	estimated_duration_minutes is calculated by summing metadata.estimated_seconds from all steps
	•	prerequisite_lesson_ids enforces learning dependencies
	•	format_version allows for schema evolution
Table: lesson_steps
CREATE TABLE lesson_steps (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  micro_concept_id INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('teach', 'check', 'apply')),
  order_index INTEGER NOT NULL,
  content JSONB NOT NULL,
  dependencies INTEGER[], -- Step IDs that must be completed first
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(lesson_id, order_index)
);

CREATE INDEX idx_lesson_steps_lesson_id ON lesson_steps(lesson_id);
CREATE INDEX idx_lesson_steps_concept ON lesson_steps(micro_concept_id);
CREATE INDEX idx_lesson_steps_order ON lesson_steps(lesson_id, order_index);
Key Design Decisions:
	1	Only 3 step types (not 5):
	◦	teach - Learner-facing teaching step
	◦	check - Learner-facing question with embedded response/adapt logic
	◦	apply - Learner-facing application question
	2	Respond and Adapt are not separate steps - they are internal logic within check steps
	3	micro_concept_id groups related steps together (each concept = teach + check + apply)
	4	order_index determines sequence (globally across all concepts in a lesson)
	5	dependencies allows non-linear prerequisites (usually check depends on teach)
Table: learner_step_progress
CREATE TABLE learner_step_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL REFERENCES lesson_steps(id) ON DELETE CASCADE,
  attempt_count INTEGER DEFAULT 0,
  responses JSONB[], -- Array of all attempts with timestamps
  is_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, step_id)
);

CREATE INDEX idx_learner_progress_user_lesson ON learner_step_progress(user_id, lesson_id);
CREATE INDEX idx_learner_progress_incomplete ON learner_step_progress(user_id, lesson_id, is_complete) 
  WHERE is_complete = FALSE;
Notes:
	•	responses stores full history: [{answer: 'b', is_correct: false, timestamp: '...'}, ...]
	•	confidence_level can be inferred from response time, hesitation, etc.
	•	Used for session resumption and analytics
Table: lesson_sessions
CREATE TABLE lesson_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_step_id INTEGER REFERENCES lesson_steps(id),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT NOW(),
  session_data JSONB DEFAULT '{}' -- Stores temporary state
);

CREATE INDEX idx_sessions_user_lesson ON lesson_sessions(user_id, lesson_id, status);
Purpose:
	•	Tracks active learning sessions
	•	Enables resumption after interruption
	•	Helps identify abandoned sessions for follow-up

Content Structure Standards
Step Type: teach
Purpose: Introduce exactly one concept in 3-6 sentences with one concrete example.
Content Schema:
interface TeachStepContent {
  text: string;           // 3-6 sentences explaining the concept
  example: string;        // One concrete example
  visual_aid_url?: string; // Optional: diagram, image, animation
  key_terms?: Array<{     // Optional: vocabulary to highlight
    term: string;
    definition: string;
  }>;
}
Authoring Rules:
	•	Length: 3-6 sentences maximum (75-150 words)
	•	One concept only: If you need "and," you need two teach steps
	•	Concrete example required: Abstract → Concrete always
	•	No assumptions: Explain every prerequisite or link to it
	•	Conversational tone: "Let's look at..." not "The student will learn..."
Example:
{
  "text": "In algebra, 'like terms' have the exact same variable parts. For example, 3x and 5x are like terms because they both have 'x'. But 3x and 3y are NOT like terms because the variables are different. The numbers in front (called coefficients) don't matter for determining if terms are 'like' - only the variable part matters.",
  "example": "Think of it like fruit: 3 apples + 5 apples = 8 apples (like terms). But 3 apples + 5 oranges can't be combined into one number (unlike terms).",
  "key_terms": [
    {"term": "like terms", "definition": "Terms with identical variable parts"},
    {"term": "coefficient", "definition": "The number in front of a variable"}
  ]
}
Metadata for Teach Steps:
{
  "estimated_seconds": 30,
  "difficulty": 1,
  "concept_tags": ["algebra", "like-terms", "variables"]
}

Step Type: check
Purpose: Immediately verify understanding of what was just taught. Includes response feedback and adaptation logic.
Content Schema:
interface CheckStepContent {
  question: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false';
  
  // For multiple choice
  options?: Array<{
    id: string;              // 'a', 'b', 'c', 'd'
    text: string;
    is_correct: boolean;
    misconception?: string;  // What this wrong answer reveals about thinking
  }>;
  
  // For short answer
  correct_answers?: string[];
  validation_rules?: {
    case_sensitive: boolean;
    accept_partial: boolean;
    acceptable_variations?: string[];
  };
  
  // Response logic (replaces separate "respond" step)
  feedback: {
    on_correct: {
      confirmation: string;      // "Exactly!" / "Correct!"
      reinforcement: string;     // Why it's right
    };
    on_incorrect: {
      [option_id: string]: {     // Feedback for each wrong answer
        explanation: string;     // What's wrong
        reteach: string;         // Re-explain concept differently
        hint?: string;           // Optional hint for retry
      };
      default: {                 // Catch-all for unexpected answers
        explanation: string;
        reteach: string;
      };
    };
  };
  
  // Adaptation logic (replaces separate "adapt" step)
  adaptation_rules: {
    on_correct_first_attempt: 'next_concept' | 'apply_step';
    on_incorrect_first_attempt: 'reteach_and_retry' | 'show_hint';
    on_incorrect_second_attempt: 'tutor_intervention' | 'simplify' | 'skip_with_flag';
    on_correct_after_reteach: 'next_concept' | 'apply_step';
  };
}
Authoring Rules:
	1	Direct Mapping: Question must test ONLY what was just taught in the preceding teach step
	2	Minimal Cognitive Load: One concept at a time, no trick questions
	3	Diagnostic Wrong Answers: Each wrong option should reveal a specific misconception
	4	Quality Feedback: Don't just say "wrong" - explain WHY and re-teach differently
	5	Fair Difficulty: Should be answerable if the teach step was understood
Example:
{
  "question": "Which pair contains like terms?",
  "type": "multiple_choice",
  "options": [
    {
      "id": "a",
      "text": "4x and 4y",
      "is_correct": false,
      "misconception": "Thinks same coefficient makes terms 'like'"
    },
    {
      "id": "b",
      "text": "2a and 7a",
      "is_correct": true,
      "misconception": null
    },
    {
      "id": "c",
      "text": "5 and 5x",
      "is_correct": false,
      "misconception": "Doesn't recognize that constants and variables are different"
    },
    {
      "id": "d",
      "text": "3x² and 3x",
      "is_correct": false,
      "misconception": "Doesn't recognize that x² and x are different variables"
    }
  ],
  "feedback": {
    "on_correct": {
      "confirmation": "Exactly right!",
      "reinforcement": "Both terms have the variable 'a', which is what makes them like terms. The coefficients (2 and 7) being different doesn't matter."
    },
    "on_incorrect": {
      "a": {
        "explanation": "Not quite. Even though both have 4 as the coefficient, one has 'x' and one has 'y'.",
        "reteach": "Remember: like terms must have the SAME variable part. The numbers in front can be different, but the letters must match exactly. Here, 'x' and 'y' are different variables.",
        "hint": "Look at the variables (letters), not the numbers."
      },
      "c": {
        "explanation": "Close thinking, but 5 is just a number with no variable, while 5x has the variable x.",
        "reteach": "Terms with no variables (like 5) are called constants. They can only be combined with other constants. Terms with variables (like 5x) can only be combined with terms that have the exact same variable.",
        "hint": "One has a variable, one doesn't - are they really the same type?"
      },
      "d": {
        "explanation": "Almost! But look carefully - one has x² (x squared) and one has just x.",
        "reteach": "The variable parts must match EXACTLY. x² means x·x, which is different from just x. Think of it like this: x² is area (square units) while x is length (linear units) - they're fundamentally different.",
        "hint": "Check the exponents - are they the same?"
      },
      "default": {
        "explanation": "That's not one of the options. Let's try again.",
        "reteach": "Remember: like terms have the exact same variable parts. Look for two terms where the letters (and any exponents) are identical."
      }
    }
  },
  "adaptation_rules": {
    "on_correct_first_attempt": "apply_step",
    "on_incorrect_first_attempt": "reteach_and_retry",
    "on_incorrect_second_attempt": "tutor_intervention",
    "on_correct_after_reteach": "next_concept"
  }
}
Metadata for Check Steps:
{
  "estimated_seconds": 45,
  "difficulty": 1,
  "concept_tags": ["algebra", "like-terms", "understanding-check"]
}

Step Type: apply
Purpose: Once basic understanding is demonstrated, learner applies the concept in a deeper way (word problem, comparison, explanation, etc.).
Content Schema:
interface ApplyStepContent {
  question: string;
  type: 'word_problem' | 'multi_step' | 'explanation' | 'comparison' | 'real_world_scenario';
  
  // For structured questions
  correct_answer?: string | string[];
  
  // For open-ended questions
  rubric?: {
    criteria: Array<{
      requirement: string;
      points: number;
      examples: {
        excellent: string;
        acceptable: string;
        needs_work: string;
      };
    }>;
  };
  
  // Feedback
  feedback: {
    on_correct: {
      confirmation: string;
      extension?: string; // Optional: "Here's a related challenge..."
    };
    on_incorrect: {
      guidance: string;
      hint: string;
      simplify?: string; // Simpler version of the question
    };
  };
  
  // Adaptation
  adaptation_rules: {
    on_correct: 'next_concept' | 'mastery_achieved';
    on_incorrect: 'provide_hint' | 'tutor_intervention';
  };
}
Authoring Rules:
	1	Requires Reasoning: Can't be answered by simple recall
	2	Builds on Check: Assumes check step was passed
	3	Slightly Harder: Should take more thought than check question
	4	Real Context: When possible, use realistic scenarios
	5	Clear Success Criteria: Rubric must be unambiguous
Example:
{
  "question": "Maria is organizing her math homework. She has these terms: 3x, 5y, 7x, 2y, and 4x. She wants to group all the like terms together. Which terms should she put in each group?",
  "type": "word_problem",
  "correct_answer": "Group 1: 3x, 7x, 4x | Group 2: 5y, 2y",
  "rubric": {
    "criteria": [
      {
        "requirement": "Correctly identifies all x terms as one group",
        "points": 1,
        "examples": {
          "excellent": "3x, 7x, and 4x are like terms",
          "acceptable": "The x's go together",
          "needs_work": "3x and 5y are like terms"
        }
      },
      {
        "requirement": "Correctly identifies all y terms as another group",
        "points": 1,
        "examples": {
          "excellent": "5y and 2y are like terms",
          "acceptable": "The y's are separate",
          "needs_work": "Doesn't separate y terms"
        }
      }
    ]
  },
  "feedback": {
    "on_correct": {
      "confirmation": "Perfect! You correctly grouped all the like terms.",
      "extension": "Now you're ready to learn how to combine like terms by adding their coefficients!"
    },
    "on_incorrect": {
      "guidance": "Remember: like terms have the exact same variable part. Look at each term and identify which variable it has.",
      "hint": "Start by circling all the terms with 'x', then circle all the terms with 'y' in a different color.",
      "simplify": "Which terms in this list are like terms: 3x, 5x, 2y?"
    }
  },
  "adaptation_rules": {
    "on_correct": "next_concept",
    "on_incorrect": "provide_hint"
  }
}
Metadata for Apply Steps:
{
  "estimated_seconds": 90,
  "difficulty": 2,
  "concept_tags": ["algebra", "like-terms", "application"]
}

Session Engine Logic
State Machine
A lesson session progresses through these states:
INITIALIZED → TEACHING → CHECKING → ADAPTING → [APPLYING] → COMPLETE
                  ↑          ↓
                  └─ RETEACHING ←┘
                       ↓
                  TUTOR_INTERVENTION
State Definitions:
	•	INITIALIZED: Session created, no steps completed yet
	•	TEACHING: Displaying a teach step to learner
	•	CHECKING: Displaying a check step, awaiting response
	•	ADAPTING: Internal state - evaluating response and deciding next action
	•	RETEACHING: Showing teach step again (possibly with variation) after incorrect response
	•	APPLYING: Displaying apply step after demonstrated understanding
	•	TUTOR_INTERVENTION: AI tutor has been triggered to help
	•	COMPLETE: All micro-concepts mastered
Session Initialization
INPUT: user_id, lesson_id
PROCESS:
  1. Check if active session exists for this user+lesson
     - If yes and status='in_progress': RESUME
     - If yes and status='completed': START_NEW (or show completion)
     - If no: CREATE_NEW
  
  2. For RESUME:
     - Load current_step_id from lesson_sessions
     - Load all learner_step_progress for this session
     - Return current step
  
  3. For CREATE_NEW:
     - Insert record into lesson_sessions with status='in_progress'
     - Load first step (order_index = 0)
     - Return first step

OUTPUT: {
  session_id,
  step: <step_object>,
  progress: {
    current_step: X,
    total_steps: Y,
    percent_complete: Z
  }
}
Response Processing
INPUT: session_id, step_id, user_answer
PROCESS:
  1. Validate session and step
  
  2. Record attempt in learner_step_progress:
     - Increment attempt_count
     - Append to responses array
     - Calculate confidence_level (based on time taken, if available)
  
  3. Evaluate response based on step_type:
  
     IF step_type = 'teach':
       - No evaluation needed
       - Mark as complete
       - Return next step (should be associated check step)
     
     IF step_type = 'check':
       - Determine correctness
       - Select appropriate feedback from content.feedback
       - Execute adaptation logic:
         
         IF correct on first attempt:
           - Mark step as complete
           - DECISION: next_concept or apply_step (per adaptation_rules)
         
         IF incorrect on first attempt:
           - Keep step incomplete
           - DECISION: reteach_and_retry or show_hint
           - IF reteach_and_retry:
               - Return associated teach step (same micro_concept_id)
           - IF show_hint:
               - Return same check step with hint enabled
         
         IF incorrect on second attempt:
           - DECISION: tutor_intervention or skip_with_flag
           - IF tutor_intervention:
               - Generate tutor context
               - Trigger AI tutor
           - IF skip_with_flag:
               - Mark as incomplete but allow progression
               - Flag for review
         
         IF correct after reteach:
           - Mark step as complete
           - DECISION: next_concept or apply_step
     
     IF step_type = 'apply':
       - Evaluate against rubric or correct_answer
       - Provide feedback
       - DECISION: next_concept or provide_hint or tutor_intervention
  
  4. Update lesson_sessions:
     - Set current_step_id to next step
     - Update last_active_at
     - IF all steps complete: set status='completed', completed_at=NOW()
  
  5. Return response

OUTPUT: {
  feedback: <feedback_object>,
  is_correct: boolean,
  next_step: <next_step_object> | null,
  tutor_needed: boolean,
  tutor_context?: <context_object>,
  session_complete: boolean
}
Adaptation Decision Trees
After Check Step - Correct First Attempt:
Is this the last check in the concept?
  YES → Has apply step?
    YES → Show apply step
    NO → Advance to next concept
  NO → Advance to next check in same concept
After Check Step - Incorrect First Attempt:
Load adaptation_rules.on_incorrect_first_attempt
  IF 'reteach_and_retry':
    - Find associated teach step (same micro_concept_id)
    - Mark step as "reteaching" mode
    - Show teach step
    - After teach, show same check question again
  
  IF 'show_hint':
    - Return same check step
    - Include hint from feedback
    - Don't count as new attempt
After Check Step - Incorrect Second Attempt:
Load adaptation_rules.on_incorrect_second_attempt
  IF 'tutor_intervention':
    - Generate context: {
        concept: <concept_name>,
        attempts: [<response_1>, <response_2>],
        misconceptions: [<detected_misconceptions>],
        teach_content: <original_teach_text>
      }
    - Trigger AI tutor
    - After tutor session, return to check step
  
  IF 'simplify':
    - Show simpler version of question (if available)
    - OR show teach step with more basic example
  
  IF 'skip_with_flag':
    - Mark step as incomplete but not blocking
    - Allow progression to next concept
    - Flag for educator review
    - Add to learner's "needs_review" list
After Apply Step - Incorrect:
Load adaptation_rules.on_incorrect
  IF 'provide_hint':
    - Show hint from feedback
    - Allow retry
  
  IF 'tutor_intervention':
    - Similar to check step intervention
Mastery Determination
A micro-concept is considered "mastered" when:
	1	Teach step viewed
	2	Check step answered correctly (within 2 attempts)
	3	Apply step answered correctly (if present)
A lesson is considered "complete" when:
	•	All micro-concepts are mastered
	•	ALL steps have is_complete = TRUE in learner_step_progress
Session Interruption & Resumption
When learner closes app:
  - No action needed (state persisted in DB)

When learner returns:
  - Load most recent incomplete step
  - Check last_active_at timestamp
  - IF > 7 days ago: offer "quick review" before resuming
  - Otherwise: resume exactly where left off

Content Authoring Process
Step 1: Lesson Planning
Before writing any content:
	1	Define the ultimate learning objective
	◦	"By the end, learner will be able to..."
	◦	Must be specific and measurable
	2	List prerequisite knowledge
	◦	What must they already know?
	◦	Link to prerequisite lessons if needed
	3	Decompose into atomic concepts
	◦	Each concept = one clear idea
	◦	Draw dependency graph
Example:
Lesson: One-Step Addition Equations

Ultimate Objective: Solve equations like x + 5 = 12

Prerequisites:
  - Understanding of variables
  - Addition/subtraction facts
  - Concept of equality

Atomic Concepts:
  1. What an equation is (two expressions with = sign)
  2. The equals sign means "balanced" (same on both sides)
  3. Inverse operations (addition ↔ subtraction)
  4. Using inverse operations to isolate the variable
  5. Checking your solution by substitution

Dependency Graph:
  1 → 2 → 3 → 4 → 5
Step 2: Authoring Each Micro-Concept
For each atomic concept, create the 3-step sequence:
	1	Write the TEACH step (3-6 sentences + example)
	2	Write the CHECK step (question + 4 options + feedback for each)
	3	Write the APPLY step (deeper question + rubric)
Quality Checklist for TEACH:
	•	[ ] Exactly one concept explained
	•	[ ] 3-6 sentences (no more, no less)
	•	[ ] One concrete example included
	•	[ ] No unexplained prerequisites
	•	[ ] Conversational, not academic tone
	•	[ ] Visual aid considered (if helpful)
Quality Checklist for CHECK:
	•	[ ] Question directly tests what was just taught
	•	[ ] 4 options (multiple choice) or clear answer format
	•	[ ] Correct answer is unambiguous
	•	[ ] Each wrong answer reveals a specific misconception
	•	[ ] Feedback for each option is instructional, not judgmental
	•	[ ] Reteach content uses different wording/example than teach step
	•	[ ] Hints are helpful without giving away the answer
	•	[ ] Adaptation rules specified
Quality Checklist for APPLY:
	•	[ ] Requires reasoning, not just recall
	•	[ ] Slightly harder than check question
	•	[ ] Uses realistic or relatable context
	•	[ ] Rubric is clear and objective
	•	[ ] Feedback helps learner improve
	•	[ ] Success criteria are unambiguous
Step 3: Quality Review
Before marking content as "ready":
	1	Self-test: Can you answer apply step without looking at teach step?
	2	Clarity test: Would a learner understand with zero prior context?
	3	Misconception test: Do wrong answers actually reveal different thinking errors?
	4	Flow test: Does each step naturally lead to the next?
	5	Time test: Can this be completed in the estimated time?
Step 4: Content Transformation (for Open Source Material)
When converting existing lesson content:
Phase 1: Decomposition
INPUT: Existing lesson markdown/text
PROCESS:
  1. Read through entire lesson
  2. Identify distinct concepts (usually 3-8 per lesson)
  3. For each concept, extract:
     - Core explanation
     - Examples
     - Common mistakes mentioned
  4. Order concepts by dependency
OUTPUT: List of atomic concepts with explanations
Phase 2: Generation (LLM-Assisted)
For each concept:
  1. Use Claude API to generate teach step
     Prompt: "Convert this explanation into a 3-6 sentence teach step with one concrete example: <content>"
  
  2. Use Claude API to generate check step
     Prompt: "Create a multiple choice question that tests understanding of: <concept>. Include 4 options with diagnostic wrong answers."
  
  3. Use Claude API to generate feedback
     Prompt: "For each wrong answer, explain the misconception and provide a reteach explanation."
  
  4. Use Claude API to generate apply step
     Prompt: "Create a word problem that requires applying: <concept>. Include rubric."
Phase 3: Human Review (CRITICAL)
For each generated step:
  1. Verify technical accuracy
  2. Check that feedback actually addresses misconceptions
  3. Ensure questions are fair and answerable
  4. Test with real learners (even 1-2 people)
  5. Refine based on feedback
Quality Control Gates:
	•	[ ] All steps reviewed by subject matter expert
	•	[ ] Questions tested with at least 3 learners
	•	[ ] Feedback validated (does it actually help?)
	•	[ ] Adaptation rules produce sensible flow
	•	[ ] No broken dependencies

API Specifications
Endpoint: POST /api/sessions/start
Purpose: Initialize or resume a lesson session
Request:
{
  "user_id": 123,
  "lesson_id": 456
}
Response:
{
  "session_id": 789,
  "status": "in_progress",
  "current_step": {
    "id": 1,
    "step_type": "teach",
    "content": {
      "text": "...",
      "example": "..."
    },
    "metadata": {
      "estimated_seconds": 30
    }
  },
  "progress": {
    "current_step_number": 1,
    "total_steps": 15,
    "percent_complete": 6.7,
    "concepts_mastered": 0,
    "total_concepts": 5
  }
}
Error Codes:
	•	404 - Lesson not found
	•	401 - User not authenticated
	•	409 - Session already completed (return completion data)

Endpoint: POST /api/sessions/{session_id}/respond
Purpose: Submit a learner response to a step
Request:
{
  "step_id": 1,
  "answer": "b",
  "time_taken_seconds": 12.5,
  "confidence": "high"  // Optional: 'low' | 'medium' | 'high'
}
Response (Correct Answer):
{
  "is_correct": true,
  "feedback": {
    "confirmation": "Exactly right!",
    "reinforcement": "Both terms have the variable 'a', which is what makes them like terms."
  },
  "next_step": {
    "id": 3,
    "step_type": "apply",
    "content": { /* apply step content */ }
  },
  "progress": {
    "current_step_number": 3,
    "total_steps": 15,
    "percent_complete": 20
  }
}
Response (Incorrect Answer - First Attempt):
{
  "is_correct": false,
  "feedback": {
    "explanation": "Not quite. Even though both have 4 as the coefficient...",
    "reteach": "Remember: like terms must have the SAME variable part...",
    "hint": "Look at the variables (letters), not the numbers."
  },
  "next_step": {
    "id": 0,  // Returns to teach step
    "step_type": "teach",
    "mode": "reteaching",
    "content": { /* original or variation teach content */ }
  },
  "progress": { /* unchanged */ }
}
Response (Incorrect Answer - Second Attempt - Tutor Needed):
{
  "is_correct": false,
  "tutor_needed": true,
  "tutor_context": {
    "concept": "Like Terms",
    "attempts": [
      {"answer": "a", "misconception": "Thinks same coefficient makes terms like"},
      {"answer": "c", "misconception": "Doesn't distinguish constants from variables"}
    ],
    "teach_content": "In algebra, 'like terms' have the exact same variable parts...",
    "suggested_prompt": "It looks like you're having trouble identifying like terms. Let's work through this together..."
  },
  "progress": { /* unchanged */ }
}
Error Codes:
	•	404 - Session or step not found
	•	400 - Invalid answer format
	•	409 - Step already completed

Endpoint: GET /api/sessions/{session_id}/status
Purpose: Get current session state (for resumption, progress tracking)
Response:
{
  "session_id": 789,
  "user_id": 123,
  "lesson_id": 456,
  "status": "in_progress",
  "started_at": "2026-01-28T10:00:00Z",
  "last_active_at": "2026-01-28T10:15:00Z",
  "current_step_id": 7,
  "progress": {
    "steps_completed": 6,
    "steps_total": 15,
    "concepts_mastered": 2,
    "concepts_total": 5,
    "time_spent_seconds": 900
  }
}

Endpoint: POST /api/sessions/{session_id}/complete
Purpose: Mark session as complete (called automatically when last step is mastered)
Response:
{
  "session_id": 789,
  "status": "completed",
  "completed_at": "2026-01-28T10:30:00Z",
  "summary": {
    "total_time_seconds": 1800,
    "concepts_mastered": 5,
    "total_attempts": 18,
    "accuracy_rate": 0.83,
    "tutor_interventions": 1
  },
  "next_lesson_id": 457  // Optional: suggested next lesson
}

Endpoint: POST /api/tutor/intervene
Purpose: Invoke AI tutor for personalized help
Request:
{
  "session_id": 789,
  "step_id": 2,
  "context": {
    "concept": "Like Terms",
    "attempts": [...],
    "teach_content": "..."
  },
  "user_message": "I don't understand why 3x and 3y aren't like terms"
}
Response:
{
  "tutor_message": "Great question! Let me explain it this way. Think of the variable as the 'type' of thing you're counting...",
  "suggested_next_step": "reattempt_check",  // or "show_simpler_example", "move_on"
  "next_step": {
    "id": 2,
    "step_type": "check",
    "content": { /* same check step */ }
  }
}

Edge Cases & Error Handling
Edge Case 1: Persistent Struggle (3+ Incorrect Attempts)
Scenario: Learner fails check question 3 times in a row
Handling:
	1	Trigger AI tutor intervention (mandatory)
	2	Tutor provides personalized explanation
	3	After tutor session, offer:
	◦	Option A: Try the question again
	◦	Option B: Mark concept as "needs review" and move on
	◦	Option C: Switch to simpler prerequisite lesson
	4	If learner chooses B, flag the concept for educator follow-up
	5	Track this in analytics as "struggled_concept"
Implementation:
IF attempt_count >= 3 AND is_correct = FALSE:
  SET tutor_intervention = TRUE
  GENERATE tutor_context
  AFTER tutor session:
    SHOW choices: ["Try Again", "Mark for Review", "Go Back to Basics"]

Edge Case 2: Early Mastery (Streak of Perfects)
Scenario: Learner answers every question correctly on first attempt with high confidence
Handling:
	1	After 3 consecutive perfect responses, offer:
	◦	"You're doing great! Would you like to skip ahead?"
	2	If accepted:
	◦	Jump to next major concept (skip intermediate steps)
	◦	Or offer "challenge mode" with harder apply questions
	3	Track as "accelerated_learner" in analytics
Implementation:
IF consecutive_correct >= 3 AND confidence = 'high':
  OFFER skip_ahead option
  IF accepted:
    JUMP to next major concept (next micro_concept_id divisible by 5)

Edge Case 3: Session Abandonment
Scenario: Learner closes app mid-session and doesn't return for 7+ days
Handling:
	1	Send reminder notification at 24 hours
	2	At 7 days, mark session as "at_risk"
	3	On next return:
	◦	Show: "Welcome back! It's been a while. Would you like to:"
	▪	A) Quick review before continuing
	▪	B) Continue where you left off
	▪	C) Start this lesson over
	4	If "quick review" selected:
	◦	Show summary of concepts already covered
	◦	Show one practice question per mastered concept
	◦	Then resume
Implementation:
IF last_active_at < NOW() - INTERVAL '7 days':
  ON next_login:
    SHOW review_options
    IF 'quick_review':
      GENERATE review_questions from completed concepts

Edge Case 4: Incorrect Step Dependencies
Scenario: Learner somehow reaches a step that depends on an uncompleted step (data corruption or logic error)
Handling:
	1	Detect: Check dependencies array before showing step
	2	If any dependency is incomplete:
	◦	Log error to monitoring system
	◦	Automatically redirect to first incomplete dependency
	◦	Show message: "Let's make sure we've covered everything first."
	3	Prevent progression until dependencies satisfied
Implementation:
BEFORE showing step:
  FOR EACH dep_id IN step.dependencies:
    IF learner_step_progress[dep_id].is_complete = FALSE:
      LOG ERROR
      RETURN dependency_step

Edge Case 5: Content Version Changes
Scenario: Lesson content is updated while learner has active session
Handling:
	1	Sessions are tied to format_version in lessons table
	2	If content updated (format_version incremented):
	◦	Active sessions continue with old version
	◦	New sessions use new version
	3	After session completes, offer:
	◦	"This lesson has been updated! Would you like to see what's new?"
Implementation:
lesson_sessions.content_version = lesson.format_version AT session start
ALWAYS use content_version from session, not current lesson version

Edge Case 6: Ambiguous Short Answers
Scenario: Learner enters a short answer that's technically correct but not in expected format
Handling:
	1	For short answer questions, always include validation_rules.acceptable_variations
	2	Use fuzzy matching (Levenshtein distance < 2)
	3	If answer is close but not exact:
	◦	Mark as correct
	◦	Show gentle feedback: "Correct! (We'd usually write this as '8 apples', but your answer works too!)"
	4	Log variations for content improvement

Edge Case 7: Network Interruption Mid-Response
Scenario: Network drops while learner is submitting answer
Handling:
	1	Client implements optimistic UI (show feedback immediately)
	2	Queue response for retry with exponential backoff
	3	If retry fails after 3 attempts:
	◦	Save response locally
	◦	Show: "Connection lost. Your answer is saved and will be submitted when you're back online."
	4	On reconnect, sync queued responses
	5	Prevent duplicate submissions with idempotency key

Edge Case 8: Apply Step - Subjective Grading
Scenario: Apply step requires open-ended explanation that can't be auto-graded
Handling:
	1	Option A: Use LLM to evaluate against rubric
	◦	Send answer + rubric to Claude API
	◦	Get scored response
	◦	Show feedback
	2	Option B: Flag for human review
	◦	Mark as "pending_review"
	◦	Allow progression (don't block)
	◦	Educator reviews later
	3	Always show learner: "Here's what we're looking for: [rubric]"
Implementation:
IF apply_step.type = 'explanation':
  TRY llm_grading:
    SEND to Claude API with rubric
    PARSE response
  CATCH:
    FALLBACK to human_review_queue

Success Metrics
Learning Effectiveness Metrics
Primary Metric: Mastery Rate
	•	Definition: % of concepts marked as mastered (vs. flagged for review)
	•	Target: >85%
	•	Measured at: Lesson completion
Secondary Metrics:
	1	First-Attempt Accuracy
	◦	% of check questions answered correctly on first try
	◦	Target: >70%
	◦	Indicates teaching quality
	2	Reteach Effectiveness
	◦	% of learners who succeed after reteaching
	◦	Target: >80%
	◦	Indicates feedback quality
	3	Tutor Intervention Rate
	◦	% of sessions requiring AI tutor
	◦	Target: <20%
	◦	Indicates content difficulty calibration
	4	Session Completion Rate
	◦	% of started sessions that reach completion
	◦	Target: >75%
	◦	Indicates engagement
	5	Time to Mastery
	◦	Average time per concept vs. estimated time
	◦	Target: Within 20% of estimate
	◦	Indicates pacing accuracy
Engagement Metrics
	1	Active Learning Time
	◦	Time spent on teach/check/apply steps (excluding idle time)
	◦	Target: >80% of session time
	2	Return Rate
	◦	% of learners who return within 48 hours
	◦	Target: >60%
	3	Confidence Distribution
	◦	Distribution of learner confidence levels
	◦	Target: Shift toward "high" over time
Content Quality Metrics
	1	Question Clarity Score
	◦	% of check questions answered without requesting hint
	◦	Target: >80%
	2	Misconception Coverage
	◦	% of wrong answers that match a predicted misconception
	◦	Target: >90%
	◦	Indicates quality of wrong answer design
	3	Feedback Helpfulness
	◦	Implicit: Do learners succeed after seeing feedback?
	◦	Target: >80% success on retry
Data to Capture (learner_step_progress)
{
  "step_id": 123,
  "responses": [
    {
      "answer": "b",
      "is_correct": false,
      "time_taken_seconds": 15.2,
      "confidence": "medium",
      "hint_requested": false,
      "timestamp": "2026-01-28T10:05:00Z"
    },
    {
      "answer": "a",
      "is_correct": true,
      "time_taken_seconds": 8.1,
      "confidence": "high",
      "hint_requested": false,
      "timestamp": "2026-01-28T10:07:00Z"
    }
  ]
}
A/B Testing Framework
Testable Variables:
	1	Teach step length (3 vs 5 vs 6 sentences)
	2	Number of check options (3 vs 4 vs 5)
	3	Reteach timing (immediate vs after thinking period)
	4	Tutor intervention threshold (2 vs 3 attempts)
	5	Feedback style (formal vs conversational)
Implementation:
	•	Add variant field to lesson_sessions
	•	Randomly assign on session start
	•	Analyze metrics grouped by variant

Implementation Checklist
Phase 1: Foundation (Week 1)
Database:
	•	[ ] Create lessons table with new schema
	•	[ ] Create lesson_steps table with JSONB content
	•	[ ] Create learner_step_progress table
	•	[ ] Create lesson_sessions table
	•	[ ] Add indices for performance
	•	[ ] Write migration scripts
Types & Schemas:
	•	[ ] Define TypeScript interfaces for all step types
	•	[ ] Define API request/response types
	•	[ ] Create JSON schema validators
	•	[ ] Document content schemas

Phase 2: Content (Week 2)
Manual Authoring:
	•	[ ] Choose 3 pilot lessons (easy, medium, hard)
	•	[ ] Manually decompose into micro-concepts
	•	[ ] Author 5 complete teach-check-apply sequences
	•	[ ] Store in database
	•	[ ] Test with 3-5 real learners
	•	[ ] Iterate based on feedback
Transformation Pipeline:
	•	[ ] Build LLM-based transformation script
	•	[ ] Test with 1 sample lesson
	•	[ ] Human review process
	•	[ ] Refine prompts based on output quality
	•	[ ] Document transformation best practices

Phase 3: Session Engine (Week 3)
Core Logic:
	•	[ ] Implement session initialization
	•	[ ] Implement response processing
	•	[ ] Implement adaptation decision trees
	•	[ ] Implement dependency checking
	•	[ ] Implement progress tracking
	•	[ ] Handle edge cases (documented above)
Testing:
	•	[ ] Unit tests for adaptation logic
	•	[ ] Integration tests for session flow
	•	[ ] Edge case tests (abandonment, dependencies, etc.)
	•	[ ] Performance tests (handle 1000 concurrent sessions)

Phase 4: UI Components (Week 4)
Components:
	•	[ ] LessonPlayer container
	•	[ ] TeachStepView component
	•	[ ] CheckStepView component (multiple choice, short answer)
	•	[ ] ApplyStepView component
	•	[ ] FeedbackDisplay component
	•	[ ] ProgressIndicator component
	•	[ ] TutorIntervention modal
Polish:
	•	[ ] Loading states
	•	[ ] Error states
	•	[ ] Animations (step transitions)
	•	[ ] Responsive design
	•	[ ] Accessibility (WCAG AA)

Phase 5: AI Tutor Integration (Week 5)
Implementation:
	•	[ ] Design tutor prompt templates
	•	[ ] Implement Claude API integration
	•	[ ] Build tutor context generation
	•	[ ] Create tutor UI/UX
	•	[ ] Test with real struggling learners
	•	[ ] Implement fallback for API failures

Phase 6: Analytics & Monitoring (Week 6)
Instrumentation:
	•	[ ] Event tracking for all learner actions
	•	[ ] Performance monitoring (API latency, DB queries)
	•	[ ] Error logging and alerting
	•	[ ] Dashboard for content quality metrics
	•	[ ] Dashboard for learner progress

Phase 7: Scale & Polish (Week 7+)
Content:
	•	[ ] Transform remaining open source content
	•	[ ] Quality review all transformed content
	•	[ ] Build content authoring tools for educators
	•	[ ] Create content style guide
Performance:
	•	[ ] Database query optimization
	•	[ ] Caching strategy (Redis for active sessions)
	•	[ ] CDN for visual assets
	•	[ ] Lazy loading of step content
Features:
	•	[ ] Session resumption across devices
	•	[ ] Offline mode support
	•	[ ] Parent/teacher dashboards
	•	[ ] Adaptive difficulty adjustment

Appendix: Example Complete Lesson
Lesson: Like Terms in Algebra
Metadata:
{
  "id": 101,
  "title": "Like Terms in Algebra",
  "subject": "Mathematics",
  "grade_level": 7,
  "learning_objectives": [
    "Identify like terms in algebraic expressions",
    "Explain why terms are or are not 'like'",
    "Group like terms in a collection of terms"
  ],
  "prerequisite_lesson_ids": [98, 99],
  "estimated_duration_minutes": 12
}
Micro-Concept 1: What Makes Terms "Like"
Step 1 (order_index: 0): Teach
{
  "id": 1001,
  "lesson_id": 101,
  "micro_concept_id": 1,
  "step_type": "teach",
  "order_index": 0,
  "content": {
    "text": "In algebra, 'like terms' have the exact same variable parts. For example, 3x and 5x are like terms because they both have 'x'. But 3x and 3y are NOT like terms because the variables are different. The numbers in front (called coefficients) don't matter for determining if terms are 'like' - only the variable part matters.",
    "example": "Think of it like fruit: 3 apples + 5 apples = 8 apples (like terms). But 3 apples + 5 oranges can't be combined into one number (unlike terms).",
    "key_terms": [
      {"term": "like terms", "definition": "Terms with identical variable parts"},
      {"term": "coefficient", "definition": "The number in front of a variable"}
    ]
  },
  "metadata": {
    "estimated_seconds": 30,
    "difficulty": 1
  }
}
Step 2 (order_index: 1): Check
{
  "id": 1002,
  "lesson_id": 101,
  "micro_concept_id": 1,
  "step_type": "check",
  "order_index": 1,
  "dependencies": [1001],
  "content": {
    "question": "Which pair contains like terms?",
    "type": "multiple_choice",
    "options": [
      {
        "id": "a",
        "text": "4x and 4y",
        "is_correct": false,
        "misconception": "Thinks same coefficient makes terms 'like'"
      },
      {
        "id": "b",
        "text": "2a and 7a",
        "is_correct": true
      },
      {
        "id": "c",
        "text": "5 and 5x",
        "is_correct": false,
        "misconception": "Doesn't distinguish constants from variables"
      },
      {
        "id": "d",
        "text": "3x² and 3x",
        "is_correct": false,
        "misconception": "Doesn't recognize different exponents"
      }
    ],
    "feedback": {
      "on_correct": {
        "confirmation": "Exactly right!",
        "reinforcement": "Both terms have the variable 'a', which is what makes them like terms. The coefficients (2 and 7) being different doesn't matter."
      },
      "on_incorrect": {
        "a": {
          "explanation": "Not quite. Even though both have 4 as the coefficient, one has 'x' and one has 'y'.",
          "reteach": "Remember: like terms must have the SAME variable part. The numbers in front can be different, but the letters must match exactly. Here, 'x' and 'y' are different variables.",
          "hint": "Look at the variables (letters), not the numbers."
        },
        "c": {
          "explanation": "Close thinking, but 5 is just a number with no variable, while 5x has the variable x.",
          "reteach": "Terms with no variables (like 5) are called constants. They can only be combined with other constants. Terms with variables (like 5x) can only be combined with terms that have the exact same variable.",
          "hint": "One has a variable, one doesn't - are they really the same type?"
        },
        "d": {
          "explanation": "Almost! But look carefully - one has x² (x squared) and one has just x.",
          "reteach": "The variable parts must match EXACTLY. x² means x·x, which is different from just x. Think of it like this: x² is area (square units) while x is length (linear units) - they're fundamentally different.",
          "hint": "Check the exponents - are they the same?"
        },
        "default": {
          "explanation": "Let's try again.",
          "reteach": "Remember: like terms have the exact same variable parts. Look for two terms where the letters (and any exponents) are identical."
        }
      }
    },
    "adaptation_rules": {
      "on_correct_first_attempt": "apply_step",
      "on_incorrect_first_attempt": "reteach_and_retry",
      "on_incorrect_second_attempt": "tutor_intervention",
      "on_correct_after_reteach": "apply_step"
    }
  },
  "metadata": {
    "estimated_seconds": 45,
    "difficulty": 1
  }
}
Step 3 (order_index: 2): Apply
{
  "id": 1003,
  "lesson_id": 101,
  "micro_concept_id": 1,
  "step_type": "apply",
  "order_index": 2,
  "dependencies": [1002],
  "content": {
    "question": "Maria is organizing her math homework. She has these terms: 3x, 5y, 7x, 2y, and 4x. She wants to group all the like terms together. Which terms should she put in each group?",
    "type": "word_problem",
    "correct_answer": "Group 1: 3x, 7x, 4x | Group 2: 5y, 2y",
    "rubric": {
      "criteria": [
        {
          "requirement": "Correctly identifies all x terms as one group",
          "points": 1,
          "examples": {
            "excellent": "3x, 7x, and 4x are like terms",
            "acceptable": "The x's go together",
            "needs_work": "3x and 5y are like terms"
          }
        },
        {
          "requirement": "Correctly identifies all y terms as another group",
          "points": 1,
          "examples": {
            "excellent": "5y and 2y are like terms",
            "acceptable": "The y's are separate",
            "needs_work": "Doesn't separate y terms"
          }
        }
      ]
    },
    "feedback": {
      "on_correct": {
        "confirmation": "Perfect! You correctly grouped all the like terms.",
        "extension": "Now you're ready to learn how to combine like terms by adding their coefficients!"
      },
      "on_incorrect": {
        "guidance": "Remember: like terms have the exact same variable part. Look at each term and identify which variable it has.",
        "hint": "Start by circling all the terms with 'x', then circle all the terms with 'y' in a different color.",
        "simplify": "Which terms in this list are like terms: 3x, 5x, 2y?"
      }
    },
    "adaptation_rules": {
      "on_correct": "next_concept",
      "on_incorrect": "provide_hint"
    }
  },
  "metadata": {
    "estimated_seconds": 90,
    "difficulty": 2
  }
}

Document Version History
	•	v1.0 (Jan 2026): Initial comprehensive specification
	•	Future versions will document changes and rationales

Notes for AI Coding Assistants
When implementing this system:
	1	Follow the schemas exactly - Don't improvise or "improve" the data structures
	2	Implement all edge cases - They're documented for a reason
	3	Validate inputs rigorously - Bad data will break the learning experience
	4	Test with real learners early - Simulated testing won't reveal UX issues
	5	Prioritize correctness over speed - A slower but accurate system is better than a fast but buggy one
	6	Log extensively - You'll need data to debug and improve
	7	Ask for clarification - If anything is ambiguous, ask before implementing
This is educational software. Quality and reliability are paramount.
