-- Remember a participant's Northern Challenge choice.
-- Adds a column only. Does not remove existing data.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS challenge_join text;
