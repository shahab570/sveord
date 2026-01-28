-- 1. Add email column to profiles for easier identification
alter table profiles add column if not exists email text;

-- 2. Update the trigger to include email for NEW users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, email, is_approved)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.email, -- Save email now
    case 
      when new.email = 'mjsahab570@gmail.com' then true
      else false
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3. Backfill email for EXISTING users
-- We can try to update from auth.users if we have permissions, or just relying on future logins isn't enough for the admin view.
-- This requires high privileges.
update profiles
set email = (select email from auth.users where auth.users.id = profiles.id)
where email is null;

-- 4. Admin RLS Policies
-- Allow admin to UPDATE any profile (to approve them)
create policy "Admin can update any profile"
on profiles
for update
using (
  auth.jwt() ->> 'email' = 'mjsahab570@gmail.com'
);

-- Allow admin to SELECT any profile (to list them)
-- (Already covered by "Public profiles are viewable by everyone" policy usually, 
-- but if we restrict that later, this ensures admin access)
-- create policy "Admin can view all profiles" ... (Access is already public for read, so skipping)
