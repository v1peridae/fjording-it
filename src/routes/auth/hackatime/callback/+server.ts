import { ADMIN_EMAILS, ADMIN_SESSION_SECRET, HACKATIME_CLIENT_ID, HACKATIME_CLIENT_SECRET } from '$app/env/private';
import { openSealed } from '#lib/server/admin-auth.ts';
import { appDatabase } from '#lib/server/app-db.ts';
import {
	exchangeCode,
	fetchHackatimeProfile,
	HACKATIME_REDIRECT_URI,
	hackatimeCredentials,
	statesMatch
} from '#lib/server/hackatime.ts';
import { saveHackatimeConnection } from '#lib/server/northern-store.ts';
import { isAdminEmail } from '#lib/signup-stats.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const STATE_COOKIE = 'hackatime_oauth';

function back(status: string) {
	return new Response(null, {
		status: 303,
		headers: { location: `/hackathon/submit?hackatime=${status}` }
	});
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const secret = ADMIN_SESSION_SECRET;
	const sealed = secret ? await openSealed(cookies.get(STATE_COOKIE) ?? '', secret) : null;
	cookies.delete(STATE_COOKIE, {
		path: '/auth/hackatime',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:'
	});

	if (url.searchParams.get('error')) return back('failed');

	const client = hackatimeCredentials({ HACKATIME_CLIENT_ID, HACKATIME_CLIENT_SECRET });
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const email = typeof sealed?.email === 'string' ? sealed.email : '';
	if (
		!secret ||
		!client ||
		!sealed ||
		typeof sealed.state !== 'string' ||
		typeof sealed.exp !== 'number' ||
		sealed.exp <= Date.now() ||
		!email ||
		!isAdminEmail(email, ADMIN_EMAILS) ||
		!code ||
		!state ||
		!statesMatch(state, sealed.state)
	) {
		return back('failed');
	}

	try {
		const tokens = await exchangeCode({
			code,
			redirectUri: HACKATIME_REDIRECT_URI,
			clientId: client.id,
			clientSecret: client.secret
		});
		const profile = await fetchHackatimeProfile(tokens.accessToken);
		await saveHackatimeConnection(
			await appDatabase(),
			email,
			tokens,
			{ id: profile?.id ?? null, githubUsername: profile?.githubUsername ?? null }
		);
		return back('connected');
	} catch (err) {
		console.error('hackatime callback failed');
		return back('failed');
	}
};
