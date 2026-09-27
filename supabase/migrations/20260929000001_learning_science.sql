-- Learning-science extras for lessons: a pretest the student guesses on
-- before the explanation, a free-recall prompt shown before the summary,
-- and the key points the recall is compared against.
alter table public.lesson_modules
  add column if not exists learning jsonb;

-- Confidence rating on attempts (sure / think / guess) for calibration and
-- the hypercorrection effect.
alter table public.question_attempts
  add column if not exists confidence text check (confidence in ('sure', 'think', 'guess'));
