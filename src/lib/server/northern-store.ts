import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { HackatimeTokens } from './hackatime.ts';

export type HackatimeConnection = {
	email: string;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number | null;
	githubUsername: string | null;
};

export type SubmissionRow = {
	id: number;
	email: string;
	projectName: string;
	description: string;
	repoUrl: string;
	demoUrl: string;
	screenshotName: string | null;
	hackatimeProject: string;
	hackatimeSeconds: number;
	createdAt: string;
};

export function saveHackatimeConnection(
	db: DatabaseSync,
	email: string,
	tokens: HackatimeTokens,
	profile: { id: string | null; githubUsername: string | null },
	now = Date.now()
) {
	const expiresAt = tokens.expiresIn == null ? null : now + tokens.expiresIn * 1000;
	db.prepare(
		`INSERT INTO hackatime_connections
			(email, access_token, refresh_token, expires_at, scope, hackatime_user_id, github_username, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(email) DO UPDATE SET
			access_token = excluded.access_token,
			refresh_token = excluded.refresh_token,
			expires_at = excluded.expires_at,
			scope = excluded.scope,
			hackatime_user_id = excluded.hackatime_user_id,
			github_username = excluded.github_username,
			updated_at = excluded.updated_at`
	).run(
		email,
		tokens.accessToken,
		tokens.refreshToken,
		expiresAt,
		tokens.scope,
		profile.id,
		profile.githubUsername,
		new Date(now).toISOString()
	);
}

export function updateHackatimeTokens(db: DatabaseSync, email: string, tokens: HackatimeTokens, now = Date.now()) {
	const expiresAt = tokens.expiresIn == null ? null : now + tokens.expiresIn * 1000;
	db.prepare(
		`UPDATE hackatime_connections
		 SET access_token = ?, refresh_token = ?, expires_at = ?, scope = ?, updated_at = ?
		 WHERE email = ?`
	).run(
		tokens.accessToken,
		tokens.refreshToken,
		expiresAt,
		tokens.scope,
		new Date(now).toISOString(),
		email
	);
}

export function readHackatimeConnection(db: DatabaseSync, email: string): HackatimeConnection | null {
	const row = db
		.prepare(
			`SELECT email, access_token, refresh_token, expires_at, github_username
			 FROM hackatime_connections WHERE email = ?`
		)
		.get(email);
	if (!row || typeof row.access_token !== 'string') return null;
	return {
		email: String(row.email),
		accessToken: row.access_token,
		refreshToken: typeof row.refresh_token === 'string' ? row.refresh_token : null,
		expiresAt: typeof row.expires_at === 'number' ? row.expires_at : null,
		githubUsername: typeof row.github_username === 'string' ? row.github_username : null
	};
}

export function insertSubmission(
	db: DatabaseSync,
	row: Omit<SubmissionRow, 'id' | 'createdAt'> & { createdAt?: string }
): number {
	const createdAt = row.createdAt ?? new Date().toISOString();
	const result = db
		.prepare(
			`INSERT INTO northern_submissions
				(email, project_name, description, repo_url, demo_url, screenshot_name, hackatime_project, hackatime_seconds, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			row.email,
			row.projectName,
			row.description,
			row.repoUrl,
			row.demoUrl,
			row.screenshotName,
			row.hackatimeProject,
			row.hackatimeSeconds,
			createdAt
		);
	return Number(result.lastInsertRowid);
}

export function listSubmissions(db: DatabaseSync): SubmissionRow[] {
	const rows = db
		.prepare(
			`SELECT id, email, project_name, description, repo_url, demo_url, screenshot_name,
			        hackatime_project, hackatime_seconds, created_at
			 FROM northern_submissions
			 ORDER BY created_at DESC, id DESC
			 LIMIT 200`
		)
		.all();
	return rows.map((row) => ({
		id: Number(row.id),
		email: String(row.email),
		projectName: String(row.project_name),
		description: String(row.description),
		repoUrl: String(row.repo_url),
		demoUrl: String(row.demo_url),
		screenshotName: typeof row.screenshot_name === 'string' ? row.screenshot_name : null,
		hackatimeProject: String(row.hackatime_project),
		hackatimeSeconds: Number(row.hackatime_seconds),
		createdAt: String(row.created_at)
	}));
}

const SCREENSHOT = /^[a-f0-9]{32}\.(png|jpe?g|webp)$/;

export function screenshotNameOk(name: string): boolean {
	return SCREENSHOT.test(name);
}

export function sniffImage(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | null {
	if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return 'png';
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'webp';
	}
	return null;
}

export async function saveScreenshot(dir: string, bytes: Uint8Array): Promise<string | null> {
	const kind = sniffImage(bytes);
	if (!kind) return null;
	const name = `${randomBytes(16).toString('hex')}.${kind === 'jpg' ? 'jpg' : kind}`;
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), bytes);
	return name;
}
