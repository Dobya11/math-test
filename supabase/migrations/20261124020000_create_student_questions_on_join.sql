create or replace function public.create_student_assignment_questions(
  p_assignment_id uuid,
  p_questions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_topics text[];
  assignment_classroom_id uuid;
  assignment_questions_per_topic integer;
  assignment_total_questions integer;
  question_list jsonb;
  question jsonb;
  question_topic text;
  question_prompt text;
  question_answer_type text;
  correct_answer text;
  question_options text[];
  question_position integer := 0;
  question_count integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and role = 'student'
  ) then
    raise exception 'Лише учень може створити власний набір завдань.';
  end if;

  select assignment.classroom_id,
         assignment.topics,
         assignment.questions_per_topic,
         assignment.total_questions
  into assignment_classroom_id,
       assignment_topics,
       assignment_questions_per_topic,
       assignment_total_questions
  from public.assignments assignment
  where assignment.id = p_assignment_id
    and assignment.personalized_questions
  for update;

  if not found then
    raise exception 'Персональне завдання не знайдено.';
  end if;

  if not exists (
    select 1
    from public.class_members member
    where member.classroom_id = assignment_classroom_id
      and member.student_id = auth.uid()
  ) then
    raise exception 'Ви не приєднані до класу з цим завданням.';
  end if;

  if exists (
    select 1
    from public.assignment_student_questions question
    where question.assignment_id = p_assignment_id
      and question.student_id = auth.uid()
  ) then
    return true;
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Набір завдань має бути списком.';
  end if;
  if jsonb_array_length(p_questions) <> assignment_total_questions then
    raise exception 'Кількість завдань у персональному наборі неправильна.';
  end if;

  if (
    select count(distinct value ->> 'prompt')
    from jsonb_array_elements(p_questions)
  ) <> assignment_total_questions then
    raise exception 'У наборі є повторювані завдання.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_questions) as candidate(value)
    join public.assignment_student_questions existing
      on existing.assignment_id = p_assignment_id
      and existing.prompt = candidate.value ->> 'prompt'
  ) then
    return false;
  end if;

  foreach question_topic in array assignment_topics loop
    select count(*) into question_count
    from jsonb_array_elements(p_questions) as candidate(value)
    where candidate.value ->> 'topic' = question_topic;
    if question_count <> assignment_questions_per_topic then
      raise exception 'Кількість завдань для теми "%" неправильна.', question_topic;
    end if;
  end loop;

  for question in select value from jsonb_array_elements(p_questions)
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
      p_assignment_id,
      auth.uid(),
      question_position,
      question_topic,
      question_prompt,
      case when question_options is null then 'text' else 'choice' end,
      question_answer_type,
      question_options,
      correct_answer
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.create_student_assignment_questions(uuid, jsonb)
  from public, anon;
grant execute on function public.create_student_assignment_questions(uuid, jsonb)
  to authenticated;

create or replace function public.submit_assignment_answer_with_summary(
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
  attempt_student_id uuid;
  attempt_assignment_id uuid;
  attempt_status text;
  question_prompt text;
  correct_answer text;
  is_correct boolean;
  question_summary jsonb;
begin
  select student_id, assignment_id, status
  into attempt_student_id, attempt_assignment_id, attempt_status
  from public.attempts
  where id = p_attempt_id;

  if auth.uid() is null or not found or attempt_student_id <> auth.uid() then
    raise exception 'Спробу не знайдено.';
  end if;
  if attempt_status <> 'started' then
    raise exception 'Ця спроба вже завершена.';
  end if;

  select question.prompt, answer.correct_answer
  into question_prompt, correct_answer
  from public.generated_questions question
  join public.question_answers answer
    on answer.question_id = question.id
  where question.id = p_question_id
    and question.assignment_id = attempt_assignment_id;

  if not found then
    raise exception 'Завдання не належить цій спробі.';
  end if;

  is_correct := public.submit_assignment_answer(
    p_attempt_id,
    p_question_id,
    p_response
  );
  question_summary := jsonb_build_object(
    'questionId', p_question_id,
    'prompt', question_prompt,
    'studentAnswer', btrim(coalesce(p_response, '')),
    'correctAnswer', correct_answer,
    'isCorrect', is_correct
  );

  update public.attempts attempt
  set question_summaries = (
    select coalesce(jsonb_agg(existing.value order by existing.ordinality), '[]'::jsonb)
    from jsonb_array_elements(coalesce(attempt.question_summaries, '[]'::jsonb))
      with ordinality as existing(value, ordinality)
    where existing.value ->> 'questionId' <> p_question_id::text
  ) || jsonb_build_array(question_summary)
  where attempt.id = p_attempt_id;

  return is_correct;
end;
$$;

revoke all on function public.submit_assignment_answer_with_summary(uuid, uuid, text)
  from public, anon;
grant execute on function public.submit_assignment_answer_with_summary(uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
