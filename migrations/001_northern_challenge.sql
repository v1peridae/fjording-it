-- Postgres is the source of truth for challenges, submissions, reviews, checks, and Airtable sync.
-- Creates tables only. Does not remove existing data.

CREATE TABLE IF NOT EXISTS challenges (
	slug text PRIMARY KEY,
	name text NOT NULL,
	starts_at timestamptz NOT NULL,
	ends_at timestamptz NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO challenges (slug, name, starts_at, ends_at)
VALUES ('northern', 'The Northern Challenge', '2026-11-27T05:00:00Z', '2026-12-07T04:59:00Z')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS hackatime_connections (
	email text PRIMARY KEY,
	access_token text NOT NULL,
	refresh_token text,
	expires_at bigint,
	scope text,
	hackatime_user_id text,
	github_username text,
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviewers (
	email text PRIMARY KEY,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviewer_stages (
	email text NOT NULL REFERENCES reviewers (email),
	stage text NOT NULL,
	PRIMARY KEY (email, stage),
	CONSTRAINT reviewer_stages_stage CHECK (stage IN ('first_pass', 'fraud', 'hq'))
);

CREATE TABLE IF NOT EXISTS reviewer_audit (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	actor_email text NOT NULL,
	action text NOT NULL,
	reviewer_email text NOT NULL,
	stages text[] NOT NULL DEFAULT '{}',
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT reviewer_audit_action CHECK (action IN ('added', 'removed', 'stages_changed'))
);

CREATE TABLE IF NOT EXISTS submissions (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	challenge text NOT NULL REFERENCES challenges (slug),
	email text NOT NULL,
	project_name text NOT NULL,
	description text NOT NULL,
	repo_url text NOT NULL,
	demo_url text NOT NULL,
	screenshot bytea,
	screenshot_type text,
	hackatime_project text NOT NULL,
	hackatime_seconds integer NOT NULL,
	stage text NOT NULL DEFAULT 'first_pass',
	status text NOT NULL DEFAULT 'pending',
	override_hours numeric,
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT submissions_stage CHECK (stage IN ('first_pass', 'fraud', 'hq', 'done')),
	CONSTRAINT submissions_status CHECK (
		status IN ('pending', 'approved', 'rejected', 'needs_changes', 'clear', 'fraud', 'needs_info', 'confirmed', 'sent_back')
	),
	CONSTRAINT submissions_screenshot_size CHECK (screenshot IS NULL OR octet_length(screenshot) <= 5000000)
);

CREATE INDEX IF NOT EXISTS submissions_queue_idx ON submissions (stage, challenge, status, created_at DESC);

CREATE TABLE IF NOT EXISTS submission_reviews (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	submission_id bigint NOT NULL REFERENCES submissions (id),
	stage text NOT NULL,
	reviewer_email text NOT NULL,
	decision text NOT NULL,
	note text,
	lapse_links text[] NOT NULL DEFAULT '{}',
	technical_features text,
	deflation_justification text,
	alternate_tracking text,
	additional_justification text,
	override_hours numeric,
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT submission_reviews_stage CHECK (stage IN ('first_pass', 'fraud', 'hq'))
);

CREATE INDEX IF NOT EXISTS submission_reviews_submission_idx ON submission_reviews (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submission_reviews_reviewer_idx ON submission_reviews (reviewer_email, created_at DESC);

CREATE TABLE IF NOT EXISTS submission_checks (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	submission_id bigint NOT NULL REFERENCES submissions (id),
	kind text NOT NULL,
	flag text NOT NULL,
	summary text NOT NULL,
	evidence jsonb NOT NULL,
	ran_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT submission_checks_flag CHECK (flag IN ('clear', 'flag', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS submission_checks_latest_idx ON submission_checks (submission_id, kind, ran_at DESC);

CREATE TABLE IF NOT EXISTS airtable_outbox (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	submission_id bigint NOT NULL REFERENCES submissions (id),
	review_id bigint REFERENCES submission_reviews (id),
	status text NOT NULL DEFAULT 'pending',
	attempts integer NOT NULL DEFAULT 0,
	last_error text,
	airtable_record_id text,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT airtable_outbox_status CHECK (status IN ('pending', 'synced', 'error', 'not_configured'))
);

CREATE INDEX IF NOT EXISTS airtable_outbox_status_idx ON airtable_outbox (status, created_at);
