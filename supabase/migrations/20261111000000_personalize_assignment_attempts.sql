alter table public.generated_questions
  drop constraint if exists generated_questions_assignment_id_position_key;
alter table public.generated_questions
  add column if not exists attempt_id uuid
  references public.attempts (id) on delete cascade;

create unique index if not exists generated_questions_assignment_position_idx
  on public.generated_questions (assignment_id, position)
  where attempt_id is null;
create unique index if not exists generated_questions_attempt_position_idx
  on public.generated_questions (attempt_id, position)
  where attempt_id is not null;

create or replace function public.start_assignment_attempt(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_attempt uuid;
  target_class uuid;
  question_count integer;
  current_topic text;
  current_question uuid;
  question_position integer := 0;
  left_operand integer;
  right_operand integer;
  correct_sum integer;
  shown_sum integer;
  expected_answer text;
begin
  select a.classroom_id into target_class
  from public.assignments a
  where a.id = p_assignment_id;
  if not found or not public.is_class_member(target_class) then
    raise exception 'Завдання не знайдено у вашому класі.';
  end if;

  select count(*) into question_count
  from public.generated_questions q
  where q.assignment_id = p_assignment_id
    and q.attempt_id is null;
  if question_count = 0 then
    raise exception 'Для цього завдання ще немає питань.';
  end if;

  insert into public.attempts (assignment_id, student_id, total_questions)
  values (p_assignment_id, auth.uid(), question_count)
  returning id into new_attempt;

  for current_topic in
    select q.topic
    from public.generated_questions q
    where q.assignment_id = p_assignment_id
      and q.attempt_id is null
    order by random()
  loop
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
      attempt_id,
      position,
      topic,
      prompt,
      answer_type
    )
    values (
      p_assignment_id,
      new_attempt,
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

  return new_attempt;
end;
$$;

create or replace function public.submit_assignment_answer(
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
  question_attempt uuid;
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

  select q.assignment_id, q.attempt_id, a.correct_answer
    into question_assignment, question_attempt, expected_answer
  from public.generated_questions q
  join public.question_answers a on a.question_id = q.id
  where q.id = p_question_id;
  if not found then
    raise exception 'Завдання або правильну відповідь не знайдено.';
  end if;
  if question_attempt is distinct from p_attempt_id or not exists (
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

create or replace function public.complete_assignment_attempt(p_attempt_id uuid)
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
  where q.attempt_id = p_attempt_id;
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

drop policy if exists "Questions are visible to class participants"
  on public.generated_questions;
create policy "Questions are visible to class participants"
on public.generated_questions for select to authenticated
using (
  public.is_assignment_teacher(assignment_id)
  or (
    attempt_id is null
    and exists (
      select 1
      from public.assignments a
      where a.id = assignment_id and public.is_class_member(a.classroom_id)
    )
  )
  or exists (
    select 1
    from public.attempts t
    where t.id = attempt_id and t.student_id = auth.uid()
  )
);
