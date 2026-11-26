import { redirect } from '@sveltejs/kit';
import { participantAfterLogin } from '#lib/participant-identity.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { participantProject } from '#lib/server/northern-store.ts';
import { currentParticipant, finishParticipantLogin } from '#lib/server/participant.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const result = await finishParticipantLogin({ cookies, url });
	if (result !== 'ok') redirect(303, participantAfterLogin(false));
	const participant = await currentParticipant(cookies, url);
	let needsOnboarding = false;
	if (participant && databaseConfigured()) {
		try {
			needsOnboarding = !(await participantProject(await appDatabase(), participant.id));
		} catch {
			needsOnboarding = false;
		}
	}
	redirect(303, participantAfterLogin(true, needsOnboarding));
};
