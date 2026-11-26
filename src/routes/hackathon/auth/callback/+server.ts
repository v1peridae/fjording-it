import { redirect } from '@sveltejs/kit';
import { afterSignIn, signInFrom, type JoinChoice } from '#lib/participant-identity.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { challengeChoice, participantProject, setChallengeChoice } from '#lib/server/northern-store.ts';
import { currentParticipant, finishParticipantLogin } from '#lib/server/participant.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const result = await finishParticipantLogin({ cookies, url });
	if (result.status !== 'ok') {
		redirect(303, afterSignIn({ ok: false, from: null, choice: null, hasProject: false }));
	}
	const participant = await currentParticipant(cookies, url);
	let choice: JoinChoice = null;
	let hasProject = false;
	if (participant && databaseConfigured()) {
		try {
			const db = await appDatabase();
			choice = await challengeChoice(db, participant.id);
			hasProject = Boolean(await participantProject(db, participant.id));
			if (signInFrom(result.from) !== '/') {
				await setChallengeChoice(db, participant.id, 'in');
				choice = 'in';
			}
		} catch {
			choice = null;
		}
	}
	redirect(303, afterSignIn({ ok: true, from: result.from, choice, hasProject }));
};
