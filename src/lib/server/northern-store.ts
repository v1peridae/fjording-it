import { buildAdminHome } from '../admin-charts.ts';
import type { Sql } from './db.ts';
import type { HackatimeTokens } from './hackatime.ts';
import type { CheckResult } from '../review-checks.ts';
import { type Decision, type PipelineStage, type Stage } from '../review-pipeline.ts';

export const NORTHERN_SLUG = 'northern';

export type HackatimeConnection = {
	email: string;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number | null;
	githubUsername: string | null;
	hackatimeUserId: string | null;
};

export async function saveHackatimeConnection(
	db: Sql,
	email: string,
	tokens: HackatimeTokens,
	profile: { id: string | null; githubUsername: string | null },
	now = Date.now()
) {
	const expiresAt = tokens.expiresIn == null ? null : now + tokens.expiresIn * 1000;
	await db.query(
		`INSERT INTO hackatime_connections
			(email, access_token, refresh_token, expires_at, scope, hackatime_user_id, github_username, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 ON CONFLICT (email) DO UPDATE SET
			access_token = excluded.access_token,
			refresh_token = excluded.refresh_token,
			expires_at = excluded.expires_at,
			scope = excluded.scope,
			hackatime_user_id = excluded.hackatime_user_id,
			github_username = excluded.github_username,
			updated_at = excluded.updated_at`,
		[email, tokens.accessToken, tokens.refreshToken, expiresAt, tokens.scope, profile.id, profile.githubUsername, new Date(now).toISOString()]
	);
}

export async function updateHackatimeTokens(db: Sql, email: string, tokens: HackatimeTokens, now = Date.now()) {
	const expiresAt = tokens.expiresIn == null ? null : now + tokens.expiresIn * 1000;
	await db.query(
		`UPDATE hackatime_connections
		 SET access_token = $1, refresh_token = $2, expires_at = $3, scope = $4, updated_at = $5
		 WHERE email = $6`,
		[tokens.accessToken, tokens.refreshToken, expiresAt, tokens.scope, new Date(now).toISOString(), email]
	);
}

export async function readHackatimeConnection(db: Sql, email: string): Promise<HackatimeConnection | null> {
	const { rows } = await db.query(
		`SELECT email, access_token, refresh_token, expires_at, github_username, hackatime_user_id
		 FROM hackatime_connections WHERE email = $1`,
		[email]
	);
	const row = rows[0];
	if (!row || typeof row.access_token !== 'string') return null;
	return {
		email: String(row.email),
		accessToken: row.access_token,
		refreshToken: typeof row.refresh_token === 'string' ? row.refresh_token : null,
		expiresAt: typeof row.expires_at === 'number' || typeof row.expires_at === 'string' ? Number(row.expires_at) : null,
		githubUsername: typeof row.github_username === 'string' ? row.github_username : null,
		hackatimeUserId: typeof row.hackatime_user_id === 'string' ? row.hackatime_user_id : null
	};
}

export async function insertSubmission(
	db: Sql,
	row: {
		challenge: string;
		email: string;
		projectName: string;
		description: string;
		repoUrl: string;
		demoUrl: string;
		screenshot: Uint8Array | null;
		screenshotType: string | null;
		hackatimeProject: string;
		hackatimeSeconds: number;
	}
): Promise<number> {
	const { rows } = await db.query(
		`INSERT INTO submissions
			(challenge, email, project_name, description, repo_url, demo_url, screenshot, screenshot_type, hackatime_project, hackatime_seconds)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id`,
		[
			row.challenge,
			row.email,
			row.projectName,
			row.description,
			row.repoUrl,
			row.demoUrl,
			row.screenshot,
			row.screenshotType,
			row.hackatimeProject,
			row.hackatimeSeconds
		]
	);
	return Number(rows[0]?.id);
}

export type QueueFilters = {
	challenge?: string;
	stage?: string;
	status?: string;
	q?: string;
	sort?: 'submitted_desc' | 'submitted_asc' | 'hours_desc' | 'hours_asc' | 'flags_desc';
};

const SORTS = {
	submitted_desc: 's.created_at DESC',
	submitted_asc: 's.created_at ASC',
	hours_desc: 's.hackatime_seconds DESC',
	hours_asc: 's.hackatime_seconds ASC',
	flags_desc: 'flag_count DESC, s.created_at DESC'
} as const;

export async function listQueue(db: Sql, filters: QueueFilters) {
	const where: string[] = [];
	const values: unknown[] = [];
	const add = (sql: string, value: unknown) => {
		values.push(value);
		where.push(sql.replace('?', `$${values.length}`));
	};
	if (filters.challenge) add('s.challenge = ?', filters.challenge);
	if (filters.stage) add('s.stage = ?', filters.stage);
	if (filters.status) add('s.status = ?', filters.status);
	if (filters.q) {
		values.push(`%${filters.q.replace(/[%_]/g, '')}%`);
		const n = `$${values.length}`;
		const idMatch = /^\d+$/.test(filters.q) ? ` OR s.id::text = ${n}` : '';
		where.push(
			`(s.project_name ILIKE ${n} OR s.email ILIKE ${n} OR s.hackatime_project ILIKE ${n} OR s.repo_url ILIKE ${n}${idMatch})`
		);
	}
	const sort = SORTS[filters.sort ?? 'submitted_desc'] ?? SORTS.submitted_desc;
	const { rows } = await db.query(
		`SELECT s.id, s.challenge, c.name AS challenge_name, s.email, s.project_name, s.hackatime_project, s.hackatime_seconds,
		        s.override_hours, s.stage, s.status, s.created_at,
		        COALESCE(f.flags, '') AS flags,
		        COALESCE(f.flag_count, 0) AS flag_count
		 FROM submissions s
		 JOIN challenges c ON c.slug = s.challenge
		 LEFT JOIN LATERAL (
			SELECT string_agg(kind, ',') AS flags, count(*)::int AS flag_count
			FROM (
				SELECT DISTINCT ON (kind) kind, flag
				FROM submission_checks
				WHERE submission_id = s.id
				ORDER BY kind, ran_at DESC
			) latest
			WHERE flag = 'flag'
		 ) f ON true
		 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 ORDER BY ${sort}, s.id DESC
		 LIMIT 200`,
		values
	);
	return rows.map(mapQueue);
}

function mapQueue(row: Record<string, unknown>) {
	return {
		id: Number(row.id),
		challenge: String(row.challenge),
		challengeName: String(row.challenge_name ?? row.challenge),
		email: String(row.email),
		projectName: String(row.project_name),
		hackatimeProject: String(row.hackatime_project),
		hackatimeSeconds: Number(row.hackatime_seconds),
		overrideHours: row.override_hours == null ? null : Number(row.override_hours),
		stage: String(row.stage),
		status: String(row.status),
		createdAt: new Date(String(row.created_at)).toISOString(),
		flags: String(row.flags ?? '')
			.split(',')
			.filter(Boolean)
	};
}

export async function stageCounts(db: Sql) {
	const { rows } = await db.query(
		`SELECT stage, count(*)::int AS count FROM submissions GROUP BY stage`
	);
	const counts = { first_pass: 0, fraud: 0, hq: 0, done: 0 };
	for (const row of rows) {
		const stage = String(row.stage) as keyof typeof counts;
		if (stage in counts) counts[stage] = Number(row.count);
	}
	return counts;
}

export async function listChallenges(db: Sql) {
	const { rows } = await db.query(`SELECT slug, name, starts_at, ends_at FROM challenges ORDER BY starts_at`);
	return rows.map((row) => ({
		slug: String(row.slug),
		name: String(row.name),
		startsAt: new Date(String(row.starts_at)).toISOString(),
		endsAt: new Date(String(row.ends_at)).toISOString()
	}));
}

export async function getSubmission(db: Sql, id: number) {
	const { rows } = await db.query(
		`SELECT s.*, c.name AS challenge_name, c.starts_at, c.ends_at
		 FROM submissions s JOIN challenges c ON c.slug = s.challenge
		 WHERE s.id = $1`,
		[id]
	);
	const row = rows[0];
	if (!row) return null;
	return {
		id: Number(row.id),
		challenge: String(row.challenge),
		challengeName: String(row.challenge_name),
		startsAt: new Date(String(row.starts_at)).toISOString(),
		endsAt: new Date(String(row.ends_at)).toISOString(),
		email: String(row.email),
		projectName: String(row.project_name),
		description: String(row.description),
		repoUrl: String(row.repo_url),
		demoUrl: String(row.demo_url),
		screenshotType: typeof row.screenshot_type === 'string' ? row.screenshot_type : null,
		hasScreenshot: row.screenshot != null,
		hackatimeProject: String(row.hackatime_project),
		hackatimeSeconds: Number(row.hackatime_seconds),
		overrideHours: row.override_hours == null ? null : Number(row.override_hours),
		stage: String(row.stage) as PipelineStage,
		status: String(row.status),
		createdAt: new Date(String(row.created_at)).toISOString()
	};
}

export async function submissionScreenshot(db: Sql, id: number) {
	const { rows } = await db.query(`SELECT screenshot, screenshot_type FROM submissions WHERE id = $1`, [id]);
	const row = rows[0];
	if (!row || row.screenshot == null || typeof row.screenshot_type !== 'string') return null;
	const raw = row.screenshot;
	const bytes = raw instanceof Uint8Array ? raw : new Uint8Array();
	return { bytes, type: row.screenshot_type };
}

export async function otherClaims(db: Sql, id: number, project: string) {
	const { rows } = await db.query(
		`SELECT id, challenge, email, hackatime_seconds
		 FROM submissions
		 WHERE id <> $1 AND lower(hackatime_project) = lower($2)`,
		[id, project]
	);
	return rows.map((row) => ({
		id: Number(row.id),
		challenge: String(row.challenge),
		email: String(row.email),
		seconds: Number(row.hackatime_seconds)
	}));
}

export async function recordReview(
	db: Sql,
	input: {
		submissionId: number;
		stage: Stage;
		reviewerEmail: string;
		decision: Decision;
		note: string | null;
		lapseLinks: string[];
		technicalFeatures: string | null;
		deflationJustification: string | null;
		alternateTracking: string | null;
		additionalJustification: string | null;
		overrideHours: number | null;
		nextStage: PipelineStage;
		nextStatus: string;
	}
): Promise<number> {
	const { rows } = await db.query(
		`INSERT INTO submission_reviews
			(submission_id, stage, reviewer_email, decision, note, lapse_links, technical_features,
			 deflation_justification, alternate_tracking, additional_justification, override_hours)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id`,
		[
			input.submissionId,
			input.stage,
			input.reviewerEmail,
			input.decision,
			input.note,
			input.lapseLinks,
			input.technicalFeatures,
			input.deflationJustification,
			input.alternateTracking,
			input.additionalJustification,
			input.overrideHours
		]
	);
	const reviewId = Number(rows[0]?.id);
	await db.query(
		`UPDATE submissions
		 SET stage = $2, status = $3, override_hours = CASE WHEN $4 THEN $5 ELSE override_hours END
		 WHERE id = $1`,
		[input.submissionId, input.nextStage, input.nextStatus, input.stage === 'first_pass', input.overrideHours]
	);
	if (input.nextStage === 'done' && input.nextStatus === 'confirmed') {
		await db.query(
			`INSERT INTO airtable_outbox (submission_id, review_id, status) VALUES ($1, $2, 'pending')`,
			[input.submissionId, reviewId]
		);
	}
	return reviewId;
}

export async function listReviews(db: Sql, submissionId: number) {
	const { rows } = await db.query(
		`SELECT id, stage, reviewer_email, decision, note, lapse_links, technical_features,
		        deflation_justification, alternate_tracking, additional_justification, override_hours, created_at
		 FROM submission_reviews WHERE submission_id = $1 ORDER BY created_at`,
		[submissionId]
	);
	return rows.map((row) => ({
		id: Number(row.id),
		stage: String(row.stage),
		reviewerEmail: String(row.reviewer_email),
		decision: String(row.decision),
		note: typeof row.note === 'string' ? row.note : '',
		lapseLinks: Array.isArray(row.lapse_links) ? row.lapse_links.map(String) : [],
		technicalFeatures: text(row.technical_features),
		deflationJustification: text(row.deflation_justification),
		alternateTracking: text(row.alternate_tracking),
		additionalJustification: text(row.additional_justification),
		overrideHours: row.override_hours == null ? null : Number(row.override_hours),
		createdAt: new Date(String(row.created_at)).toISOString()
	}));
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

export async function saveChecks(db: Sql, submissionId: number, checks: CheckResult[]) {
	for (const check of checks) {
		await db.query(
			`INSERT INTO submission_checks (submission_id, kind, flag, summary, evidence)
			 VALUES ($1,$2,$3,$4,$5::jsonb)`,
			[submissionId, check.kind, check.flag, check.summary, JSON.stringify(check.evidence)]
		);
	}
}

export async function latestChecks(db: Sql, submissionId: number) {
	const { rows } = await db.query(
		`SELECT DISTINCT ON (kind) kind, flag, summary, evidence, ran_at
		 FROM submission_checks WHERE submission_id = $1
		 ORDER BY kind, ran_at DESC`,
		[submissionId]
	);
	return rows.map((row) => ({
		kind: String(row.kind),
		flag: String(row.flag) as CheckResult['flag'],
		summary: String(row.summary),
		evidence: Array.isArray(row.evidence) ? (row.evidence as CheckResult['evidence']) : [],
		ranAt: new Date(String(row.ran_at)).toISOString()
	}));
}

export async function latestOutbox(db: Sql, submissionId: number) {
	const { rows } = await db.query(
		`SELECT id, status, attempts, last_error, airtable_record_id, updated_at
		 FROM airtable_outbox WHERE submission_id = $1 ORDER BY id DESC LIMIT 1`,
		[submissionId]
	);
	const row = rows[0];
	if (!row) return null;
	return {
		id: Number(row.id),
		status: String(row.status),
		attempts: Number(row.attempts),
		lastError: typeof row.last_error === 'string' ? row.last_error : '',
		airtableRecordId: typeof row.airtable_record_id === 'string' ? row.airtable_record_id : null,
		updatedAt: new Date(String(row.updated_at)).toISOString()
	};
}

export async function markOutbox(
	db: Sql,
	id: number,
	patch: { status: string; lastError: string | null; airtableRecordId?: string | null }
) {
	await db.query(
		`UPDATE airtable_outbox
		 SET status = $2, attempts = attempts + 1, last_error = $3,
		     airtable_record_id = COALESCE($4, airtable_record_id), updated_at = now()
		 WHERE id = $1`,
		[id, patch.status, patch.lastError, patch.airtableRecordId ?? null]
	);
}

export async function reviewerStages(db: Sql, email: string): Promise<Stage[]> {
	const { rows } = await db.query(`SELECT stage FROM reviewer_stages WHERE email = $1 ORDER BY stage`, [email]);
	return rows.map((row) => String(row.stage) as Stage);
}

export async function listReviewers(db: Sql) {
	const { rows } = await db.query(
		`SELECT r.email, r.created_at, COALESCE(array_agg(s.stage) FILTER (WHERE s.stage IS NOT NULL), '{}') AS stages
		 FROM reviewers r LEFT JOIN reviewer_stages s ON s.email = r.email
		 GROUP BY r.email, r.created_at
		 ORDER BY r.email`
	);
	return rows.map((row) => ({
		email: String(row.email),
		createdAt: new Date(String(row.created_at)).toISOString(),
		stages: Array.isArray(row.stages) ? row.stages.map(String) : []
	}));
}

export async function saveReviewer(db: Sql, actor: string, email: string, stages: Stage[]) {
	const existing = await reviewerStages(db, email);
	await db.query(`INSERT INTO reviewers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
	await db.query(`DELETE FROM reviewer_stages WHERE email = $1`, [email]);
	for (const stage of stages) {
		await db.query(`INSERT INTO reviewer_stages (email, stage) VALUES ($1, $2)`, [email, stage]);
	}
	const action = existing.length === 0 ? 'added' : 'stages_changed';
	await db.query(
		`INSERT INTO reviewer_audit (actor_email, action, reviewer_email, stages) VALUES ($1,$2,$3,$4)`,
		[actor, action, email, stages]
	);
}

export async function removeReviewer(db: Sql, actor: string, email: string) {
	const stages = await reviewerStages(db, email);
	await db.query(
		`INSERT INTO reviewer_audit (actor_email, action, reviewer_email, stages) VALUES ($1,'removed',$2,$3)`,
		[actor, email, stages]
	);
	await db.query(`DELETE FROM reviewer_stages WHERE email = $1`, [email]);
	await db.query(`DELETE FROM reviewers WHERE email = $1`, [email]);
}

export async function listReviewerAudit(db: Sql) {
	const { rows } = await db.query(
		`SELECT actor_email, action, reviewer_email, stages, created_at
		 FROM reviewer_audit ORDER BY created_at DESC LIMIT 50`
	);
	return rows.map((row) => ({
		actorEmail: String(row.actor_email),
		action: String(row.action),
		reviewerEmail: String(row.reviewer_email),
		stages: Array.isArray(row.stages) ? row.stages.map(String) : [],
		createdAt: new Date(String(row.created_at)).toISOString()
	}));
}

export async function reviewerStats(db: Sql, from: Date | null, to: Date | null) {
	const { rows } = await db.query(
		`SELECT r.reviewer_email, r.stage, r.decision, r.created_at, s.created_at AS submitted_at,
		        (SELECT max(p.created_at) FROM submission_reviews p
		         WHERE p.submission_id = r.submission_id AND p.created_at < r.created_at) AS previous_at
		 FROM submission_reviews r
		 JOIN submissions s ON s.id = r.submission_id
		 WHERE ($1::timestamptz IS NULL OR r.created_at >= $1)
		   AND ($2::timestamptz IS NULL OR r.created_at < $2)`,
		[from?.toISOString() ?? null, to?.toISOString() ?? null]
	);
	return rows.map((row) => ({
		email: String(row.reviewer_email),
		stage: String(row.stage),
		decision: String(row.decision),
		createdAt: new Date(String(row.created_at)).getTime(),
		startedAt: new Date(String(row.previous_at ?? row.submitted_at)).getTime()
	}));
}

export async function queueFacets(db: Sql, challenge: string) {
	const values = challenge ? [challenge] : [];
	const where = challenge ? 'WHERE challenge = $1' : '';
	const flagWhere = challenge ? 'AND s.challenge = $1' : '';
	const [cells, challenges, flagged] = await Promise.all([
		db.query(`SELECT stage, status, count(*)::int AS count FROM submissions ${where} GROUP BY stage, status`, values),
		db.query(
			`SELECT c.slug, c.name, count(s.id)::int AS count
			 FROM challenges c LEFT JOIN submissions s ON s.challenge = c.slug
			 GROUP BY c.slug, c.name, c.starts_at ORDER BY c.starts_at`
		),
		db.query(
			`SELECT count(DISTINCT latest.submission_id)::int AS count FROM (
				SELECT DISTINCT ON (submission_id, kind) submission_id, kind, flag
				FROM submission_checks ORDER BY submission_id, kind, ran_at DESC
			) latest
			JOIN submissions s ON s.id = latest.submission_id
			WHERE latest.flag = 'flag' ${flagWhere}`,
			values
		)
	]);
	return {
		cells: cells.rows.map((row) => ({
			stage: String(row.stage),
			status: String(row.status),
			count: Number(row.count)
		})),
		challenges: challenges.rows.map((row) => ({
			slug: String(row.slug),
			name: String(row.name),
			count: Number(row.count)
		})),
		flagged: Number(flagged.rows[0]?.count ?? 0)
	};
}

export async function loadAdminHome(db: Sql) {
	const [challenges, submissions, confirms, flags, runs, reviews, outbox] = await Promise.all([
		db.query(`SELECT slug, name FROM challenges ORDER BY starts_at`),
		db.query(
			`SELECT id, created_at, challenge, stage, status, email, project_name, hackatime_seconds, override_hours
			 FROM submissions`
		),
		db.query(
			`SELECT DISTINCT ON (r.submission_id) r.submission_id, r.created_at,
			        COALESCE(s.override_hours, s.hackatime_seconds / 3600.0) AS hours
			 FROM submission_reviews r
			 JOIN submissions s ON s.id = r.submission_id
			 WHERE r.decision = 'confirmed'
			 ORDER BY r.submission_id, r.created_at DESC`
		),
		db.query(
			`SELECT submission_id, kind FROM (
				SELECT DISTINCT ON (submission_id, kind) submission_id, kind, flag
				FROM submission_checks ORDER BY submission_id, kind, ran_at DESC
			) latest WHERE flag = 'flag'`
		),
		db.query(
			`SELECT kind, count(*) FILTER (WHERE flag = 'flag')::int AS flagged, count(*)::int AS ran
			 FROM (
				SELECT DISTINCT ON (submission_id, kind) kind, flag
				FROM submission_checks ORDER BY submission_id, kind, ran_at DESC
			) latest GROUP BY kind ORDER BY kind`
		),
		db.query(`SELECT created_at, reviewer_email FROM submission_reviews`),
		db.query(
			`SELECT status, count(*)::int AS count FROM (
				SELECT DISTINCT ON (submission_id) status FROM airtable_outbox ORDER BY submission_id, id DESC
			) latest GROUP BY status`
		)
	]);
	const outboxCount = (status: string) =>
		outbox.rows.filter((row) => String(row.status) === status).reduce((sum, row) => sum + Number(row.count), 0);
	return buildAdminHome({
		challenges: challenges.rows.map((row) => ({ slug: String(row.slug), name: String(row.name) })),
		submissions: submissions.rows.map((row) => ({
			id: Number(row.id),
			at: new Date(String(row.created_at)).toISOString(),
			challenge: String(row.challenge),
			stage: String(row.stage),
			status: String(row.status),
			email: String(row.email),
			projectName: String(row.project_name),
			seconds: Number(row.hackatime_seconds),
			overrideHours: row.override_hours == null ? null : Number(row.override_hours)
		})),
		confirms: confirms.rows.map((row) => ({
			at: new Date(String(row.created_at)).toISOString(),
			hours: Number(row.hours),
			submissionId: Number(row.submission_id)
		})),
		flags: flags.rows.map((row) => ({ submissionId: Number(row.submission_id), kind: String(row.kind) })),
		flagRuns: runs.rows.map((row) => ({
			kind: String(row.kind),
			flagged: Number(row.flagged),
			ran: Number(row.ran)
		})),
		reviews: reviews.rows.map((row) => ({
			at: new Date(String(row.created_at)).toISOString(),
			email: String(row.reviewer_email)
		})),
		unsynced: outbox.rows
			.filter((row) => String(row.status) !== 'synced')
			.reduce((sum, row) => sum + Number(row.count), 0),
		synced: outboxCount('synced')
	});
}
