create table if not exists public.saved_quizzes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  questions jsonb not null,
  explanations jsonb,
  is_practiced boolean default false,
  created_at timestamptz default now() not null,
  practiced_at timestamptz
);

alter table public.saved_quizzes enable row level security;

create policy "Users can view their own quizzes"
  on public.saved_quizzes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quizzes"
  on public.saved_quizzes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own quizzes"
  on public.saved_quizzes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own quizzes"
  on public.saved_quizzes for delete
  using (auth.uid() = user_id);
