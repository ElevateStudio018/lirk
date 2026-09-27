-- RLS isolation tests: User A must never read or modify User B's data.
-- Run with scripts/test-db.sh. Any failed assertion aborts with an error.

\set ON_ERROR_STOP on

reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- profiles are created by trigger
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles trigger did not create profiles';
end $$;

-- ---------------------------------------------------------------- user A setup
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.study_projects (id, subject, title, exam_date, minutes_per_session, available_days)
values ('10000000-0000-0000-0000-00000000000a', 'Geografi', 'Klimatprov', current_date + 10, 20, '{1,3,5}');

insert into public.source_materials (id, project_id, type, category, extracted_text, processing_status)
values ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'paste', 'planning', 'Växthuseffekten', 'ready');

insert into public.knowledge_topics (id, project_id, key, title, importance, difficulty, evidence_type, assessment_dimension)
values ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'vaxthus', 'Växthuseffekten', 5, 2, 'explicit', 'understanding');

insert into public.question_attempts (project_id, topic_id, source, question_type, score, is_correct, grading_method)
values ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'diagnostic', 'mcq', 1, true, 'deterministic');

insert into public.mock_exams (id, project_id, kind, title, time_limit_minutes)
values ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'mock1', 'Övningsprov 1', 30);

insert into public.mock_exam_questions (mock_exam_id, position, question)
values ('40000000-0000-0000-0000-00000000000a', 1, '{"prompt":"?"}');

insert into public.exam_attempts (id, project_id, mock_exam_id)
values ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a');

insert into public.lesson_modules (id, project_id, topic_id, title)
values ('60000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'Lektion');

insert into public.lesson_scenes (lesson_id, position, type, duration_seconds, data)
values ('60000000-0000-0000-0000-00000000000a', 0, 'title', 4, '{}');

insert into storage.objects (bucket_id, name)
values ('materials', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-00000000000a/plan.pdf');

do $$ begin
  assert (select count(*) from public.study_projects) = 1, 'A should see own project';
  assert (select count(*) from public.question_attempts) = 1, 'A should see own attempts';
  assert (select count(*) from storage.objects) = 1, 'A should see own file';
end $$;

-- ---------------------------------------------------------------- user B
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

do $$
declare
  n int;
begin
  -- B cannot read anything from A
  assert (select count(*) from public.study_projects) = 0, 'B can read A projects';
  assert (select count(*) from public.source_materials) = 0, 'B can read A materials';
  assert (select count(*) from public.knowledge_topics) = 0, 'B can read A topics';
  assert (select count(*) from public.question_attempts) = 0, 'B can read A attempts';
  assert (select count(*) from public.mock_exams) = 0, 'B can read A mock exams';
  assert (select count(*) from public.mock_exam_questions) = 0, 'B can read A mock questions';
  assert (select count(*) from public.exam_attempts) = 0, 'B can read A exam attempts';
  assert (select count(*) from public.lesson_modules) = 0, 'B can read A lessons';
  assert (select count(*) from public.lesson_scenes) = 0, 'B can read A scenes';
  assert (select count(*) from public.profiles) = 1, 'B should only see own profile';
  assert (select count(*) from storage.objects) = 0, 'B can read A files';

  -- B cannot update or delete A's rows (silently affects 0 rows)
  update public.study_projects set title = 'hacked' where id = '10000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B updated A project';

  delete from public.source_materials where id = '20000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B deleted A material';

  delete from storage.objects;
  get diagnostics n = row_count;
  assert n = 0, 'B deleted A file';
end $$;

-- B cannot attach rows to A's project, even when claiming its own user_id
do $$
begin
  begin
    insert into public.source_materials (project_id, type, extracted_text)
    values ('10000000-0000-0000-0000-00000000000a', 'paste', 'injected');
    raise exception 'B inserted material into A project';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.study_projects (user_id, subject, title, exam_date, minutes_per_session)
    values ('00000000-0000-0000-0000-00000000000a', 'X', 'forged', current_date, 20);
    raise exception 'B created project owned by A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.mock_exam_questions (mock_exam_id, position, question)
    values ('40000000-0000-0000-0000-00000000000a', 2, '{}');
    raise exception 'B inserted question into A mock exam';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lesson_scenes (lesson_id, position, type, duration_seconds, data)
    values ('60000000-0000-0000-0000-00000000000a', 5, 'title', 4, '{}');
    raise exception 'B inserted scene into A lesson';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('materials', '00000000-0000-0000-0000-00000000000a/x/evil.pdf');
    raise exception 'B uploaded into A folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B's own project works, but cannot point an attempt at A's mock exam
insert into public.study_projects (id, subject, title, exam_date, minutes_per_session)
values ('10000000-0000-0000-0000-00000000000b', 'Matematik', 'Ekvationer', current_date + 5, 30);

do $$
begin
  begin
    insert into public.exam_attempts (project_id, mock_exam_id)
    values ('10000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-00000000000a');
    raise exception 'B attached attempt to A mock exam';
  exception when foreign_key_violation then null;
  end;
  assert (select count(*) from public.study_projects) = 1, 'B should see exactly own project';
end $$;

-- ---------------------------------------------------------------- anon
reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.study_projects;
    raise exception 'anon can read projects';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- exam lock
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

update public.exam_attempts set answers = '{"q1":"svar"}' where id = '50000000-0000-0000-0000-00000000000a';
update public.exam_attempts set status = 'submitted' where id = '50000000-0000-0000-0000-00000000000a';

do $$
begin
  assert (select submitted_at is not null from public.exam_attempts where id = '50000000-0000-0000-0000-00000000000a'),
    'submitted_at should be set on submit';
  begin
    update public.exam_attempts set answers = '{"q1":"ändrat"}' where id = '50000000-0000-0000-0000-00000000000a';
    raise exception 'submitted attempt was modified';
  exception when check_violation then null;
  end;
  begin
    update public.exam_attempts set status = 'in_progress' where id = '50000000-0000-0000-0000-00000000000a';
    raise exception 'submitted attempt was reopened';
  exception when check_violation then null;
  end;
  -- moving forward through assessment states is allowed
  update public.exam_attempts set status = 'assessing' where id = '50000000-0000-0000-0000-00000000000a';
end $$;

reset role;
select 'RLS tests passed' as result;

-- clarifying questions follow the same isolation
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.clarifying_questions (project_id, position, question, why) values ('10000000-0000-0000-0000-00000000000a', 0, 'Vilka kapitel?', 'Omfång');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.clarifying_questions) = 0, 'B can read A clarifying questions';
  begin
    insert into public.clarifying_questions (project_id, position, question, why) values ('10000000-0000-0000-0000-00000000000a', 1, 'x', 'y');
    raise exception 'B inserted clarifying question into A project';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'Clarifying RLS tests passed' as result;
