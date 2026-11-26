import { buildAdminHome } from '../admin-charts.ts';
import type { ParticipantIdentity } from '../participant-identity.ts';
import type { Sql } from './db.ts';
import type { HackatimeTokens } from './hackatime.ts';
import type { CheckResult } from '../review-checks.ts';
import { FUNNEL_SQL, funnelFromRow, funnelStages, type FunnelStage } from '../funnel.ts';
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
		 WHERE lower(email) = lower($6)`,
		[tokens.accessToken, tokens.refreshToken, expiresAt, tokens.scope, new Date(now).toISOString(), email]
	);
}

export async function readHackatimeConnection(db: Sql, email: string): Promise<HackatimeConnection | null> {
	const { rows } = await db.query(
		`SELECT email, access_token, refresh_token, expires_at, github_username, hackatime_user_id
		 FROM hackatime_connections WHERE lower(email) = lower($1)`,
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

export type ParticipantRow = {
	id: number;
	hackClubId: string;
	email: string;
	emailVerified: boolean;
	name: string | null;
	firstName: string | null;
	lastName: string | null;
	slackId: string | null;
	verificationStatus: string | null;
	yswsEligible: boolean | null;
	birthday: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	postalCode: string | null;
};

export async function upsertParticipant(db: Sql, identity: ParticipantIdentity): Promise<ParticipantRow> {
	const { rows } = await db.query(
		`INSERT INTO participants
			(hack_club_id, email, email_verified, name, first_name, last_name, slack_id, verification_status,
			 ysws_eligible, birthday, address_line1, address_line2, city, state, country, postal_code)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		 ON CONFLICT (hack_club_id) DO UPDATE SET
			email = excluded.email,
			email_verified = excluded.email_verified,
			name = excluded.name,
			first_name = excluded.first_name,
			last_name = excluded.last_name,
			slack_id = excluded.slack_id,
			verification_status = excluded.verification_status,
			ysws_eligible = excluded.ysws_eligible,
			birthday = COALESCE(excluded.birthday, participants.birthday),
			address_line1 = COALESCE(excluded.address_line1, participants.address_line1),
			address_line2 = COALESCE(excluded.address_line2, participants.address_line2),
			city = COALESCE(excluded.city, participants.city),
			state = COALESCE(excluded.state, participants.state),
			country = COALESCE(excluded.country, participants.country),
			postal_code = COALESCE(excluded.postal_code, participants.postal_code),
			updated_at = now()
		 RETURNING *`,
		[
			identity.hackClubId,
			identity.email,
			identity.emailVerified,
			identity.name,
			identity.firstName,
			identity.lastName,
			identity.slackId,
			identity.verificationStatus,
			identity.yswsEligible,
			identity.birthday,
			identity.address?.line1 ?? null,
			identity.address?.line2 ?? null,
			identity.address?.city ?? null,
			identity.address?.state ?? null,
			identity.address?.country ?? null,
			identity.address?.postalCode ?? null
		]
	);
	return mapParticipant(rows[0]);
}

export type StarterProject = {
	id: number;
	name: string;
	description: string;
	hackatimeProject: string;
};

export async function participantProject(db: Sql, participantId: number): Promise<StarterProject | null> {
	const { rows } = await db.query(
		`SELECT id, name, description, hackatime_project FROM participant_projects WHERE participant_id = $1`,
		[participantId]
	);
	const row = rows[0];
	if (!row) return null;
	return {
		id: Number(row.id),
		name: String(row.name),
		description: String(row.description),
		hackatimeProject: String(row.hackatime_project)
	};
}

export type JoinChoice = 'in' | 'later' | null;

export async function challengeChoice(db: Sql, participantId: number): Promise<JoinChoice> {
	const { rows } = await db.query(`SELECT challenge_join FROM participants WHERE id = $1`, [participantId]);
	const value = rows[0]?.challenge_join;
	return value === 'in' || value === 'later' ? value : null;
}

export async function setChallengeChoice(db: Sql, participantId: number, choice: 'in' | 'later') {
	await db.query(`UPDATE participants SET challenge_join = $2 WHERE id = $1`, [participantId, choice]);
}

export async function saveParticipantProject(
	db: Sql,
	input: { participantId: number; name: string; description: string; hackatimeProject: string }
) {
	await db.query(
		`INSERT INTO participant_projects (participant_id, name, description, hackatime_project)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (participant_id) DO UPDATE SET
		   name = excluded.name,
		   description = excluded.description,
		   hackatime_project = excluded.hackatime_project`,
		[input.participantId, input.name, input.description, input.hackatimeProject]
	);
	await setChallengeChoice(db, input.participantId, 'in');
}

export async function codingSnapshot(db: Sql, today: string) {
	const window = await db.query(
		`SELECT day::text AS day,
		        count(*) FILTER (WHERE seconds > 0)::int AS people,
		        COALESCE(sum(seconds), 0)::int AS seconds
		 FROM coding_days
		 WHERE day BETWEEN '2026-11-27' AND '2026-12-06'
		 GROUP BY day`
	);
	const todayCount = await db.query(
		`SELECT count(*)::int AS count FROM coding_days WHERE day = $1::date AND seconds > 0`,
		[today]
	);
	const signups = await db.query(`SELECT count(*)::int AS count FROM participants`);
	const onboarded = await db.query(`SELECT count(*)::int AS count FROM participant_projects`);
	return {
		rows: window.rows.map((row) => ({
			day: String(row.day).slice(0, 10),
			people: Number(row.people),
			seconds: Number(row.seconds)
		})),
		today: Number(todayCount.rows[0]?.count ?? 0),
		signups: Number(signups.rows[0]?.count ?? 0),
		onboarded: Number(onboarded.rows[0]?.count ?? 0)
	};
}

export async function codingSecondsInWindow(db: Sql, participantId: number): Promise<number | null> {
	const { rows } = await db.query(
		`SELECT COALESCE(sum(seconds), 0)::int AS seconds, count(*)::int AS n
		 FROM coding_days
		 WHERE participant_id = $1 AND day BETWEEN '2026-11-27' AND '2026-12-06'`,
		[participantId]
	);
	if (!rows[0] || Number(rows[0].n) === 0) return null;
	return Number(rows[0].seconds);
}

export async function codingFetchedAt(db: Sql, participantId: number): Promise<number | null> {
	const { rows } = await db.query(`SELECT max(fetched_at) AS at FROM coding_days WHERE participant_id = $1`, [participantId]);
	const at = rows[0]?.at;
	if (!at) return null;
	const time = new Date(String(at)).getTime();
	return Number.isFinite(time) ? time : null;
}

export async function saveCodingDays(db: Sql, participantId: number, days: { day: string; seconds: number }[]) {
	for (const day of days) {
		await db.query(
			`INSERT INTO coding_days (participant_id, day, seconds, fetched_at)
			 VALUES ($1, $2::date, $3, now())
			 ON CONFLICT (participant_id, day) DO UPDATE SET seconds = excluded.seconds, fetched_at = now()`,
			[participantId, day.day, day.seconds]
		);
	}
}

export async function linkedProjects(db: Sql) {
	const { rows } = await db.query(
		`SELECT p.id, p.email, pp.hackatime_project
		 FROM participant_projects pp
		 JOIN participants p ON p.id = pp.participant_id`
	);
	return rows.map((row) => ({
		participantId: Number(row.id),
		email: String(row.email),
		hackatimeProject: String(row.hackatime_project)
	}));
}

export async function participantByHackClubId(db: Sql, hackClubId: string): Promise<ParticipantRow | null> {
	const { rows } = await db.query(`SELECT * FROM participants WHERE hack_club_id = $1`, [hackClubId]);
	return rows[0] ? mapParticipant(rows[0]) : null;
}

export async function participantForSubmission(db: Sql, submissionId: number): Promise<ParticipantRow | null> {
	const { rows } = await db.query(
		`SELECT p.* FROM participants p JOIN submissions s ON s.participant_id = p.id WHERE s.id = $1`,
		[submissionId]
	);
	return rows[0] ? mapParticipant(rows[0]) : null;
}

function mapParticipant(row: Record<string, unknown>): ParticipantRow {
	const date = row.birthday == null ? null : String(row.birthday).slice(0, 10);
	return {
		id: Number(row.id),
		hackClubId: String(row.hack_club_id),
		email: String(row.email),
		emailVerified: row.email_verified === true,
		name: textOrNull(row.name),
		firstName: textOrNull(row.first_name),
		lastName: textOrNull(row.last_name),
		slackId: textOrNull(row.slack_id),
		verificationStatus: textOrNull(row.verification_status),
		yswsEligible: typeof row.ysws_eligible === 'boolean' ? row.ysws_eligible : null,
		birthday: date,
		addressLine1: textOrNull(row.address_line1),
		addressLine2: textOrNull(row.address_line2),
		city: textOrNull(row.city),
		state: textOrNull(row.state),
		country: textOrNull(row.country),
		postalCode: textOrNull(row.postal_code)
	};
}

function textOrNull(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

export async function rememberAirtableRecord(db: Sql, submissionId: number, recordId: string): Promise<void> {
	await db.query(`UPDATE submissions SET airtable_record_id = $2 WHERE id = $1`, [submissionId, recordId]);
	await db.query(
		`UPDATE airtable_outbox SET airtable_record_id = $2, updated_at = now()
		 WHERE id = (SELECT id FROM airtable_outbox WHERE submission_id = $1 ORDER BY id DESC LIMIT 1)`,
		[submissionId, recordId]
	);
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
		participantId?: number | null;
		hackatimeUserId?: string | null;
		isTest?: boolean;
	}
): Promise<number> {
	const { rows } = await db.query(
		`INSERT INTO submissions
			(challenge, email, project_name, description, repo_url, demo_url, screenshot, screenshot_type,
			 hackatime_project, hackatime_seconds, participant_id, hackatime_user_id, is_test)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
			row.hackatimeSeconds,
			row.participantId ?? null,
			row.hackatimeUserId ?? null,
			row.isTest === true
		]
	);
	return Number(rows[0]?.id);
}

/** Flags rows whose email is on the tester allowlist. Does not delete them. */
export async function flagTesterSubmissions(db: Sql, allowlist: string | undefined) {
	const emails = (allowlist ?? '')
		.split(',')
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
	if (!emails.length) return;
	await db.query(
		`UPDATE submissions SET is_test = true
		 WHERE is_test = false AND lower(email) = ANY($1::text[])`,
		[emails]
	);
}

export class HackatimeProjectTaken extends Error {
	constructor() {
		super('that hackatime project was already submitted');
	}
}

export function isUniqueViolation(err: unknown): boolean {
	return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
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
		createdAt: new Date(String(row.created_at)).toISOString(),
		isTest: row.is_test === true
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

export async function loadParticipantFunnel(db: Sql): Promise<{ stages: FunnelStage[]; approvedHours: number }> {
	const { rows } = await db.query(FUNNEL_SQL);
	return funnelStages(funnelFromRow(rows[0] ?? {}));
}

export async function loadAdminHome(db: Sql) {
	const [challenges, submissions, confirms, flags, runs, reviews, outbox] = await Promise.all([
		db.query(`SELECT slug, name FROM challenges ORDER BY starts_at`),
		db.query(
			`SELECT id, created_at, challenge, stage, status, email, project_name, hackatime_seconds, override_hours
			 FROM submissions WHERE is_test = false`
		),
		db.query(
			`SELECT DISTINCT ON (r.submission_id) r.submission_id, r.created_at,
			        COALESCE(s.override_hours, s.hackatime_seconds / 3600.0) AS hours
			 FROM submission_reviews r
			 JOIN submissions s ON s.id = r.submission_id AND s.is_test = false
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
				SELECT DISTINCT ON (o.submission_id) o.status
				FROM airtable_outbox o
				JOIN submissions s ON s.id = o.submission_id AND s.is_test = false
				ORDER BY o.submission_id, o.id DESC
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
