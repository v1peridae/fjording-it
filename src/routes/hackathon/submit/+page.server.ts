import { privateEnv } from '#lib/server/private-env.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import { seal } from '#lib/server/admin-auth.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import { appDatabase, DatabaseUnconfigured } from '#lib/server/app-db.ts';
import { databaseConfigured } from '#lib/server/app-db.ts';
import {
	fetchHackatimeProjects,
	formatHours,
	hackatimeCredentials,
	refreshAccessToken,
	type HackatimeProject
} from '#lib/server/hackatime.ts';
import {
	insertSubmission,
	NORTHERN_SLUG,
	readHackatimeConnection,
	updateHackatimeTokens
} from '#lib/server/northern-store.ts';
import { runSubmissionChecks } from '#lib/server/run-checks.ts';
import { sniffImage } from '#lib/northern.ts';
import { canSubmit, cleanDescription, cleanProjectName, eligibleHours, httpUrl, submitPhase } from '#lib/northern.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

const SHIPPED = 'northern_shipped';
const MAX_SCREENSHOT = 5_000_000;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });

	const admin = await currentAdminView(cookies, url);
	if (admin.status !== 'in') error(404, 'Not Found');

	const shipped = cookies.get(SHIPPED) === '1';
	if (shipped) {
		cookies.delete(SHIPPED, { path: '/hackathon', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
	}

	const configured = Boolean(hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	}));
	const phase = submitPhase(new Date());
	const allowed = canSubmit(phase, true);
	const notice = hackatimeNotice(url.searchParams.get('hackatime'), configured);

	let github: string | null = null;
	let linked = false;
	let projects: { name: string; seconds: number; hours: string; eligible: boolean }[] = [];
	let projectsFailed = false;

	if (configured && databaseConfigured()) {
		try {
			const live = await liveProjects(admin.email);
			github = live.github;
			linked = live.linked;
			projects = live.projects;
			projectsFailed = live.failed;
		} catch {
			projectsFailed = true;
		}
	}

	const ticket =
		configured && privateEnv('ADMIN_SESSION_SECRET')
			? await seal(
					{ purpose: 'hackatime-start', email: admin.email, exp: Date.now() + 10 * 60 * 1000 },
					privateEnv('ADMIN_SESSION_SECRET')!
				)
			: null;

	return {
		handle: admin.handle,
		phase,
		allowed,
		preview: phase === 'early',
		configured,
		connected: linked && !projectsFailed,
		projects,
		projectsFailed,
		github,
		ticket,
		notice,
		shipped
	};
};

function hackatimeNotice(flag: string | null, configured: boolean): string | null {
	if (flag === 'failed') return "hackatime didn't connect. try again.";
	if (flag === 'unconfigured' || (flag === 'connected' && !configured)) return 'Hackatime not connected yet';
	return null;
}

async function liveProjects(email: string): Promise<{
	github: string | null;
	linked: boolean;
	projects: { name: string; seconds: number; hours: string; eligible: boolean }[];
	failed: boolean;
}> {
	const empty = { github: null, linked: false, projects: [], failed: false };
	const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	});
	if (!client) return empty;

	const db = await appDatabase();
	let connection = await readHackatimeConnection(db, email);
	if (!connection) return empty;

	const remembered = connection.githubUsername;
	if (connection.expiresAt != null && connection.expiresAt <= Date.now() + 30_000) {
		if (!connection.refreshToken) {
			return { github: remembered, linked: true, projects: [], failed: true };
		}
		try {
			const tokens = await refreshAccessToken({
				refreshToken: connection.refreshToken,
				clientId: client.id,
				clientSecret: client.secret
			});
			await updateHackatimeTokens(db, email, tokens);
			connection = await readHackatimeConnection(db, email);
		} catch {
			return { github: remembered, linked: true, projects: [], failed: true };
		}
	}
	if (!connection) return { github: null, linked: true, projects: [], failed: true };

	const list = await fetchHackatimeProjects(connection.accessToken);
	if (!list) return { github: connection.githubUsername, linked: true, projects: [], failed: true };
	return {
		github: connection.githubUsername,
		linked: true,
		failed: false,
		projects: list.map((project: HackatimeProject) => ({
			name: project.name,
			seconds: project.totalSeconds,
			hours: formatHours(project.totalSeconds),
			eligible: eligibleHours(project.totalSeconds)
		}))
	};
}

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const admin = await currentAdminView(cookies, url);
		if (admin.status !== 'in') error(404, 'Not Found');

		const data = await request.formData();
		const project = String(data.get('project') ?? '');
		const description = String(data.get('description') ?? '');
		const repo = String(data.get('repo') ?? '');
		const demo = String(data.get('demo') ?? '');
		const picked = String(data.get('hackatime') ?? '');
		const values = { project, description, repo, demo, hackatime: picked };

		const phase = submitPhase(new Date());
		if (!canSubmit(phase, true)) {
			return fail(403, { ...values, error: phase === 'closed' ? "that's a wrap" : 'opens nov 27' });
		}

		const name = cleanProjectName(project);
		const story = cleanDescription(description);
		const repoUrl = httpUrl(repo);
		const demoUrl = httpUrl(demo);
		if (!name || !story || !repoUrl || !demoUrl) {
			return fail(400, { ...values, error: 'check the name, the story, and both links' });
		}

		const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	});
		if (!client) return fail(400, { ...values, error: 'Hackatime not connected yet' });

		const live = await liveProjects(admin.email);
		if (!live.linked || live.failed) return fail(400, { ...values, error: 'connect hackatime, then pick a project' });
		const match = live.projects.find((item) => item.name === picked);
		if (!match) return fail(400, { ...values, error: 'pick one of your hackatime projects' });
		if (!match.eligible) return fail(400, { ...values, error: 'under 5h, not eligible yet' });

		const file = data.get('screenshot');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { ...values, error: 'add a png or jpg screenshot' });
		}
		if (file.size > MAX_SCREENSHOT) return fail(400, { ...values, error: 'that screenshot is too big' });
		const bytes = new Uint8Array(await file.arrayBuffer());
		const kind = sniffImage(bytes);
		if (!kind) return fail(400, { ...values, error: 'add a png or jpg screenshot' });

		let submissionId: number;
		try {
			submissionId = await insertSubmission(await appDatabase(), {
				challenge: NORTHERN_SLUG,
				email: admin.email,
				projectName: name,
				description: story,
				repoUrl,
				demoUrl,
				screenshot: bytes,
				screenshotType: kind === 'png' ? 'image/png' : kind === 'jpg' ? 'image/jpeg' : 'image/webp',
				hackatimeProject: match.name,
				hackatimeSeconds: match.seconds
			});
		} catch (err) {
			if (err instanceof DatabaseUnconfigured) return fail(500, { ...values, error: 'database is not configured' });
			throw err;
		}
		await runSubmissionChecks(submissionId).catch(() => undefined);

		cookies.set(SHIPPED, '1', {
			path: '/hackathon',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 120
		});
		redirect(303, '/hackathon/submit');
	}
};
