-- Add is_warmup flag to set_entries
ALTER TABLE set_entries ADD COLUMN IF NOT EXISTS is_warmup boolean DEFAULT false;
