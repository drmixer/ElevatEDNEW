-- 002_seed_content.sql
-- Seed baseline plans, adaptive levels, subjects, topics, lessons, and lesson steps.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_topic_title_key'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_topic_title_key unique (topic_id, title);
  end if;
end;
$$;

insert into public.plans (slug, name, price_cents, status, metadata)
values
  ('family-free', 'Family Free', 0, 'active', jsonb_build_object('lesson_limit', 10)),
  ('family-plus', 'Family Plus', 2999, 'active', jsonb_build_object('lesson_limit', 100)),
  ('family-premium', 'Family Premium', 4999, 'active', jsonb_build_object('lesson_limit', 'unlimited'))
on conflict (slug) do nothing;

insert into public.adaptive_levels (name, criteria_json)
values
  ('Foundational', jsonb_build_object('target_mastery', 40)),
  ('Intermediate', jsonb_build_object('target_mastery', 70)),
  ('Advanced', jsonb_build_object('target_mastery', 90))
on conflict (name) do nothing;

insert into public.subjects (name, description)
values
  ('Mathematics', 'Numeracy foundations through advanced problem solving.'),
  ('English Language Arts', 'Reading comprehension, writing, and language skills.'),
  ('Science', 'Core scientific inquiry and experimentation.')
on conflict (name) do nothing;

with math as (
  select id from public.subjects where name = 'Mathematics'
),
ela as (
  select id from public.subjects where name = 'English Language Arts'
)
insert into public.topics (subject_id, name, description, difficulty_level)
values
  ((select id from math), 'Linear Equations', 'Intro to solving one-variable linear equations.', 2),
  ((select id from math), 'Fractions & Decimals', 'Compare, convert, and operate with fractions and decimals.', 1),
  ((select id from ela), 'Informational Texts', 'Analyze structure and key ideas in informational passages.', 2)
on conflict (subject_id, name) do nothing;

with
  linear_topic as (
    select id from public.topics where name = 'Linear Equations'
  ),
  fractions_topic as (
    select id from public.topics where name = 'Fractions & Decimals'
  ),
  info_topic as (
    select id from public.topics where name = 'Informational Texts'
  )
insert into public.lessons (
  topic_id,
  title,
  content,
  media_url,
  estimated_duration_minutes,
  ai_hint_context,
  is_published
)
values
  (
    (select id from linear_topic),
    'Solving One-Step Equations',
    '# Goal\nSolve one-step equations using inverse operations.\n\n## Example\nSolve `x + 5 = 12`.\nSubtract 5 from both sides to find `x = 7`.',
    null,
    20,
    jsonb_build_object('strategies', array['Check inverse operations', 'Balance both sides']),
    true
  ),
  (
    (select id from fractions_topic),
    'Comparing Fractions',
    '# Objective\nCompare fractions with unlike denominators.\n\nUse visual models or find common denominators to determine which fraction is greater.',
    null,
    15,
    jsonb_build_object('tips', array['Find equivalent fractions', 'Use number lines']),
    true
  ),
  (
    (select id from info_topic),
    'Identifying Main Idea',
    '# Purpose\nIdentify the main idea and supporting details in informational texts.\n\nPractice locating topic sentences and summarizing key ideas in your own words.',
    null,
    25,
    jsonb_build_object('focus', array['Topic sentence', 'Supporting details']),
    true
  )
on conflict (topic_id, title) do nothing;

with
  one_step_lesson as (
    select id from public.lessons where title = 'Solving One-Step Equations'
  ),
  comparing_fractions_lesson as (
    select id from public.lessons where title = 'Comparing Fractions'
  ),
  main_idea_lesson as (
    select id from public.lessons where title = 'Identifying Main Idea'
  )
insert into public.lesson_steps (lesson_id, step_number, prompt_text, expected_answer)
values
  (
    (select id from one_step_lesson),
    1,
    'Identify the operation applied to the variable in `x + 9 = 15`.',
    jsonb_build_object('operation', 'addition')
  ),
  (
    (select id from one_step_lesson),
    2,
    'Solve for `x` in `x + 9 = 15`.',
    jsonb_build_object('answer', 6)
  ),
  (
    (select id from comparing_fractions_lesson),
    1,
    'Convert `1/2` and `3/4` to fractions with a common denominator.',
    jsonb_build_object('converted', array['2/4', '3/4'])
  ),
  (
    (select id from comparing_fractions_lesson),
    2,
    'Which fraction is greater: `2/4` or `3/4`?',
    jsonb_build_object('answer', '3/4')
  ),
  (
    (select id from main_idea_lesson),
    1,
    'After reading the passage, state the main idea in one sentence.',
    jsonb_build_object('rubric', 'Mentions topic and overarching message')
  ),
  (
    (select id from main_idea_lesson),
    2,
    'List two supporting details that back up the main idea.',
    jsonb_build_object('expected_count', 2)
  )
on conflict (lesson_id, step_number) do nothing;

commit;
