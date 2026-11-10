create extension if not exists pgcrypto;

create type public.account_role as enum ('teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  role public.account_role not null,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.account_role;
  selected_name text;
begin
  selected_role := case
    when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'::public.account_role
    else 'student'::public.account_role
  end;
  selected_name := regexp_replace(
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    '\s+',
    ' ',
    'g'
  );

  if char_length(selected_name) < 2 or char_length(selected_name) > 60 then
    raise exception 'Ім’я має містити від 2 до 60 символів.';
  end if;

  insert into public.profiles (id, display_name, role)
  values (new.id, selected_name, selected_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.profiles (id) on delete cascade,
  class_code char(6) not null unique check (class_code ~ '^[0-9]{6}$'),
  grade integer not null default 2 check (grade = 2),
  created_at timestamptz not null default now()
);

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  student_id uuid not null unique references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create function public.has_unique_topics(topic_names text[])
returns boolean
language sql
immutable
as $$
  select cardinality(topic_names) = count(distinct topic_name)
  from unnest(topic_names) as topics(topic_name);
$$;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  grade integer not null default 2 check (grade = 2),
  topics text[] not null check (
    cardinality(topics) between 1 and 10
    and topics <@ array[
      'Тема 1', 'Тема 2', 'Тема 3', 'Тема 4', 'Тема 5',
      'Тема 6', 'Тема 7', 'Тема 8', 'Тема 9', 'Тема 10'
    ]::text[]
    and public.has_unique_topics(topics)
  ),
  questions_per_topic integer not null check (questions_per_topic in (4, 8, 12)),
  total_questions integer generated always as (
    cardinality(topics) * questions_per_topic
  ) stored,
  created_at timestamptz not null default now()
);

create table public.generated_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position integer not null check (position > 0),
  topic text not null,
  prompt text not null check (char_length(trim(prompt)) > 0),
  answer_type text not null check (answer_type in ('number', 'comparator', 'text')),
  unique (assignment_id, position)
);

create table public.question_answers (
  question_id uuid primary key references public.generated_questions (id) on delete cascade,
  correct_answer text not null
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  score integer,
  total_questions integer not null default 0 check (total_questions >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'started' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  ),
  check (score is null or (score >= 0 and score <= total_questions))
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.generated_questions (id) on delete cascade,
  response text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create function public.is_class_teacher(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classrooms
    where id = target_classroom and teacher_id = auth.uid()
  );
$$;

create function public.is_class_member(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where classroom_id = target_classroom and student_id = auth.uid()
  );
$$;

create function public.can_teacher_view_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members m
    join public.classrooms c on c.id = m.classroom_id
    where m.student_id = target_student and c.teacher_id = auth.uid()
  );
$$;

create function public.is_assignment_teacher(target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.classrooms c on c.id = a.classroom_id
    where a.id = target_assignment and c.teacher_id = auth.uid()
  );
$$;

create function public.is_attempt_owner(target_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attempts
    where id = target_attempt and student_id = auth.uid()
  );
$$;

create function public.is_attempt_teacher(target_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts t
    join public.assignments a on a.id = t.assignment_id
    join public.classrooms c on c.id = a.classroom_id
    where t.id = target_attempt and c.teacher_id = auth.uid()
  );
$$;

create function public.create_assignment(
  p_classroom_id uuid,
  p_title text,
  p_topics text[],
  p_questions_per_topic integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assignment uuid;
  current_topic text;
  current_question uuid;
  question_position integer := 0;
  left_operand integer;
  right_operand integer;
  correct_sum integer;
  shown_sum integer;
  expected_answer text;
begin
  if not public.is_class_teacher(p_classroom_id) then
    raise exception 'Лише вчитель класу може створювати завдання.';
  end if;

  insert into public.assignments (
    classroom_id,
    title,
    topics,
    questions_per_topic,
    grade
  )
  values (
    p_classroom_id,
    trim(p_title),
    p_topics,
    p_questions_per_topic,
    2
  )
  returning id into new_assignment;

  foreach current_topic in array p_topics loop
    for question_number in 1..p_questions_per_topic loop
      left_operand := floor(random() * 50)::integer + 1;
      right_operand := floor(random() * 50)::integer + 1;
      correct_sum := left_operand + right_operand;

      if random() < 0.5 then
        shown_sum := correct_sum;
        expected_answer := 'Правильно';
      else
        shown_sum := correct_sum + case when random() < 0.5 then -1 else 1 end;
        expected_answer := 'Неправильно';
      end if;

      question_position := question_position + 1;
      insert into public.generated_questions (
        assignment_id,
        position,
        topic,
        prompt,
        answer_type
      )
      values (
        new_assignment,
        question_position,
        current_topic,
        left_operand::text || ' + ' || right_operand::text || ' = ' ||
          shown_sum::text || '. Це правильно чи неправильно?',
        'text'
      )
      returning id into current_question;

      insert into public.question_answers (question_id, correct_answer)
      values (current_question, expected_answer);
    end loop;
  end loop;

  return new_assignment;
end;
$$;

create function public.create_classroom()
returns table (id uuid, class_code text, grade integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_class public.classrooms%rowtype;
  candidate_code text;
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'teacher'
  ) then
    raise exception 'Лише вчитель може створити клас.';
  end if;

  select * into current_class
  from public.classrooms
  where teacher_id = auth.uid();
  if found then
    return query select current_class.id, current_class.class_code::text, current_class.grade;
    return;
  end if;

  loop
    candidate_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    insert into public.classrooms (teacher_id, class_code)
    values (auth.uid(), candidate_code)
    on conflict do nothing
    returning * into current_class;

    if found then
      return query select current_class.id, current_class.class_code::text, current_class.grade;
      return;
    end if;

    select * into current_class
    from public.classrooms
    where teacher_id = auth.uid();
    if found then
      return query select current_class.id, current_class.class_code::text, current_class.grade;
      return;
    end if;
  end loop;
end;
$$;

create function public.join_class(p_code text)
returns table (classroom_id uuid, class_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classrooms%rowtype;
  existing_class uuid;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'Код класу має містити шість цифр.';
  end if;
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'student'
  ) then
    raise exception 'До класу можуть приєднатися лише учні.';
  end if;

  select * into target_class
  from public.classrooms
  where classrooms.class_code = p_code;
  if not found then
    raise exception 'Клас із таким кодом не знайдено.';
  end if;

  select m.classroom_id into existing_class
  from public.class_members m
  where m.student_id = auth.uid();
  if found then
    if existing_class <> target_class.id then
      raise exception 'Учень уже приєднаний до іншого класу.';
    end if;
  else
    insert into public.class_members (classroom_id, student_id)
    values (target_class.id, auth.uid());
  end if;

  return query select target_class.id, target_class.class_code::text;
end;
$$;

create function public.start_assignment_attempt(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_attempt uuid;
  target_class uuid;
  question_count integer;
begin
  select a.classroom_id into target_class
  from public.assignments a
  where a.id = p_assignment_id;
  if not found or not public.is_class_member(target_class) then
    raise exception 'Завдання не знайдено у вашому класі.';
  end if;

  select count(*) into question_count
  from public.generated_questions q
  where q.assignment_id = p_assignment_id;
  if question_count = 0 then
    raise exception 'Для цього завдання ще немає навчальних вправ.';
  end if;

  insert into public.attempts (assignment_id, student_id, total_questions)
  values (p_assignment_id, auth.uid(), question_count)
  returning id into new_attempt;
  return new_attempt;
end;
$$;

create function public.submit_assignment_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_response text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  question_assignment uuid;
  expected_answer text;
  result boolean;
begin
  if not public.is_attempt_owner(p_attempt_id) then
    raise exception 'Спробу не знайдено.';
  end if;
  if exists (
    select 1 from public.attempts
    where id = p_attempt_id and status <> 'started'
  ) then
    raise exception 'Спробу вже завершено.';
  end if;

  select q.assignment_id, a.correct_answer into question_assignment, expected_answer
  from public.generated_questions q
  join public.question_answers a on a.question_id = q.id
  where q.id = p_question_id;
  if not found then
    raise exception 'Завдання або правильну відповідь не знайдено.';
  end if;
  if not exists (
    select 1 from public.attempts t
    where t.id = p_attempt_id and t.assignment_id = question_assignment
  ) then
    raise exception 'Це питання не належить до поточної спроби.';
  end if;
  if p_response is null or char_length(trim(p_response)) = 0 then
    raise exception 'Відповідь не може бути порожньою.';
  end if;

  result := lower(trim(p_response)) = lower(trim(expected_answer));
  insert into public.attempt_answers (attempt_id, question_id, response, is_correct)
  values (p_attempt_id, p_question_id, trim(p_response), result)
  on conflict (attempt_id, question_id)
  do update set response = excluded.response,
                is_correct = excluded.is_correct,
                answered_at = now();
  return result;
end;
$$;

create function public.complete_assignment_attempt(p_attempt_id uuid)
returns table (score integer, total_questions integer, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  question_total integer;
  answer_total integer;
  correct_total integer;
begin
  if not public.is_attempt_owner(p_attempt_id) then
    raise exception 'Спробу не знайдено.';
  end if;
  if exists (
    select 1 from public.attempts
    where id = p_attempt_id and status <> 'started'
  ) then
    raise exception 'Спробу вже завершено.';
  end if;

  select count(*) into question_total
  from public.generated_questions q
  join public.attempts t on t.assignment_id = q.assignment_id
  where t.id = p_attempt_id;
  select count(*), count(*) filter (where aa.is_correct)
    into answer_total, correct_total
  from public.attempt_answers aa
  where aa.attempt_id = p_attempt_id;
  if question_total = 0 or answer_total <> question_total then
    raise exception 'Неможливо завершити спробу: не всі відповіді збережені.';
  end if;

  return query
  update public.attempts t
  set status = 'completed',
      score = correct_total,
      total_questions = question_total,
      completed_at = now()
  where t.id = p_attempt_id
  returning t.score, t.total_questions, t.completed_at;
end;
$$;

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.generated_questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

create policy "Profiles are visible to their owner and class teacher"
on public.profiles for select to authenticated
using (id = auth.uid() or public.can_teacher_view_student(id));

create policy "Classrooms are visible to their teacher and students"
on public.classrooms for select to authenticated
using (teacher_id = auth.uid() or public.is_class_member(id));

create policy "Class members are visible to the student and their teacher"
on public.class_members for select to authenticated
using (student_id = auth.uid() or public.is_class_teacher(classroom_id));

create policy "Assignments are visible to class participants"
on public.assignments for select to authenticated
using (
  public.is_class_teacher(classroom_id)
  or public.is_class_member(classroom_id)
);

create policy "Teachers create assignments for their class"
on public.assignments for insert to authenticated
with check (public.is_class_teacher(classroom_id));

create policy "Questions are visible to class participants"
on public.generated_questions for select to authenticated
using (
  public.is_assignment_teacher(assignment_id)
  or exists (
    select 1
    from public.assignments a
    where a.id = assignment_id and public.is_class_member(a.classroom_id)
  )
);

create policy "Teachers create questions for their assignments"
on public.generated_questions for insert to authenticated
with check (public.is_assignment_teacher(assignment_id));

create policy "Only the class teacher can read correct answers"
on public.question_answers for select to authenticated
using (
  exists (
    select 1
    from public.generated_questions q
    where q.id = question_id and public.is_assignment_teacher(q.assignment_id)
  )
);

create policy "Only the class teacher can write correct answers"
on public.question_answers for insert to authenticated
with check (
  exists (
    select 1
    from public.generated_questions q
    where q.id = question_id and public.is_assignment_teacher(q.assignment_id)
  )
);

create policy "Attempts are visible to their student and class teacher"
on public.attempts for select to authenticated
using (
  student_id = auth.uid()
  or public.is_assignment_teacher(assignment_id)
);

create policy "Answers are visible to their student and class teacher"
on public.attempt_answers for select to authenticated
using (
  public.is_attempt_owner(attempt_id)
  or public.is_attempt_teacher(attempt_id)
);

grant select on public.profiles, public.classrooms, public.class_members,
  public.assignments, public.generated_questions, public.question_answers,
  public.attempts, public.attempt_answers
  to authenticated;
grant insert on public.assignments, public.generated_questions,
  public.question_answers to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_unique_topics(text[]) from public, anon, authenticated;
revoke all on function public.is_class_teacher(uuid) from public, anon;
revoke all on function public.is_class_member(uuid) from public, anon;
revoke all on function public.can_teacher_view_student(uuid) from public, anon;
revoke all on function public.is_assignment_teacher(uuid) from public, anon;
revoke all on function public.is_attempt_owner(uuid) from public, anon;
revoke all on function public.is_attempt_teacher(uuid) from public, anon;
revoke all on function public.create_classroom() from public, anon;
revoke all on function public.create_assignment(uuid, text, text[], integer) from public, anon;
revoke all on function public.join_class(text) from public, anon;
revoke all on function public.start_assignment_attempt(uuid) from public, anon;
revoke all on function public.submit_assignment_answer(uuid, uuid, text) from public, anon;
revoke all on function public.complete_assignment_attempt(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.can_teacher_view_student(uuid) to authenticated;
grant execute on function public.is_assignment_teacher(uuid) to authenticated;
grant execute on function public.is_attempt_owner(uuid) to authenticated;
grant execute on function public.is_attempt_teacher(uuid) to authenticated;
grant execute on function public.has_unique_topics(text[]) to authenticated;
grant execute on function public.create_classroom() to authenticated;
grant execute on function public.create_assignment(uuid, text, text[], integer) to authenticated;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.start_assignment_attempt(uuid) to authenticated;
grant execute on function public.submit_assignment_answer(uuid, uuid, text) to authenticated;
grant execute on function public.complete_assignment_attempt(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'class_members'
  ) then
    alter publication supabase_realtime add table public.class_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'assignments'
  ) then
    alter publication supabase_realtime add table public.assignments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attempts'
  ) then
    alter publication supabase_realtime add table public.attempts;
  end if;
end;
$$;
