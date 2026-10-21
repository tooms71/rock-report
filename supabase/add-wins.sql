-- Run this once in the Supabase SQL editor BEFORE using the new "Wins" question.
-- It adds one empty column and changes no existing data. Safe to re-run.
alter table updates add column if not exists wins text;
