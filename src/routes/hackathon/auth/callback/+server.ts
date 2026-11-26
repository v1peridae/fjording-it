import { redirect } from '@sveltejs/kit';
import { participantAfterLogin } from '#lib/participant-identity.ts';
import { finishParticipantLogin } from '#lib/server/participant.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const result = await finishParticipantLogin({ cookies, url });
	redirect(303, participantAfterLogin(result === 'ok'));
};
