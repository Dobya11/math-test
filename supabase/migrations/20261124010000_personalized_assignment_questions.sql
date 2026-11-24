alter table public.assignments
  add column if not exists personalized_questions boolean not null default false;

create table public.assignment_student_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  position integer not null check (position > 0),
  topic text not null,
  prompt text not null,
  response_mode text not null check (response_mode in ('choice', 'text')),
  answer_type text not null check (answer_type in ('number', 'comparator', 'text')),
  options text[],
  correct_answer text not null,
  unique (assignment_id, student_id, position),
  unique (assignment_id, prompt)
);

create table public.attempt_question_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.assignment_student_questions(id) on delete cascade,
  student_answer text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

alter table public.assignment_student_questions enable row level security;
alter table public.attempt_question_answers enable row level security;
revoke all on public.assignment_student_questions from public, anon, authenticated;
revoke all on public.attempt_question_answers from public, anon, authenticated;

create or replace function public.create_assignment_with_student_questions(
  p_classroom_id uuid,
  p_title text,
  p_topics text[],
  p_questions_per_topic integer,
  p_questions jsonb,
  p_student_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assignment uuid;
  student_entry jsonb;
  question jsonb;
  v_student_id uuid;
  student_ids uuid[] := '{}';
  assignment_topics text[];
  expected_question_count integer;
  questions_per_topic integer;
  question_list jsonb;
  question_position integer;
  question_topic text;
  question_prompt text;
  question_answer_type text;
  correct_answer text;
  question_options text[];
  question_count integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'teacher'
  ) then
    raise exception 'Лише вчитель може створити завдання.';
  end if;

  if not exists (
    select 1
    from public.classrooms
    where id = p_classroom_id and teacher_id = auth.uid()
  ) then
    raise exception 'Клас не знайдено.';
  end if;

  if p_student_questions is null
    or jsonb_typeof(p_student_questions) <> 'array'
  then
    raise exception 'Потрібні окремі набори завдань для учнів класу.';
  end if;
  if jsonb_array_length(p_student_questions) = 0 then
    raise exception 'До класу мають приєднатися учні перед створенням завдання.';
  end if;

  for student_entry in
    select value from jsonb_array_elements(p_student_questions)
  loop
    v_student_id := (student_entry ->> 'student_id')::uuid;
    if v_student_id = any(student_ids) then
      raise exception 'Набір завдань для учня передано повторно.';
    end if;
    student_ids := array_append(student_ids, v_student_id);

    if not exists (
      select 1
      from public.class_members member
      where member.classroom_id = p_classroom_id
        and member.student_id = v_student_id
    ) then
      raise exception 'У списку є учень, який не належить до цього класу.';
    end if;
  end loop;

  if exists (
    select 1
    from public.class_members member
    where member.classroom_id = p_classroom_id
      and not (member.student_id = any(student_ids))
  ) then
    raise exception 'Для кожного учня класу потрібно створити окремий набір завдань.';
  end if;

  new_assignment := public.create_assignment_with_questions(
    p_classroom_id,
    p_title,
    p_topics,
    p_questions_per_topic,
    p_questions
  );

  select assignment.topics, assignment.total_questions, assignment.questions_per_topic
  into assignment_topics, expected_question_count, questions_per_topic
  from public.assignments assignment
  where assignment.id = new_assignment;

  for student_entry in
    select value from jsonb_array_elements(p_student_questions)
  loop
    v_student_id := (student_entry ->> 'student_id')::uuid;
    question_list := student_entry -> 'questions';
    if question_list is null or jsonb_typeof(question_list) <> 'array' then
      raise exception 'Список завдань учня має бути масивом.';
    end if;
    if jsonb_array_length(question_list) <> expected_question_count then
      raise exception 'Кількість завдань для кожного учня має бути %.', expected_question_count;
    end if;

    if (
      select count(distinct value ->> 'prompt')
      from jsonb_array_elements(question_list)
    ) <> expected_question_count then
      raise exception 'У наборі учня є повторювані завдання.';
    end if;

    foreach question_topic in array assignment_topics loop
      select count(*) into question_count
      from jsonb_array_elements(question_list) as item(value)
      where item.value ->> 'topic' = question_topic;
      if question_count <> questions_per_topic then
        raise exception 'Кількість завдань для теми "%" неправильна.', question_topic;
      end if;
    end loop;

    question_position := 0;
    for question in select value from jsonb_array_elements(question_list)
    loop
      question_topic := question ->> 'topic';
      question_prompt := nullif(trim(question ->> 'prompt'), '');
      question_answer_type := question ->> 'answer_type';
      correct_answer := nullif(trim(question ->> 'correct_answer'), '');
      question_options := null;

      if question_topic is null or not (question_topic = any(assignment_topics)) then
        raise exception 'Завдання містить невибрану тему.';
      end if;
      if question_prompt is null or correct_answer is null then
        raise exception 'Кожне завдання має містити умову й правильну відповідь.';
      end if;
      if question_answer_type is null
        or question_answer_type not in ('number', 'comparator', 'text')
      then
        raise exception 'Тип відповіді завдання неправильний.';
      end if;

      if question ? 'options' and jsonb_typeof(question -> 'options') <> 'null' then
        if jsonb_typeof(question -> 'options') <> 'array' then
          raise exception 'Варіанти відповіді мають бути списком.';
        end if;

        select array_agg(option_value)
        into question_options
        from jsonb_array_elements_text(question -> 'options') as options(option_value);

        if question_options is null
          or cardinality(question_options) not between 2 and 4
          or (
            select count(distinct option_value)
            from unnest(question_options) as options(option_value)
          ) <> cardinality(question_options)
          or not (correct_answer = any(question_options))
        then
          raise exception 'Варіанти відповіді мають бути різними й містити правильну відповідь.';
        end if;
      end if;

      question_position := question_position + 1;
      insert into public.assignment_student_questions (
        assignment_id,
        student_id,
        position,
        topic,
        prompt,
        response_mode,
        answer_type,
        options,
        correct_answer
      )
      values (
        new_assignment,
        v_student_id,
        question_position,
        question_topic,
        question_prompt,
        case when question_options is null then 'text' else 'choice' end,
        question_answer_type,
        question_options,
        correct_answer
      );
    end loop;
  end loop;

  update public.assignments
  set personalized_questions = true
  where id = new_assignment;

  return new_assignment;
end;
$$;

revoke all on function public.create_assignment_with_student_questions(
  uuid, text, text[], integer, jsonb, jsonb
) from public, anon;
grant execute on function public.create_assignment_with_student_questions(
  uuid, text, text[], integer, jsonb, jsonb
) to authenticated;

create or replace function public.get_student_assignment_questions(
  p_assignment_id uuid
)
returns table (
  id uuid,
  position integer,
  topic text,
  prompt text,
  response_mode text,
  answer_type text,
  options text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and role = 'student'
  ) then
    raise exception 'Лише учень може переглядати персональні завдання.';
  end if;

  return query
  select question.id, question.position, question.topic, question.prompt,
         question.response_mode, question.answer_type, question.options
  from public.assignment_student_questions question
  where question.assignment_id = p_assignment_id
    and question.student_id = auth.uid()
  order by question.position;
end;
$$;

revoke all on function public.get_student_assignment_questions(uuid) from public, anon;
grant execute on function public.get_student_assignment_questions(uuid) to authenticated;

create or replace function public.submit_student_assignment_answer(
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
  attempt_assignment_id uuid;
  attempt_student_id uuid;
  attempt_status text;
  question assignment_student_questions%rowtype;
  student_response text := btrim(coalesce(p_response, ''));
  is_correct boolean;
begin
  select assignment_id, student_id, status
  into attempt_assignment_id, attempt_student_id, attempt_status
  from public.attempts
  where id = p_attempt_id;

  if auth.uid() is null or not found or attempt_student_id <> auth.uid() then
    raise exception 'Спробу не знайдено.';
  end if;
  if attempt_status <> 'started' then
    raise exception 'Ця спроба вже завершена.';
  end if;

  select *
  into question
  from public.assignment_student_questions
  where id = p_question_id
    and assignment_id = attempt_assignment_id
    and student_id = attempt_student_id;
  if not found then
    raise exception 'Завдання не належить цій спробі.';
  end if;

  if question.answer_type = 'number' then
    if student_response ~ '^[+-]?[0-9]+([.][0-9]+)?$'
      and question.correct_answer ~ '^[+-]?[0-9]+([.][0-9]+)?$'
    then
      is_correct := student_response::numeric = question.correct_answer::numeric;
    else
      is_correct := false;
    end if;
  elsif question.answer_type = 'comparator' then
    is_correct := student_response = question.correct_answer;
  else
    is_correct := lower(student_response) = lower(btrim(question.correct_answer));
  end if;

  insert into public.attempt_question_answers (
    attempt_id, question_id, student_answer, is_correct
  )
  values (p_attempt_id, p_question_id, student_response, is_correct);

  update public.attempts
  set score = (
        select count(*)::integer
        from public.attempt_question_answers answer
        where answer.attempt_id = p_attempt_id and answer.is_correct
      ),
      question_summaries = coalesce(question_summaries, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'questionId', question.id,
          'prompt', question.prompt,
          'studentAnswer', student_response,
          'isCorrect', is_correct
        ))
  where id = p_attempt_id;

  return is_correct;
end;
$$;

revoke all on function public.submit_student_assignment_answer(uuid, uuid, text)
  from public, anon;
grant execute on function public.submit_student_assignment_answer(uuid, uuid, text)
  to authenticated;

create or replace function public.complete_student_assignment_attempt(
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_student_id uuid;
  attempt_status text;
  expected_questions integer;
  answered_questions integer;
  v_question_summaries jsonb;
begin
  select student_id, status, total_questions
  into attempt_student_id, attempt_status, expected_questions
  from public.attempts
  where id = p_attempt_id;

  if auth.uid() is null or not found or attempt_student_id <> auth.uid() then
    raise exception 'Спробу не знайдено.';
  end if;
  if attempt_status <> 'started' then
    raise exception 'Ця спроба вже завершена.';
  end if;

  select count(*) into answered_questions
  from public.attempt_question_answers
  where attempt_id = p_attempt_id;

  if answered_questions <> expected_questions then
    raise exception 'Дайте відповідь на всі завдання перед завершенням.';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'questionId', question.id,
      'prompt', question.prompt,
      'studentAnswer', answer.student_answer,
      'correctAnswer', question.correct_answer,
      'isCorrect', answer.is_correct
    ) order by question.position),
    '[]'::jsonb
  )
  into v_question_summaries
  from public.attempt_question_answers answer
  join public.assignment_student_questions question
    on question.id = answer.question_id
  where answer.attempt_id = p_attempt_id;

  update public.attempts
  set status = 'completed',
      completed_at = now(),
  question_summaries = v_question_summaries
  where id = p_attempt_id;
end;
$$;

revoke all on function public.complete_student_assignment_attempt(uuid)
  from public, anon;
grant execute on function public.complete_student_assignment_attempt(uuid)
  to authenticated;

notify pgrst, 'reload schema';
