-- Participants from Hack Club Auth, and one Hackatime project per person.
-- Creates columns and indexes only. Does not remove existing rows.

CREATE TABLE IF NOT EXISTS participants (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	hack_club_id text NOT NULL UNIQUE,
	email text NOT NULL,
	email_verified boolean NOT NULL DEFAULT false,
	name text,
	first_name text,
	last_name text,
	slack_id text,
	verification_status text,
	ysws_eligible boolean,
	birthday date,
	address_line1 text,
	address_line2 text,
	city text,
	state text,
	country text,
	postal_code text,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS participants_email_idx ON participants (lower(email));

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS participant_id bigint REFERENCES participants (id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS hackatime_user_id text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS airtable_record_id text;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_hackatime_project
	ON submissions (hackatime_user_id, lower(hackatime_project))
	WHERE hackatime_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_participant_project
	ON submissions (participant_id, lower(hackatime_project))
	WHERE participant_id IS NOT NULL;
