alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = 'user_' || substring(replace(id::text, '-', '') from 1 for 15)
where username is null;

alter table public.profiles
  alter column username set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username ~ '^[a-z0-9_]{3,20}$');
  end if;
end;
$$;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(p_username))
    );
$$;

revoke all on function public.is_username_available(text)
  from public, anon, authenticated;
grant execute on function public.is_username_available(text)
  to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.account_role;
  selected_name text;
  selected_username text;
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
  selected_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if char_length(selected_name) < 2 or char_length(selected_name) > 60 then
    raise exception 'Ім’я має містити від 2 до 60 символів.';
  end if;

  if selected_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username має містити 3–20 латинських літер, цифр або символів _.';
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(username) = selected_username
  ) then
    raise exception 'Цей username вже зайнятий.' using errcode = '23505';
  end if;

  begin
    insert into public.profiles (id, username, display_name, role)
    values (new.id, selected_username, selected_name, selected_role);
  exception
    when unique_violation then
      raise exception 'Цей username вже зайнятий.' using errcode = '23505';
  end;

  return new;
end;
$$;
