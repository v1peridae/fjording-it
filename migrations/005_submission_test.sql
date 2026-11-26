-- Marks submissions made by presubmit testers so stats can leave them out.
-- Adds a column only. Does not remove existing rows.

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
