-- A participant can set the name shown on the site. Sign-in keeps that name.
-- Adds one column. Does not delete or change existing rows' names.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS name_edited boolean NOT NULL DEFAULT false;
