import { privateEnv } from '#lib/server/private-env.ts';
import { openSealed } from '#lib/server/admin-auth.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import { appDatabase } from '#lib/server/app-db.ts';
import {
	exchangeCode,
	fetchHackatimeProfile,
	HACKATIME_REDIRECT_URI,
	hackatimeCredentials,
	statesMatch
} from '#lib/server/hackatime.ts';
import { northernIsPublic } from '#lib/northern-access.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import { saveHackatimeConnection } from '#lib/server/northern-store.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const STATE_COOKIE = 'hackatime_oauth';

function back(status: string, next = '/hackathon/submit') {
	const path = next === '/hackathon/start' ? next : '/hackathon/submit';
	return new Response(null, {
		status: 303,
		headers: { location: `${path}?hackatime=${status}` }
	});
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const secret = privateEnv('ADMIN_SESSION_SECRET');
	const sealed = secret ? await openSealed(cookies.get(STATE_COOKIE) ?? '', secret) : null;
	cookies.delete(STATE_COOKIE, {
		path: '/auth/hackatime',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:'
	});

	const next = sealed?.back === '/hackathon/start' ? '/hackathon/start' : '/hackathon/submit';
	if (url.searchParams.get('error')) return back('failed', next);

	const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	});
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const email = typeof sealed?.email === 'string' ? sealed.email : '';
	const admin = await currentAdminView(cookies, url);
	const participant = await currentParticipant(cookies, url);
	if (!northernIsPublic(privateEnv('NORTHERN_PUBLIC')) && admin.status !== 'in') return back('failed', next);
	if (
		!secret ||
		!client ||
		!sealed ||
		typeof sealed.state !== 'string' ||
		typeof sealed.exp !== 'number' ||
		sealed.exp <= Date.now() ||
		!participant ||
		!email ||
		email !== participant.email ||
		!code ||
		!state ||
		!statesMatch(state, sealed.state)
	) {
		return back('failed', next);
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
		return back('connected', next);
	} catch (err) {
		console.error('hackatime callback failed');
		return back('failed', next);
	}
};
