create or replace function public.create_assignment(
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

revoke all on function public.create_assignment(uuid, text, text[], integer)
  from public, anon;
grant execute on function public.create_assignment(uuid, text, text[], integer)
  to authenticated;

do $$
declare
  existing_assignment record;
  current_topic text;
  current_question uuid;
  question_position integer;
  left_operand integer;
  right_operand integer;
  correct_sum integer;
  shown_sum integer;
  expected_answer text;
begin
  for existing_assignment in
    select a.id, a.topics, a.questions_per_topic
    from public.assignments a
    where not exists (
      select 1
      from public.generated_questions q
      where q.assignment_id = a.id
    )
  loop
    question_position := 0;
    foreach current_topic in array existing_assignment.topics loop
      for question_number in 1..existing_assignment.questions_per_topic loop
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
          existing_assignment.id,
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
  end loop;
end;
$$;
