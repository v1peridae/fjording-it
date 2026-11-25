import { privateEnv } from '#lib/server/private-env.ts';
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

async function loadGithub(repoUrl: string, start: Date): Promise<{ repo: GithubRepoFacts | null; unavailable?: string }> {
	const parsed = parseGithubRepo(repoUrl);
	if (!parsed) return { repo: null };
	const repoRes = await gh(`/repos/${parsed.owner}/${parsed.repo}`);
	if (repoRes.status === 403 || repoRes.status === 429) return { repo: null, unavailable: "couldn't check: github rate limit" };
	if (!repoRes.ok || !repoRes.json) return { repo: null, unavailable: `couldn't check: github ${repoRes.status}` };
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
	if (commits.status === 403 || commits.status === 429) return { repo: null, unavailable: "couldn't check: github rate limit" };
	let earlyAdditions: number | null = null;
	const earlySha = firstSha(early.json);
	if (earlySha) {
		const detail = await gh(`/repos/${parsed.owner}/${parsed.repo}/commits/${earlySha}`);
		const additions = (detail.json as { stats?: { additions?: number } } | null)?.stats?.additions;
		if (typeof additions === 'number') earlyAdditions = additions;
	}
	const sameName = searchItems(search.json).filter((hit) => hit.fullName.toLowerCase() !== `${parsed.owner}/${parsed.repo}`.toLowerCase());
	return {
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

async function gh(path: string): Promise<{ status: number; ok: boolean; json: unknown | null }> {
	const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'fjording-it' };
	const githubToken = privateEnv('GITHUB_TOKEN');
	if (githubToken) headers.authorization = `Bearer ${githubToken}`;
	try {
		const res = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(8000) });
		const json = await res.json().catch(() => null);
		return { status: res.status, ok: res.ok, json };
	} catch {
		return { status: 0, ok: false, json: null };
	}
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
