-- A starter project per participant, and cached Hackatime seconds per ET day.
-- Creates tables only. Does not remove existing data.

CREATE TABLE IF NOT EXISTS participant_projects (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	participant_id bigint NOT NULL UNIQUE REFERENCES participants (id),
	name text NOT NULL,
	description text NOT NULL,
	hackatime_project text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coding_days (
	participant_id bigint NOT NULL REFERENCES participants (id),
	day date NOT NULL,
	seconds integer NOT NULL,
	fetched_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (participant_id, day)
);
