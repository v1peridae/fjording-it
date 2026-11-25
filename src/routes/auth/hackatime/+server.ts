import {
	ADMIN_EMAILS,
	ADMIN_SESSION_SECRET,
	HACKATIME_CLIENT_ID,
	HACKATIME_CLIENT_SECRET
} from '$app/env/private';
import { error } from '@sveltejs/kit';
import { openSealed, randomToken, seal } from '#lib/server/admin-auth.ts';
import { authorizeUrl, HACKATIME_REDIRECT_URI, hackatimeCredentials } from '#lib/server/hackatime.ts';
import { isAdminEmail } from '#lib/signup-stats.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const STATE_COOKIE = 'hackatime_oauth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!ADMIN_SESSION_SECRET) error(404, 'Not Found');

	const ticket = await openSealed(url.searchParams.get('ticket') ?? '', ADMIN_SESSION_SECRET);
	const email = typeof ticket?.email === 'string' ? ticket.email : '';
	if (
		!ticket ||
		ticket.purpose !== 'hackatime-start' ||
		typeof ticket.exp !== 'number' ||
		ticket.exp <= Date.now() ||
		!email ||
		!isAdminEmail(email, ADMIN_EMAILS)
	) {
		error(404, 'Not Found');
	}

	const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID,
		HACKATIME_CLIENT_SECRET
	});
	if (!client) {
		return new Response(null, {
			status: 303,
			headers: { location: '/hackathon/submit?hackatime=unconfigured' }
		});
	}

	const state = randomToken();
	cookies.set(STATE_COOKIE, await seal({ state, email, exp: Date.now() + 10 * 60 * 1000 }, ADMIN_SESSION_SECRET), {
		path: '/auth/hackatime',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 600
	});

	return new Response(null, {
		status: 302,
		headers: {
			location: authorizeUrl({
				clientId: client.id,
				redirectUri: HACKATIME_REDIRECT_URI,
				state
			})
		}
	});
};
