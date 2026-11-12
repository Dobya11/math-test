create or replace function public.handle_new_user()
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
