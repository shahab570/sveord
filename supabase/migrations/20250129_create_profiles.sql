-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  first_name text,
  last_name text,
  is_approved boolean default false,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- It also handles the auto-approval for mjsahab@gmail.com
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, is_approved)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    -- Auto-approve specific admin email, deny others by default
    case 
      when new.email = 'mjsahab570@gmail.com' then true
      else false
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for existing users
insert into public.profiles (id, first_name, last_name, is_approved)
select 
  id, 
  raw_user_meta_data->>'first_name', 
  raw_user_meta_data->>'last_name',
  case 
    when email = 'mjsahab570@gmail.com' then true
    else false 
  end
from auth.users
where id not in (select id from public.profiles);

