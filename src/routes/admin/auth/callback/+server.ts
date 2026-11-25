import { redirect } from '@sveltejs/kit';
import { afterLoginPath, safeNext } from '#lib/admin-gate.ts';
import { finishHackClubLogin } from '#lib/server/admin.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer'
	});
	const result = await finishHackClubLogin({ cookies, url });
	const next = safeNext(result.next);
	redirect(303, afterLoginPath(result.status, next));
};
