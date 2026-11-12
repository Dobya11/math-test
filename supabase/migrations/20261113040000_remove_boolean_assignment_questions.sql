alter table public.generated_questions
  drop constraint if exists generated_questions_response_mode_check;

update public.generated_questions
set response_mode = 'text'
where response_mode = 'boolean';

alter table public.generated_questions
  alter column response_mode set default 'text',
  alter column response_mode set not null,
  add constraint generated_questions_response_mode_check
    check (response_mode in ('choice', 'text'));

notify pgrst, 'reload schema';
