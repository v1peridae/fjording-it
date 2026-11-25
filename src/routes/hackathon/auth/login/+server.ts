import { beginParticipantLogin } from '#lib/server/participant.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	await beginParticipantLogin({ cookies, url });
	return new Response(null, { status: 500 });
};
