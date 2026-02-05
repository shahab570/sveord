-- Migrate CEFR levels and remove legacy list columns (Kelly/Frequency/Sidor/FT)
begin;

-- 1) Backfill CEFR level in word_data from kelly_level when missing
update public.words
set word_data = coalesce(word_data, '{}'::jsonb)
  || jsonb_build_object('cefr_level', kelly_level)
where kelly_level is not null
  and (
    word_data is null
    or (word_data ->> 'cefr_level') is null
    or (trim(word_data ->> 'cefr_level') = '')
  );

-- 2) Remove FT markers from JSON payloads
update public.words
set word_data = case
  when word_data ? 'is_ft' then (word_data - 'is_ft')
  else word_data
end;

-- 3) Drop legacy columns no longer used
alter table public.words drop column if exists kelly_level;
alter table public.words drop column if exists kelly_source_id;
alter table public.words drop column if exists frequency_rank;
alter table public.words drop column if exists sidor_rank;
alter table public.words drop column if exists sidor_source_id;

commit;
