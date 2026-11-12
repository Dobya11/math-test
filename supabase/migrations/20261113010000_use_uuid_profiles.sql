alter table public.profiles
  drop constraint if exists profiles_username_format;

update public.profiles
set username = id::text
where username is distinct from id::text;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

drop function if exists public.is_username_available(text);

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

  insert into public.profiles (id, username, display_name, role)
  values (new.id, new.id::text, selected_name, selected_role);

  return new;
end;
$$;
