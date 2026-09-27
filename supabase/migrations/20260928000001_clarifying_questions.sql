-- =============================================================================
-- Följdfrågor: after the knowledge map is built, the AI asks the student a few
-- questions about what is unclear in the material (scope, format, emphasis).
-- The answers refine the map before the diagnostic test.
-- =============================================================================

alter table public.study_projects add column clarified_at timestamptz;

-- The student's answers are stored as their own source material, clearly labelled.
alter table public.source_materials drop constraint source_materials_category_check;
alter table public.source_materials add constraint source_materials_category_check
  check (category in ('planning', 'criteria', 'notes', 'teacher_said', 'student_answers', 'other'));

create table public.clarifying_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  position integer not null,
  question text not null,
  why text not null,
  options text[] not null default '{}',
  allow_free_text boolean not null default true,
  topic_keys text[] not null default '{}',
  -- null = not answered yet; answered_at set + answer null = "Vet inte"
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index clarifying_questions_project_idx on public.clarifying_questions (project_id, position);

alter table public.clarifying_questions enable row level security;

create policy "clarifying_questions_select_own" on public.clarifying_questions
  for select to authenticated using (user_id = auth.uid());
create policy "clarifying_questions_delete_own" on public.clarifying_questions
  for delete to authenticated using (user_id = auth.uid());
create policy "clarifying_questions_insert_own" on public.clarifying_questions
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.study_projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "clarifying_questions_update_own" on public.clarifying_questions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.study_projects p where p.id = project_id and p.user_id = auth.uid()));

grant select, insert, update, delete on public.clarifying_questions to authenticated;
