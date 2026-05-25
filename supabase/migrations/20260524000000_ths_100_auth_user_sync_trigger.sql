-- THS-100 — auth → public.users sync trigger
--
-- Context (S29, 2026-05-24): public.users had 1 row while auth.users had 3.
-- Mom (at-turner@sbcglobal.net) and Dad (terryturner@gmail.com) existed in
-- auth.users but were never mirrored to public.users, which would have
-- blocked any RLS-scoped writes (positions, alerts, anything keyed off
-- user_id). Required a manual backfill — this migration prevents the same
-- gap from re-opening on future signups OR future Studio "Add user" actions.
--
-- Idempotent: drops + recreates the function and triggers so the migration
-- can be re-applied to a clean OR already-migrated database without error.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fire when the email actually changed — avoids churn on every
  -- session refresh that touches auth.users.
  if new.email is distinct from old.email then
    update public.users
       set email = new.email
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();
