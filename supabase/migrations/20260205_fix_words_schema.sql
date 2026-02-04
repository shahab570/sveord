-- Normalize 'words' table PK/sequence and enforce uniqueness by swedish_word
-- Thorough fix to stop duplicate primary key errors and ensure deterministic inserts
-- Safe to run multiple times due to IF NOT EXISTS guards and pre-dedup steps

begin;

-- 1) Lowercase normalization trigger to keep swedish_word consistent
create or replace function public.normalize_swedish_word()
returns trigger as $$
begin
  if new.swedish_word is not null then
    new.swedish_word := lower(new.swedish_word);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists words_normalize_swedish_word on public.words;
create trigger words_normalize_swedish_word
before insert or update on public.words
for each row execute procedure public.normalize_swedish_word();

-- 2) Ensure swedish_word is not null
alter table public.words
  alter column swedish_word set not null;

-- 3) Deduplicate by swedish_word: re-point progress to the kept id, then delete extras
with map as (
  select swedish_word, min(id) as keep_id
  from public.words
  group by swedish_word
  having count(*) > 1
)
update public.user_progress
set word_id = map.keep_id
from map
where user_progress.word_id in (
  select w.id from public.words w where w.swedish_word = map.swedish_word
) and user_progress.word_id <> map.keep_id;

with dups as (
  select w.id
  from public.words w
  join (
    select swedish_word, min(id) as keep_id
    from public.words
    group by swedish_word
    having count(*) > 1
  ) m on w.swedish_word = m.swedish_word
  where w.id <> m.keep_id
)
delete from public.words
where id in (select id from dups);

-- 4) Add unique index on swedish_word (case-insensitive handled by trigger)
create unique index if not exists words_swedish_word_unique on public.words (swedish_word);

-- 5) Reset identity/sequence for id to avoid collisions with existing max(id)
do $$
declare
  max_id bigint;
begin
  select coalesce(max(id), 0) + 1 into max_id from public.words;
  begin
    -- Identity column variant
    execute format('alter table public.words alter column id restart with %s', max_id);
  exception
    when others then
      -- Serial sequence fallback
      perform setval(pg_get_serial_sequence('public.words','id'), max_id, false);
  end;
end $$;

commit;
