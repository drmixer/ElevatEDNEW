-- 033_student_profile_autocreate.sql
-- Ensure student signups automatically create student_profiles (and a payer profile), and backfill missing rows.

begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  resolved_role public.user_role;
  resolved_name text;
  first_name text;
  last_name text;
  grade_level int;
  avatar text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if meta_role = 'parent' then
    resolved_role := 'parent'::public.user_role;
  else
    resolved_role := 'student'::public.user_role;
  end if;

  resolved_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  first_name := coalesce(nullif(split_part(resolved_name, ' ', 1), ''), split_part(new.email, '@', 1));
  last_name := nullif(split_part(resolved_name, ' ', 2), '');
  avatar := new.raw_user_meta_data->>'avatar_url';

  begin
    grade_level := nullif(new.raw_user_meta_data->>'grade', '')::int;
    if grade_level is not null and (grade_level < 1 or grade_level > 12) then
      grade_level := null;
    end if;
  exception
    when others then
      grade_level := null;
  end;

  insert into public.profiles (id, role, email, full_name, avatar_url)
  values (new.id, resolved_role, new.email, resolved_name, avatar)
  on conflict (id) do update
    set role = excluded.role,
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;

  if resolved_role = 'parent'::public.user_role then
    insert into public.parent_profiles (id, full_name)
    values (new.id, resolved_name)
    on conflict (id) do update
      set full_name = excluded.full_name;
  end if;

  if resolved_role = 'student'::public.user_role then
    -- Create a payer profile for self-serve students so billing/subscription hooks have an owner.
    insert into public.parent_profiles (id, full_name)
    values (new.id, resolved_name)
    on conflict (id) do update
      set full_name = excluded.full_name;

    insert into public.student_profiles (id, parent_id, first_name, last_name, grade_level, learning_style, avatar_url)
    values (new.id, new.id, first_name, last_name, grade_level, coalesce(new.raw_user_meta_data->'learning_style', '{}'::jsonb), avatar)
    on conflict (id) do update
      set parent_id = excluded.parent_id,
          first_name = excluded.first_name,
          last_name = coalesce(excluded.last_name, student_profiles.last_name),
          grade_level = excluded.grade_level,
          avatar_url = coalesce(excluded.avatar_url, student_profiles.avatar_url);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Backfill: ensure existing student profiles exist for student accounts.
do
$$
declare
  r record;
  fn text;
  ln text;
begin
  for r in
    select p.id, coalesce(p.full_name, p.email) as name, p.email
    from public.profiles p
    where p.role = 'student'
      and not exists (select 1 from public.student_profiles s where s.id = p.id)
  loop
    fn := coalesce(nullif(split_part(r.name, ' ', 1), ''), split_part(r.email, '@', 1));
    ln := nullif(split_part(r.name, ' ', 2), '');

    insert into public.parent_profiles (id, full_name)
    values (r.id, r.name)
    on conflict (id) do nothing;

    insert into public.student_profiles (id, parent_id, first_name, last_name)
    values (r.id, r.id, fn, ln)
    on conflict (id) do nothing;
  end loop;
end
$$;

commit;
