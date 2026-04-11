-- Move too_heavy tracking from exercise-level to set-level
-- Each individual set can now be marked as "too heavy" / failed
alter table set_entries add column if not exists too_heavy boolean default false;
