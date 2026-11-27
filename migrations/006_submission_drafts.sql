-- A partial submit form per participant. Creates the table only.

CREATE TABLE IF NOT EXISTS submission_drafts (
	participant_id bigint PRIMARY KEY REFERENCES participants (id),
	project text NOT NULL DEFAULT '',
	description text NOT NULL DEFAULT '',
	repo text NOT NULL DEFAULT '',
	demo text NOT NULL DEFAULT '',
	updated_at timestamptz NOT NULL DEFAULT now()
);
