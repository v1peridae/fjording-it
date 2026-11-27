import { fail, redirect } from '@sveltejs/kit';
import { displayName } from '#lib/participant-identity.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { challengeChoice, participantProject, setChallengeChoice } from '#lib/server/northern-store.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const participant = await currentParticipant(cookies, url);
	if (!participant) redirect(303, '/hackathon/auth/login?from=/');
	if (databaseConfigured()) {
		const db = await appDatabase();
		const choice = await challengeChoice(db, participant.id);
		if (choice === 'later') redirect(303, '/hackathon/you');
		if (choice === 'in') {
			const project = await participantProject(db, participant.id);
			redirect(303, project ? '/hackathon' : '/hackathon/start');
		}
	}
	return { label: displayName(participant.name) || participant.email };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/');
		const choice = String((await request.formData()).get('choice') ?? '');
		if (choice !== 'in' && choice !== 'later') return fail(400, { error: 'pick yes or not now' });
		if (databaseConfigured()) await setChallengeChoice(await appDatabase(), participant.id, choice);
		redirect(303, choice === 'in' ? '/hackathon/start' : '/hackathon/you');
	}
};
