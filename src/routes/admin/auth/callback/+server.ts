import { redirect } from '@sveltejs/kit';
import { finishHackClubLogin } from '#lib/server/admin.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer'
	});
	await finishHackClubLogin({ cookies, url });
	redirect(303, '/admin/stats');
};
