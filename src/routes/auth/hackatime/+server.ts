import { privateEnv } from '#lib/server/private-env.ts';
import { error } from '@sveltejs/kit';
import { openSealed, randomToken, seal } from '#lib/server/admin-auth.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import { authorizeUrl, HACKATIME_REDIRECT_URI, hackatimeCredentials } from '#lib/server/hackatime.ts';
import { northernIsPublic } from '#lib/northern-access.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const STATE_COOKIE = 'hackatime_oauth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	if (!sessionSecret) error(404, 'Not Found');
	const admin = await currentAdminView(cookies, url);
	if (!northernIsPublic(privateEnv('NORTHERN_PUBLIC')) && admin.status !== 'in') error(404, 'Not Found');

	const participant = await currentParticipant(cookies, url);
	const ticket = await openSealed(url.searchParams.get('ticket') ?? '', sessionSecret);
	const email = participant?.email ?? '';
	if (
		!participant ||
		!ticket ||
		ticket.purpose !== 'hackatime-start' ||
		typeof ticket.exp !== 'number' ||
		ticket.exp <= Date.now() ||
		ticket.email !== email
	) {
		error(404, 'Not Found');
	}

	const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	});
	if (!client) {
		return new Response(null, {
			status: 303,
			headers: { location: '/hackathon/submit?hackatime=unconfigured' }
		});
	}

	const state = randomToken();
	cookies.set(STATE_COOKIE, await seal({ state, email, exp: Date.now() + 10 * 60 * 1000 }, sessionSecret), {
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
