-- Northern Challenge submissions and Hackatime connections.
-- Additive only. This file does not remove existing tables.

CREATE TABLE IF NOT EXISTS hackatime_connections (
	email TEXT PRIMARY KEY,
	access_token TEXT NOT NULL,
	refresh_token TEXT,
	expires_at INTEGER,
	scope TEXT,
	hackatime_user_id TEXT,
	github_username TEXT,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS northern_submissions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL,
	project_name TEXT NOT NULL,
	description TEXT NOT NULL,
	repo_url TEXT NOT NULL,
	demo_url TEXT NOT NULL,
	screenshot_name TEXT,
	hackatime_project TEXT NOT NULL,
	hackatime_seconds INTEGER NOT NULL,
	created_at TEXT NOT NULL
);
