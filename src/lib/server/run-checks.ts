import { privateEnv } from '#lib/server/private-env.ts';
import { buildReviewSignals, type SignalFacts } from '../review-signals.ts';
import {
	copiedProjectCheck,
	hackatimeLapseCheck,
	heartbeatsFromPayload,
	parseGithubRepo,
	priorExperienceCheck,
	type GithubRepoFacts,
	type Heartbeat
} from '../review-checks.ts';
import { HACKATIME_API } from './hackatime.ts';
import { appDatabase } from './app-db.ts';
import { getSubmission, otherClaims, readHackatimeConnection, saveChecks } from './northern-store.ts';

export async function runSubmissionChecks(id: number): Promise<void> {
	const db = await appDatabase();
	const submission = await getSubmission(db, id);
	if (!submission) return;
	const start = new Date(submission.startsAt);
	const end = new Date(submission.endsAt);
	const claims = await otherClaims(db, id, submission.hackatimeProject);
	const github = await loadGithub(submission.repoUrl, start);
	const heartbeats = await loadHeartbeats(submission.email, start, end);
	const before =
		heartbeats.beats?.filter((beat) => beat.project.toLowerCase() === submission.hackatimeProject.toLowerCase() && beat.at < start.getTime())
			.reduce((sum, beat) => sum + beat.seconds, 0) ?? null;

	const checks = [
		priorExperienceCheck({
			repo: github.repo,
			challengeStart: start,
			hackatimeBeforeSeconds: heartbeats.beats ? before : null,
			unavailable: github.unavailable
		}),
		copiedProjectCheck({ repo: github.repo, unavailable: github.unavailable }),
		hackatimeLapseCheck({
			project: submission.hackatimeProject,
			storedSeconds: submission.hackatimeSeconds,
			claims,
			heartbeats: heartbeats.beats,
			challengeStart: start,
			challengeEnd: end,
			unavailable: heartbeats.unavailable
		})
	];
	await saveChecks(db, id, checks);
}

export async function reviewSignalsFor(id: number) {
	const facts = await signalFacts(id);
	return buildReviewSignals(
		facts ?? {
			githubAccountCreated: null,
			publicRepoCount: null,
			priorSubmissions: null,
			fork: null,
			forkParent: null,
			firstCommitAt: null,
			firstCommitAdditions: null,
			earliestCommitBeforeEvent: null,
			commitsBeforeEvent: null,
			duplicateRepoIds: null,
			otherClaims: null,
			secondsBeforeWindow: null,
			secondsAfterWindow: null,
			windowSeconds: null,
			heartbeatOverlaps: null,
			eventStart: null
		}
	);
}

async function signalFacts(id: number): Promise<SignalFacts | null> {
	const db = await appDatabase();
	const submission = await getSubmission(db, id);
	if (!submission) return null;
	const participantId = await participantIdFor(db, id);
	const [prior, duplicates, others, github, heartbeats, windowSeconds] = await Promise.all([
		priorSubmissions(db, id, submission.email, participantId),
		duplicateRepos(db, id, submission.repoUrl),
		otherProjectClaims(db, id, submission.email),
		loadGithub(submission.repoUrl, new Date(submission.startsAt)),
		loadHeartbeats(submission.email, new Date(submission.startsAt), new Date(submission.endsAt)),
		hackatimeWindowSeconds(submission.email, submission.hackatimeProject, new Date(submission.startsAt), new Date(submission.endsAt))
	]);
	const start = new Date(submission.startsAt).getTime();
	const end = new Date(submission.endsAt).getTime();
	const beats = heartbeats.beats;
	const mine = beats?.filter((beat) => beat.project.toLowerCase() === submission.hackatimeProject.toLowerCase()) ?? null;
	const before = mine?.filter((beat) => beat.at < start).reduce((sum, beat) => sum + beat.seconds, 0) ?? null;
	const after = mine?.filter((beat) => beat.at > end).reduce((sum, beat) => sum + beat.seconds, 0) ?? null;
	const overlaps = beats ? overlappingNames(beats, submission.hackatimeProject, start, end) : null;
	const commits = github.repo?.commitsBefore ?? null;
	return {
		githubAccountCreated: github.accountCreated,
		publicRepoCount: github.publicRepos,
		priorSubmissions: prior,
		fork: github.repo ? github.repo.fork : null,
		forkParent: github.repo?.parent ? { name: github.repo.parent.fullName, url: github.repo.parent.url } : null,
		firstCommitAt: github.firstCommitAt,
		firstCommitAdditions: github.repo?.earlyAdditions ?? null,
		earliestCommitBeforeEvent: commits && commits.length ? commits[commits.length - 1].date : commits ? null : null,
		commitsBeforeEvent: commits ? commits.length : null,
		duplicateRepoIds: duplicates,
		otherClaims: others,
		secondsBeforeWindow: before,
		secondsAfterWindow: after,
		windowSeconds,
		heartbeatOverlaps: overlaps,
		eventStart: submission.startsAt
	};
}

async function loadGithub(repoUrl: string, start: Date): Promise<{
	repo: GithubRepoFacts | null;
	unavailable?: string;
	accountCreated: string | null;
	publicRepos: number | null;
	firstCommitAt: string | null;
}> {
	const parsed = parseGithubRepo(repoUrl);
	const empty = { repo: null, accountCreated: null, publicRepos: null, firstCommitAt: null };
	if (!parsed) return empty;
	const repoRes = await gh(`/repos/${parsed.owner}/${parsed.repo}`);
	if (repoRes.status === 403 || repoRes.status === 429) return { ...empty, unavailable: "couldn't check: github rate limit" };
	if (!repoRes.ok || !repoRes.json) return { ...empty, unavailable: `couldn't check: github ${repoRes.status}` };
	const body = repoRes.json as {
		full_name?: string;
		html_url?: string;
		created_at?: string;
		fork?: boolean;
		parent?: { full_name?: string; html_url?: string };
		template_repository?: { full_name?: string; html_url?: string } | null;
	};
	const until = encodeURIComponent(start.toISOString());
	const [commits, contributors, early, search] = await Promise.all([
		gh(`/repos/${parsed.owner}/${parsed.repo}/commits?until=${until}&per_page=5`),
		gh(`/repos/${parsed.owner}/${parsed.repo}/contributors?per_page=10`),
		gh(`/repos/${parsed.owner}/${parsed.repo}/commits?until=${encodeURIComponent(new Date(new Date(body.created_at ?? start).getTime() + 2 * 86400000).toISOString())}&per_page=1`),
		gh(`/search/repositories?q=${encodeURIComponent(`${parsed.repo} in:name`)}&per_page=5`)
	]);
	if (commits.status === 403 || commits.status === 429) return { ...empty, unavailable: "couldn't check: github rate limit" };
	const user = await gh(`/users/${parsed.owner}`);
	const userBody = user.json as { created_at?: string; public_repos?: number } | null;
	const oldest = await oldestCommit(parsed.owner, parsed.repo);
	let earlyAdditions: number | null = null;
	if (oldest) {
		const detail = await gh(`/repos/${parsed.owner}/${parsed.repo}/commits/${oldest.sha}`);
		const additions = (detail.json as { stats?: { additions?: number } } | null)?.stats?.additions;
		if (typeof additions === 'number') earlyAdditions = additions;
	}
	const earlySha = firstSha(early.json);
	if (earlyAdditions == null && earlySha) {
		const detail = await gh(`/repos/${parsed.owner}/${parsed.repo}/commits/${earlySha}`);
		const additions = (detail.json as { stats?: { additions?: number } } | null)?.stats?.additions;
		if (typeof additions === 'number') earlyAdditions = additions;
	}
	const sameName = searchItems(search.json).filter((hit) => hit.fullName.toLowerCase() !== `${parsed.owner}/${parsed.repo}`.toLowerCase());
	return {
		accountCreated: typeof userBody?.created_at === 'string' ? userBody.created_at : null,
		publicRepos: typeof userBody?.public_repos === 'number' ? userBody.public_repos : null,
		firstCommitAt: oldest?.date ?? null,
		repo: {
			fullName: body.full_name ?? `${parsed.owner}/${parsed.repo}`,
			url: body.html_url ?? repoUrl,
			createdAt: body.created_at ?? null,
			fork: body.fork === true,
			parent: body.parent?.full_name && body.parent.html_url ? { fullName: body.parent.full_name, url: body.parent.html_url } : null,
			template:
				body.template_repository?.full_name && body.template_repository.html_url
					? { fullName: body.template_repository.full_name, url: body.template_repository.html_url }
					: null,
			commitsBefore: commitList(commits.json),
			contributors: contributorList(contributors.json),
			earlyAdditions,
			sameName
		}
	};
}

async function loadHeartbeats(email: string, start: Date, end: Date): Promise<{ beats: Heartbeat[] | null; unavailable?: string }> {
	const db = await appDatabase();
	const connection = await readConnection(db, email);
	if (!connection) return { beats: null, unavailable: "couldn't check: hackatime is not connected for this submitter" };
	const query = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
	for (const path of [`/authenticated/heartbeats?${query}`, `/my/heartbeats?${query}`, `/users/current/heartbeats/spans?${query}`]) {
		const res = await fetch(`${HACKATIME_API}${path}`, {
			headers: { authorization: `Bearer ${connection}`, accept: 'application/json' },
			signal: AbortSignal.timeout(8000)
		}).catch(() => null);
		if (!res) continue;
		if (res.status === 404 || res.status === 401) continue;
		if (!res.ok) return { beats: null, unavailable: `couldn't check: hackatime ${res.status}` };
		const beats = heartbeatsFromPayload(await res.json().catch(() => null));
		if (beats) return { beats };
	}
	return { beats: null, unavailable: "couldn't check: hackatime did not return heartbeats" };
}

async function readConnection(db: Awaited<ReturnType<typeof appDatabase>>, email: string) {
	const { rows } = await db.query(`SELECT access_token FROM hackatime_connections WHERE email = $1`, [email]);
	return typeof rows[0]?.access_token === 'string' ? rows[0].access_token : null;
}

async function gh(path: string): Promise<{ status: number; ok: boolean; json: unknown | null; link: string | null }> {
	const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'fjording-it' };
	const githubToken = privateEnv('GITHUB_TOKEN');
	if (githubToken) headers.authorization = `Bearer ${githubToken}`;
	try {
		const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
			headers,
			signal: AbortSignal.timeout(8000)
		});
		const json = await res.json().catch(() => null);
		return { status: res.status, ok: res.ok, json, link: res.headers.get('link') };
	} catch {
		return { status: 0, ok: false, json: null, link: null };
	}
}

async function oldestCommit(owner: string, repo: string): Promise<{ date: string; sha: string } | null> {
	const first = await gh(`/repos/${owner}/${repo}/commits?per_page=1`);
	const last = first.link?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
	const page = last ? await gh(last) : first;
	const row = Array.isArray(page.json) ? page.json.at(-1) : null;
	if (!row || typeof row !== 'object') return null;
	const commit = row as { sha?: string; commit?: { author?: { date?: string } } };
	if (!commit.sha || !commit.commit?.author?.date) return null;
	return { sha: commit.sha, date: commit.commit.author.date };
}

function commitList(json: unknown): { date: string; url: string }[] {
	if (!Array.isArray(json)) return [];
	return json.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const row = item as { html_url?: string; commit?: { author?: { date?: string } } };
		const date = row.commit?.author?.date;
		if (!date) return [];
		return [{ date, url: row.html_url ?? '' }];
	});
}

function contributorList(json: unknown): { login: string; url: string }[] {
	if (!Array.isArray(json)) return [];
	return json.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const row = item as { login?: string; html_url?: string };
		if (!row.login) return [];
		return [{ login: row.login, url: row.html_url ?? '' }];
	});
}

function firstSha(json: unknown): string | null {
	if (!Array.isArray(json) || !json[0] || typeof json[0] !== 'object') return null;
	const sha = (json[0] as { sha?: string }).sha;
	return sha ?? null;
}

async function participantIdFor(db: Awaited<ReturnType<typeof appDatabase>>, id: number) {
	const { rows } = await db.query(`SELECT participant_id FROM submissions WHERE id = $1`, [id]);
	const value = rows[0]?.participant_id;
	return value == null ? null : Number(value);
}

async function priorSubmissions(db: Awaited<ReturnType<typeof appDatabase>>, id: number, email: string, participantId: number | null) {
	const { rows } = await db.query(
		`SELECT id, challenge, project_name FROM submissions
		 WHERE id <> $1 AND (lower(email) = lower($2) OR ($3::bigint IS NOT NULL AND participant_id = $3))
		 ORDER BY id`,
		[id, email, participantId]
	);
	return rows.map((row) => ({ id: Number(row.id), challenge: String(row.challenge), project: String(row.project_name) }));
}

async function duplicateRepos(db: Awaited<ReturnType<typeof appDatabase>>, id: number, repoUrl: string) {
	const { rows } = await db.query(
		`SELECT id FROM submissions WHERE id <> $1 AND lower(repo_url) = lower($2) ORDER BY id`,
		[id, repoUrl]
	);
	return rows.map((row) => Number(row.id));
}

async function otherProjectClaims(db: Awaited<ReturnType<typeof appDatabase>>, id: number, email: string) {
	const { rows } = await db.query(
		`SELECT id, hackatime_project, hackatime_seconds FROM submissions
		 WHERE id <> $1 AND lower(email) = lower($2) AND hackatime_seconds > 0
		 ORDER BY id`,
		[id, email]
	);
	return rows.map((row) => ({
		id: Number(row.id),
		project: String(row.hackatime_project),
		seconds: Number(row.hackatime_seconds)
	}));
}

async function hackatimeWindowSeconds(email: string, project: string, start: Date, end: Date) {
	const db = await appDatabase();
	const token = await readConnection(db, email);
	if (!token) return null;
	const query = `features=projects&start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}`;
	const res = await fetch(`${HACKATIME_API}/authenticated/stats?${query}`, {
		headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
		signal: AbortSignal.timeout(8000)
	}).catch(() => null);
	if (!res || !res.ok) return null;
	const json = (await res.json().catch(() => null)) as { projects?: unknown; data?: { projects?: unknown } } | null;
	const list = json?.projects ?? json?.data?.projects;
	if (!Array.isArray(list)) return null;
	const match = list.find((item) => {
		if (!item || typeof item !== 'object') return false;
		const name = (item as { name?: unknown }).name;
		return typeof name === 'string' && name.toLowerCase() === project.toLowerCase();
	}) as { total_seconds?: unknown } | undefined;
	if (!match) return 0;
	const seconds = Number(match.total_seconds ?? 0);
	return Number.isFinite(seconds) ? seconds : null;
}

function overlappingNames(heartbeats: Heartbeat[], project: string, start: number, end: number) {
	const spans = heartbeats
		.filter((beat) => beat.at >= start && beat.at <= end)
		.map((beat) => ({ project: beat.project, from: beat.at, to: beat.at + beat.seconds * 1000 }));
	const mine = spans.filter((span) => span.project.toLowerCase() === project.toLowerCase());
	const found = new Set<string>();
	for (const left of mine) {
		for (const right of spans) {
			if (right.project.toLowerCase() === project.toLowerCase()) continue;
			if (left.from < right.to && right.from < left.to) found.add(right.project);
		}
	}
	return [...found].map((name) => `${name} overlaps ${project}`);
}

function searchItems(json: unknown): { fullName: string; url: string }[] {
	const items = (json as { items?: unknown } | null)?.items;
	if (!Array.isArray(items)) return [];
	return items.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const row = item as { full_name?: string; html_url?: string };
		if (!row.full_name || !row.html_url) return [];
		return [{ fullName: row.full_name, url: row.html_url }];
	});
}
