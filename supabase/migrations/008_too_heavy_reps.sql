-- Track how many reps were actually achieved when a set was marked too heavy
ALTER TABLE set_entries
  ADD COLUMN IF NOT EXISTS too_heavy_reps integer DEFAULT NULL;
