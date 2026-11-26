import { fail, redirect } from '@sveltejs/kit';
import { privateEnv } from '#lib/server/private-env.ts';
import { seal } from '#lib/server/admin-auth.ts';
import { displayName } from '#lib/participant-identity.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { hackatimeCredentials } from '#lib/server/hackatime.ts';
import { participantProject, saveParticipantProject } from '#lib/server/northern-store.ts';
import { cleanDescription, cleanProjectName } from '#lib/northern.ts';
import { liveProjects } from '#lib/server/live-projects.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const participant = await currentParticipant(cookies, url);
	if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/start');
	if (databaseConfigured()) {
		const existing = await participantProject(await appDatabase(), participant.id).catch(() => null);
		if (existing) redirect(303, '/hackathon');
	}
	const configured = Boolean(hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	}));
	let connected = false;
	let projects: { name: string; seconds: number; hours: string; eligible: boolean }[] = [];
	let projectsFailed = false;
	if (configured && databaseConfigured()) {
		const live = await liveProjects(participant.email).catch(() => null);
		connected = Boolean(live?.linked && !live.failed);
		projects = live?.projects ?? [];
		projectsFailed = Boolean(live?.failed);
	}
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	const ticket =
		configured && sessionSecret
			? await seal({ purpose: 'hackatime-start', email: participant.email, exp: Date.now() + 10 * 60 * 1000 }, sessionSecret)
			: null;
	return {
		label: displayName(participant.name) || participant.email,
		configured,
		connected,
		projects,
		projectsFailed,
		ticket
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/start');
		const data = await request.formData();
		const name = cleanProjectName(String(data.get('project') ?? ''));
		const story = cleanDescription(String(data.get('description') ?? ''));
		const picked = String(data.get('hackatime') ?? '');
		const values = { project: String(data.get('project') ?? ''), description: String(data.get('description') ?? ''), hackatime: picked };
		if (!name || !story) return fail(400, { ...values, error: 'add a name and a short description' });
		const live = await liveProjects(participant.email).catch(() => null);
		if (!live?.linked || live.failed) return fail(400, { ...values, error: 'connect hackatime, then pick a project' });
		const match = live.projects.find((item) => item.name === picked);
		if (!match) return fail(400, { ...values, error: 'pick one of your hackatime projects' });
		await saveParticipantProject(await appDatabase(), {
			participantId: participant.id,
			name,
			description: story,
			hackatimeProject: match.name
		});
		redirect(303, '/hackathon');
	}
};
