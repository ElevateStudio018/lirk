-- =============================================================================
-- Lirk V1 – initial schema
--
-- Principles
--   * Every table carries user_id (defaults to auth.uid()) so RLS stays simple
--     and fast: a user can only ever see rows where user_id = auth.uid().
--   * Inserts/updates additionally verify that the parent row (project, lesson,
--     mock exam, attempt) belongs to the same user. RLS on the parent table
--     makes the EXISTS sub-select only see the caller's own rows.
--   * JSONB columns hold AI-generated structures. They are always validated
--     with zod in the application before they are written.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- study_projects  ("ett prov")
-- -----------------------------------------------------------------------------

create table public.study_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  exam_date date not null,
  target_grade text check (target_grade in ('E', 'D', 'C', 'B', 'A')),
  minutes_per_session integer not null check (minutes_per_session between 5 and 180),
  -- ISO weekday numbers, 1 = Monday … 7 = Sunday
  available_days smallint[] not null default '{1,2,3,4,5}'
    check (array_length(available_days, 1) >= 1 and available_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  status text not null default 'collecting'
    check (status in (
      'collecting',      -- materials are being added
      'analyzing',       -- knowledge map is being generated
      'map_ready',       -- knowledge map exists, diagnostic not done
      'diagnosed',       -- diagnostic done, plan not yet generated
      'studying',        -- plan active
      'mock1_done',      -- first mock exam assessed
      'final_done',      -- final mock assessed
      'archived'
    )),
  map_summary text,
  map_warnings text[] not null default '{}',
  map_generated_at timestamptz,
  has_grading_criteria boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_projects_user_idx on public.study_projects (user_id, exam_date);

create trigger study_projects_updated_at before update on public.study_projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- source_materials
-- -----------------------------------------------------------------------------

create table public.source_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  type text not null check (type in ('pdf', 'image', 'text', 'paste', 'teacher_note')),
  -- What kind of document this is according to the student.
  category text not null default 'other'
    check (category in ('planning', 'criteria', 'notes', 'teacher_said', 'other')),
  filename text,
  mime_type text,
  size_bytes integer,
  storage_path text,
  -- Raw text as it came out of the extractor (or as typed by the student).
  extracted_text text,
  -- Cleaned text used for analysis.
  normalized_text text,
  extraction_method text check (extraction_method in ('pdf-text', 'plain', 'vision', 'user-input')),
  page_count integer,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index source_materials_project_idx on public.source_materials (project_id, created_at);
create index source_materials_user_idx on public.source_materials (user_id);

-- -----------------------------------------------------------------------------
-- knowledge_topics
-- -----------------------------------------------------------------------------

create table public.knowledge_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  parent_id uuid references public.knowledge_topics (id) on delete set null,
  key text not null,
  title text not null,
  description text not null default '',
  importance smallint not null check (importance between 1 and 5),
  difficulty smallint not null check (difficulty between 1 and 5),
  evidence_type text not null check (evidence_type in ('explicit', 'inferred')),
  inference_reason text,
  -- [{ source_material_id, quote, verified }]
  evidence jsonb not null default '[]'::jsonb,
  prerequisite_ids uuid[] not null default '{}',
  required_skills text[] not null default '{}',
  likely_question_types text[] not null default '{}',
  assessment_dimension text not null
    check (assessment_dimension in ('recall', 'understanding', 'application', 'reasoning', 'analysis', 'problem_solving')),
  -- Derived from question_attempts by the mastery model (null = no data yet).
  mastery real check (mastery between 0 and 1),
  confidence real not null default 0 check (confidence between 0 and 1),
  performance_pattern text not null default 'insufficient_evidence'
    check (performance_pattern in ('consistent_success', 'consistent_failure', 'mixed', 'insufficient_evidence')),
  last_practiced_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create index knowledge_topics_project_idx on public.knowledge_topics (project_id, sort_order);
create index knowledge_topics_parent_idx on public.knowledge_topics (parent_id);

-- -----------------------------------------------------------------------------
-- diagnostic_questions
-- -----------------------------------------------------------------------------

create table public.diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  topic_id uuid not null references public.knowledge_topics (id) on delete cascade,
  position integer not null,
  -- Full question incl. answer key, validated by the Question zod schema.
  question jsonb not null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index diagnostic_questions_project_idx on public.diagnostic_questions (project_id, position);
create index diagnostic_questions_topic_idx on public.diagnostic_questions (topic_id);

-- -----------------------------------------------------------------------------
-- study_plans / study_sessions
-- -----------------------------------------------------------------------------

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  version integer not null default 1,
  is_active boolean not null default true,
  -- Why the plan looks the way it does (priorities per topic etc.)
  rationale jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index study_plans_one_active_idx on public.study_plans (project_id) where is_active;
create index study_plans_project_idx on public.study_plans (project_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  position integer not null,
  scheduled_date date not null,
  kind text not null check (kind in ('learn', 'review', 'mock1', 'remediation_final')),
  title text not null,
  goal text not null,
  estimated_minutes integer not null,
  topic_ids uuid[] not null default '{}',
  -- Planned activities: [{ kind, topic_id, minutes, ... }]
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  current_step integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index study_sessions_plan_idx on public.study_sessions (plan_id, position);
create index study_sessions_project_idx on public.study_sessions (project_id, scheduled_date);

-- -----------------------------------------------------------------------------
-- lesson_modules / lesson_scenes
-- -----------------------------------------------------------------------------

create table public.lesson_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  topic_id uuid references public.knowledge_topics (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete set null,
  kind text not null default 'lesson' check (kind in ('lesson', 'micro', 'example')),
  title text not null,
  -- Checkpoints: [{ id, after_scene, question, options, correct_index, explanation, misconception_by_option }]
  checkpoints jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('generating', 'ready', 'failed')),
  error_message text,
  watch_progress real not null default 0 check (watch_progress between 0 and 1),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index lesson_modules_project_idx on public.lesson_modules (project_id);
create index lesson_modules_session_idx on public.lesson_modules (session_id);
create index lesson_modules_topic_idx on public.lesson_modules (topic_id);

create table public.lesson_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lesson_modules (id) on delete cascade,
  position integer not null,
  type text not null,
  duration_seconds real not null check (duration_seconds > 0),
  -- The full scene object validated by the Scene zod schema.
  data jsonb not null,
  unique (lesson_id, position)
);

-- -----------------------------------------------------------------------------
-- exercise_sets
-- -----------------------------------------------------------------------------

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  topic_id uuid references public.knowledge_topics (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete set null,
  lesson_id uuid references public.lesson_modules (id) on delete set null,
  purpose text not null default 'practice'
    check (purpose in ('practice', 'review', 'easier', 'harder', 'remediation', 'confirmation')),
  -- Questions incl. answer keys, validated by the Question zod schema.
  items jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index exercise_sets_project_idx on public.exercise_sets (project_id);
create index exercise_sets_session_idx on public.exercise_sets (session_id);

-- -----------------------------------------------------------------------------
-- question_attempts – every answered question, from every source.
-- This is the evidence history the mastery model is computed from.
-- -----------------------------------------------------------------------------

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  topic_id uuid not null references public.knowledge_topics (id) on delete cascade,
  source text not null check (source in ('diagnostic', 'exercise', 'checkpoint', 'mock', 'remediation')),
  source_ref uuid,
  question_id text,
  question_type text not null,
  answer jsonb,
  score real not null check (score between 0 and 1),
  weight real not null default 1 check (weight > 0),
  is_correct boolean not null,
  feedback text,
  error_type text,
  misconception text,
  grading_method text not null check (grading_method in ('deterministic', 'ai')),
  created_at timestamptz not null default now()
);

create index question_attempts_topic_idx on public.question_attempts (topic_id, created_at);
create index question_attempts_project_idx on public.question_attempts (project_id, created_at);
create index question_attempts_source_idx on public.question_attempts (source, source_ref);

-- -----------------------------------------------------------------------------
-- adaptive_decisions – transparent log of every "what next" decision
-- -----------------------------------------------------------------------------

create table public.adaptive_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete cascade,
  topic_id uuid references public.knowledge_topics (id) on delete cascade,
  action text not null
    check (action in ('SKIP', 'CONTINUE', 'REVIEW', 'MICRO_LESSON', 'EASIER_EXAMPLE', 'HARDER_QUESTION')),
  rule text not null,
  reason text not null,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index adaptive_decisions_session_idx on public.adaptive_decisions (session_id, created_at);
create index adaptive_decisions_project_idx on public.adaptive_decisions (project_id);

-- -----------------------------------------------------------------------------
-- mock_exams / mock_exam_questions / exam_attempts / assessment_results
-- -----------------------------------------------------------------------------

create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  kind text not null check (kind in ('mock1', 'final')),
  title text not null,
  instructions text not null default '',
  time_limit_minutes integer not null,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, kind)
);

create table public.mock_exam_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mock_exam_id uuid not null references public.mock_exams (id) on delete cascade,
  topic_id uuid references public.knowledge_topics (id) on delete set null,
  position integer not null,
  points integer not null default 1 check (points between 1 and 20),
  -- Full question incl. answer key and rubric, validated by zod.
  question jsonb not null,
  source_material_ids uuid[] not null default '{}',
  unique (mock_exam_id, position)
);

create index mock_exam_questions_exam_idx on public.mock_exam_questions (mock_exam_id);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  mock_exam_id uuid not null references public.mock_exams (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'assessing', 'assessed', 'assessment_failed')),
  -- { [question_id]: answer }
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  assessed_at timestamptz,
  error_message text
);

create index exam_attempts_exam_idx on public.exam_attempts (mock_exam_id);
create index exam_attempts_project_idx on public.exam_attempts (project_id);
create unique index exam_attempts_one_open_idx on public.exam_attempts (mock_exam_id) where status = 'in_progress';

-- Once submitted, answers are locked forever and status can never return to in_progress.
create or replace function public.lock_submitted_attempt()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'in_progress' then
    if new.answers is distinct from old.answers then
      raise exception 'exam attempt % is locked', old.id using errcode = 'check_violation';
    end if;
    if new.status = 'in_progress' then
      raise exception 'exam attempt % cannot be reopened', old.id using errcode = 'check_violation';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'submitted_at is immutable' using errcode = 'check_violation';
    end if;
  end if;
  if new.status <> 'in_progress' and new.submitted_at is null then
    new.submitted_at = now();
  end if;
  return new;
end;
$$;

create trigger exam_attempts_lock before update on public.exam_attempts
  for each row execute function public.lock_submitted_attempt();

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  attempt_id uuid not null unique references public.exam_attempts (id) on delete cascade,
  -- Validated by the Assessment zod schema.
  overall jsonb not null,
  per_question jsonb not null,
  topic_scores jsonb not null default '{}'::jsonb,
  total_score real not null,
  max_score real not null,
  criteria_available boolean not null,
  created_at timestamptz not null default now()
);

create index assessment_results_project_idx on public.assessment_results (project_id);

create table public.remediation_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  assessment_id uuid not null references public.assessment_results (id) on delete cascade,
  topic_id uuid references public.knowledge_topics (id) on delete set null,
  priority smallint not null,
  title text not null,
  description text not null,
  baseline_mastery real,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index remediation_targets_project_idx on public.remediation_targets (project_id, priority);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.study_projects enable row level security;
alter table public.source_materials enable row level security;
alter table public.knowledge_topics enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_sessions enable row level security;
alter table public.lesson_modules enable row level security;
alter table public.lesson_scenes enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.question_attempts enable row level security;
alter table public.adaptive_decisions enable row level security;
alter table public.mock_exams enable row level security;
alter table public.mock_exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.assessment_results enable row level security;
alter table public.remediation_targets enable row level security;

-- profiles: id is the user id
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- study_projects: root of ownership
create policy "projects_all_own" on public.study_projects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tables whose parent is a study project.
do $$
declare
  t text;
begin
  foreach t in array array[
    'source_materials', 'knowledge_topics', 'diagnostic_questions', 'study_plans',
    'study_sessions', 'lesson_modules', 'exercise_sets', 'question_attempts',
    'adaptive_decisions', 'mock_exams', 'exam_attempts', 'assessment_results',
    'remediation_targets'
  ]
  loop
    execute format($f$
      create policy "%1$s_select_own" on public.%1$I
        for select to authenticated using (user_id = auth.uid());
      create policy "%1$s_delete_own" on public.%1$I
        for delete to authenticated using (user_id = auth.uid());
      create policy "%1$s_insert_own" on public.%1$I
        for insert to authenticated
        with check (
          user_id = auth.uid()
          and exists (select 1 from public.study_projects p where p.id = project_id and p.user_id = auth.uid())
        );
      create policy "%1$s_update_own" on public.%1$I
        for update to authenticated
        using (user_id = auth.uid())
        with check (
          user_id = auth.uid()
          and exists (select 1 from public.study_projects p where p.id = project_id and p.user_id = auth.uid())
        );
    $f$, t);
  end loop;
end;
$$;

-- lesson_scenes: parent is a lesson module
create policy "lesson_scenes_select_own" on public.lesson_scenes
  for select to authenticated using (user_id = auth.uid());
create policy "lesson_scenes_delete_own" on public.lesson_scenes
  for delete to authenticated using (user_id = auth.uid());
create policy "lesson_scenes_insert_own" on public.lesson_scenes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.lesson_modules l where l.id = lesson_id and l.user_id = auth.uid())
  );
create policy "lesson_scenes_update_own" on public.lesson_scenes
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.lesson_modules l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- mock_exam_questions: parent is a mock exam
create policy "mock_exam_questions_select_own" on public.mock_exam_questions
  for select to authenticated using (user_id = auth.uid());
create policy "mock_exam_questions_delete_own" on public.mock_exam_questions
  for delete to authenticated using (user_id = auth.uid());
create policy "mock_exam_questions_insert_own" on public.mock_exam_questions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.mock_exams m where m.id = mock_exam_id and m.user_id = auth.uid())
  );
create policy "mock_exam_questions_update_own" on public.mock_exam_questions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.mock_exams m where m.id = mock_exam_id and m.user_id = auth.uid())
  );

-- Cross-parent consistency: an exam attempt must point at a mock exam of the same project.
create or replace function public.check_attempt_project()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.mock_exams m where m.id = new.mock_exam_id and m.project_id = new.project_id
  ) then
    raise exception 'mock exam does not belong to project' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger exam_attempts_project_check before insert or update of mock_exam_id, project_id on public.exam_attempts
  for each row execute function public.check_attempt_project();

-- =============================================================================
-- Grants (Supabase exposes tables through PostgREST using these roles)
-- =============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- =============================================================================
-- Storage: private bucket, files live under "<user_id>/<project_id>/<file>"
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 26214400)
on conflict (id) do nothing;

create policy "materials_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
