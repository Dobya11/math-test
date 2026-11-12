alter table public.generated_questions
  add column if not exists options text[],
  add column if not exists response_mode text not null default 'boolean';

alter table public.generated_questions
  add constraint generated_questions_response_mode_check
  check (response_mode in ('choice', 'text', 'boolean'));

create or replace function public.create_assignment_with_questions(
  p_classroom_id uuid,
  p_title text,
  p_topics text[],
  p_questions_per_topic integer,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assignment uuid;
  new_question uuid;
  question jsonb;
  topic_name text;
  question_topic text;
  question_prompt text;
  question_answer_type text;
  question_response_mode text;
  correct_answer text;
  question_options text[];
  question_count integer;
  question_position integer := 0;
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

  if p_title is null or char_length(trim(p_title)) not between 1 and 80 then
    raise exception 'Назва завдання має містити від 1 до 80 символів.';
  end if;
  if p_topics is null
    or cardinality(p_topics) not between 1 and 10
    or not public.has_unique_topics(p_topics)
  then
    raise exception 'Оберіть від 1 до 10 різних навчальних тем.';
  end if;
  if p_questions_per_topic is null or p_questions_per_topic not in (4, 8, 12) then
    raise exception 'Кількість завдань на тему має бути 4, 8 або 12.';
  end if;
  if p_questions is null then
    raise exception 'Список завдань не може бути порожнім.';
  end if;
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Список завдань має бути масивом.';
  end if;
  if jsonb_array_length(p_questions) <> cardinality(p_topics) * p_questions_per_topic then
    raise exception 'Кількість згенерованих завдань не відповідає вибраним темам.';
  end if;

  foreach topic_name in array p_topics loop
    select count(*) into question_count
    from jsonb_array_elements(p_questions) as item(value)
    where item.value ->> 'topic' = topic_name;

    if question_count <> p_questions_per_topic then
      raise exception 'Кількість завдань для теми "%" неправильна.', topic_name;
    end if;
  end loop;

  insert into public.assignments (
    classroom_id,
    title,
    topics,
    questions_per_topic
  )
  values (
    p_classroom_id,
    trim(p_title),
    p_topics,
    p_questions_per_topic
  )
  returning id into new_assignment;

  for question in select value from jsonb_array_elements(p_questions) loop
    question_topic := question ->> 'topic';
    question_prompt := nullif(trim(question ->> 'prompt'), '');
    question_answer_type := question ->> 'answer_type';
    correct_answer := nullif(trim(question ->> 'correct_answer'), '');
    question_options := null;

    if question_topic is null or not (question_topic = any(p_topics)) then
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

    question_response_mode :=
      case when question_options is null then 'text' else 'choice' end;
    question_position := question_position + 1;
    insert into public.generated_questions (
      assignment_id,
      position,
      topic,
      prompt,
      response_mode,
      answer_type,
      options
    )
    values (
      new_assignment,
      question_position,
      question_topic,
      question_prompt,
      question_response_mode,
      question_answer_type,
      question_options
    )
    returning id into new_question;

    insert into public.question_answers (question_id, correct_answer)
    values (new_question, correct_answer);
  end loop;

  return new_assignment;
end;
$$;

revoke all on function public.create_assignment_with_questions(
  uuid, text, text[], integer, jsonb
) from public, anon;
grant execute on function public.create_assignment_with_questions(
  uuid, text, text[], integer, jsonb
) to authenticated;

notify pgrst, 'reload schema';
