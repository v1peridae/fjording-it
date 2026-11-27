import { fail, redirect } from '@sveltejs/kit';
import { privateEnv } from '#lib/server/private-env.ts';
import { seal } from '#lib/server/admin-auth.ts';
import { displayName } from '#lib/participant-identity.ts';
import { cleanDisplayName, lockReason, shouldReopen } from '#lib/participant-edit.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { hackatimeCredentials } from '#lib/server/hackatime.ts';
import { liveProjects } from '#lib/server/live-projects.ts';
import { refreshPerson } from '#lib/server/coding-dau.ts';
import { patchSyncedSubmission } from '#lib/server/airtable-sync.ts';
import { runSubmissionChecks } from '#lib/server/run-checks.ts';
import {
	HackatimeProjectTaken,
	codingSecondsInWindow,
	isUniqueViolation,
	ownSubmission,
	participantProject,
	saveOwnName,
	updateOwnProject,
	updateOwnSubmission
} from '#lib/server/northern-store.ts';
import { cleanDescription, cleanProjectName, httpUrl, sniffImage } from '#lib/northern.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

const MAX_SCREENSHOT = 5_000_000;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const participant = await currentParticipant(cookies, url);
	if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/details');

	const configured = Boolean(hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	}));
	let connected = false;
	let projects: { name: string; hours: string }[] = [];
	let projectsFailed = false;
	if (configured && databaseConfigured()) {
		const live = await liveProjects(participant.email).catch(() => null);
		connected = Boolean(live?.linked && !live.failed);
		projects = (live?.projects ?? []).map((project) => ({ name: project.name, hours: project.hours }));
		projectsFailed = Boolean(live?.failed);
	}

	const db = databaseConfigured() ? await appDatabase() : null;
	const project = db ? await participantProject(db, participant.id).catch(() => null) : null;
	const submission = db ? await ownSubmission(db, participant.id).catch(() => null) : null;
	const reason = submission ? lockReason(submission.stage, submission.status) : null;
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	const ticket =
		configured && sessionSecret
			? await seal({ purpose: 'hackatime-start', email: participant.email, exp: Date.now() + 10 * 60 * 1000 }, sessionSecret)
			: null;
	const saved = url.searchParams.get('saved');

	return {
		label: displayName(participant.name) || participant.email,
		email: participant.email,
		name: participant.name ?? '',
		project,
		submission: submission
			? {
					projectName: submission.projectName,
					description: submission.description,
					repoUrl: submission.repoUrl,
					demoUrl: submission.demoUrl,
					hackatimeProject: submission.hackatimeProject,
					hasScreenshot: submission.hasScreenshot,
					locked: Boolean(reason),
					lockReason: reason
				}
			: null,
		connected,
		projectsFailed,
		projects,
		ticket,
		notice:
			saved === 'reopened'
				? "saved. it's back at the start of review."
				: saved === '1'
					? 'saved.'
					: url.searchParams.get('hackatime') === 'failed'
						? "hackatime didn't connect. try again."
						: null
	};
};

export const actions: Actions = {
	name: async ({ request, cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/details');
		const raw = String((await request.formData()).get('name') ?? '');
		const name = cleanDisplayName(raw);
		if (name === undefined) return fail(400, { name: raw, nameError: 'keep the name under 80 characters' });
		if (databaseConfigured()) await saveOwnName(await appDatabase(), participant.id, name);
		redirect(303, '/hackathon/details?saved=1');
	},
	entry: async ({ request, cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/details');
		if (!databaseConfigured()) return fail(500, { entryError: 'database is not configured' });
		const db = await appDatabase();
		const existing = await participantProject(db, participant.id);
		const submission = await ownSubmission(db, participant.id);
		const data = await request.formData();
		const posted = {
			project: String(data.get('project') ?? ''),
			description: String(data.get('description') ?? ''),
			repo: String(data.get('repo') ?? ''),
			demo: String(data.get('demo') ?? ''),
			hackatime: String(data.get('hackatime') ?? '')
		};
		if (!existing) return fail(400, { ...posted, entryError: 'set up a project first' as const });
		const reason = submission ? lockReason(submission.stage, submission.status) : null;
		if (reason) return fail(403, { ...posted, entryError: reason });

		const name = cleanProjectName(posted.project);
		const story = cleanDescription(posted.description);
		if (!name || !story) return fail(400, { ...posted, entryError: 'add a name and a short description' as const });

		const hackatime = await chosenProject(participant.email, posted.hackatime, submission?.hackatimeProject ?? existing.hackatimeProject);
		if (!hackatime) return fail(400, { ...posted, entryError: 'pick one of your hackatime projects' as const });

		let repoUrl = submission?.repoUrl ?? '';
		let demoUrl = submission?.demoUrl ?? '';
		if (submission) {
			const repo = httpUrl(posted.repo);
			const demo = httpUrl(posted.demo);
			if (!repo || !demo) return fail(400, { ...posted, entryError: 'check both links' });
			repoUrl = repo;
			demoUrl = demo;
		}

		const file = data.get('screenshot');
		let screenshot: Uint8Array | null = null;
		let screenshotType: string | null = null;
		if (file instanceof File && file.size > 0) {
			if (file.size > MAX_SCREENSHOT) return fail(400, { ...posted, entryError: 'that screenshot is too big' });
			const bytes = new Uint8Array(await file.arrayBuffer());
			const kind = sniffImage(bytes);
			if (!kind) return fail(400, { ...posted, entryError: 'add a png or jpg screenshot' });
			screenshot = bytes;
			screenshotType = kind === 'png' ? 'image/png' : kind === 'jpg' ? 'image/jpeg' : 'image/webp';
		}

		const savedProject = await updateOwnProject(db, {
			participantId: participant.id,
			name,
			description: story,
			hackatimeProject: hackatime
		});
		if (!savedProject) return fail(404, { ...posted, entryError: 'that project is not yours' });

		let reopened = false;
		if (submission) {
			await refreshPerson(db, {
				participantId: participant.id,
				email: participant.email,
				hackatimeProject: hackatime
			}).catch(() => 'failed' as const);
			const seconds = await codingSecondsInWindow(db, participant.id).catch(() => null);
			reopened = shouldReopen(submission.stage, submission.status, submission.reviewCount);
			let updated: { id: number; airtableRecordId: string | null } | null;
			try {
				updated = await updateOwnSubmission(db, {
					participantId: participant.id,
					submissionId: submission.id,
					projectName: name,
					description: story,
					repoUrl,
					demoUrl,
					hackatimeProject: hackatime,
					hackatimeSeconds: seconds,
					screenshot,
					screenshotType,
					reopen: reopened
				});
			} catch (err) {
				if (err instanceof HackatimeProjectTaken || isUniqueViolation(err)) {
					return fail(409, { ...posted, entryError: 'that hackatime project was already submitted' });
				}
				throw err;
			}
			if (!updated) return fail(403, { ...posted, entryError: reason ?? 'this one stays as you sent it.' });
			await runSubmissionChecks(updated.id).catch(() => undefined);
			if (updated.airtableRecordId) {
				await patchSyncedSubmission(updated.id, updated.airtableRecordId).catch(() => false);
			}
		}

		redirect(303, reopened ? '/hackathon/details?saved=reopened' : '/hackathon/details?saved=1');
	}
};

async function chosenProject(email: string, picked: string, current: string): Promise<string | null> {
	if (picked && picked === current) return current;
	const live = await liveProjects(email).catch(() => null);
	if (!live?.linked || live.failed) return picked && picked === current ? current : null;
	const match = live.projects.find((project) => project.name === picked);
	return match ? match.name : null;
}
