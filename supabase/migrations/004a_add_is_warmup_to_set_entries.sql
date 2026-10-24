-- Phase 4 Migration: Add is_warmup to set_entries

alter table set_entries
  add column if not exists is_warmup boolean default false;
