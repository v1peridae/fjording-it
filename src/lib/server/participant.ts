import { error, redirect, type Cookies } from '@sveltejs/kit';
import { privateEnv } from '#lib/server/private-env.ts';
import {
	identityFromClaims,
	identityFromMe,
	PARTICIPANT_SCOPES,
	signInFrom,
	type ParticipantIdentity
} from '../participant-identity.ts';
import {
	authorizeUrl,
	OAUTH_MS,
	openOauth,
	openSealed,
	randomToken,
	sameToken,
	seal,
	sealOauth,
	SESSION_MS,
	verifyIdToken
} from './admin-auth.ts';
import { currentAdminView, enforceOwner } from './admin.ts';
import { appDatabase } from './app-db.ts';
import { participantByHackClubId, upsertParticipant, type ParticipantRow } from './northern-store.ts';
import { northernIsPublic } from '../northern-access.ts';

const SESSION_COOKIE = 'participant_session';
const OAUTH_COOKIE = 'participant_oauth';
const SESSION_PATHS = ['/hackathon', '/auth'] as const;
export const PARTICIPANT_CALLBACK_PATH = '/hackathon/auth/callback';

function cookieOptions(url: URL, maxAge?: number, path = '/hackathon') {
	return {
		path,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		...(maxAge === undefined ? {} : { maxAge })
	};
}

function writeCookie(cookies: Cookies, url: URL, name: string, token: string, maxAge: number) {
	for (const path of SESSION_PATHS) {
		cookies.set(name, token, cookieOptions(url, maxAge, path));
	}
}

function clearCookie(cookies: Cookies, url: URL, name: string) {
	for (const path of SESSION_PATHS) cookies.delete(name, cookieOptions(url, undefined, path));
}

export function participantCallbackUrl(origin: string): string {
	const url = new URL(PARTICIPANT_CALLBACK_PATH, origin);
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad origin');
	return url.href;
}

/** Exact production redirect to register on the existing Hack Club Auth app. */
export const PARTICIPANT_REDIRECT_URI = 'https://fjording.hackclub.com/hackathon/auth/callback';

export async function currentParticipant(cookies: Cookies, url: URL): Promise<ParticipantRow | null> {
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	if (!sessionSecret) return null;
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const data = await openSealed(token, sessionSecret);
	if (!data || typeof data.sub !== 'string' || typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
	try {
		return await participantByHackClubId(await appDatabase(), data.sub);
	} catch {
		return null;
	}
}

export function signOutParticipant(cookies: Cookies, url: URL) {
	clearCookie(cookies, url, SESSION_COOKIE);
	clearCookie(cookies, url, OAUTH_COOKIE);
}

export async function northernPageAllowed(cookies: Cookies, url: URL) {
	const view = await currentAdminView(cookies, url);
	if (northernIsPublic(privateEnv('NORTHERN_PUBLIC'))) return { admin: view.status === 'in', view };
	enforceOwner(view.status, url);
	return { admin: true, view };
}

export async function beginParticipantLogin(options: { cookies: Cookies; url: URL }): Promise<void> {
	await northernPageAllowed(options.cookies, options.url);
	const clientId = privateEnv('HACKCLUB_AUTH_CLIENT_ID');
	const clientSecret = privateEnv('HACKCLUB_AUTH_CLIENT_SECRET');
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	if (!clientId || !clientSecret || !sessionSecret) {
		console.error('participant sign-in missing hack club auth env');
		error(500, 'sign-in is not configured');
	}
	const attempt = {
		state: randomToken(),
		nonce: randomToken(),
		exp: Date.now() + OAUTH_MS,
		from: signInFrom(options.url.searchParams.get('from'))
	};
	writeCookie(
		options.cookies,
		options.url,
		OAUTH_COOKIE,
		await sealOauth(attempt, sessionSecret),
		OAUTH_MS / 1000
	);
	redirect(
		303,
		authorizeUrl({
			clientId,
			redirectUri: participantCallbackUrl(options.url.origin),
			state: attempt.state,
			nonce: attempt.nonce,
			scope: PARTICIPANT_SCOPES
		}),
		{ external: ['https://auth.hackclub.com'] }
	);
}

export async function finishParticipantLogin(options: {
	cookies: Cookies;
	url: URL;
}): Promise<{ status: 'ok' | 'failed'; from: string | null }> {
	await northernPageAllowed(options.cookies, options.url);
	const secret = privateEnv('ADMIN_SESSION_SECRET');
	const clientId = privateEnv('HACKCLUB_AUTH_CLIENT_ID');
	const clientSecret = privateEnv('HACKCLUB_AUTH_CLIENT_SECRET');
	const token = options.cookies.get(OAUTH_COOKIE);
	clearCookie(options.cookies, options.url, OAUTH_COOKIE);
	if (!secret || !token || !clientId || !clientSecret) return { status: 'failed', from: null };
	const attempt = await openOauth(token, secret);
	const code = options.url.searchParams.get('code');
	const state = options.url.searchParams.get('state');
	if (options.url.searchParams.get('error') || !attempt || !code || !state || !sameToken(state, attempt.state)) {
		return { status: 'failed', from: null };
	}
	try {
		const identity = await identityFromCode({
			code,
			nonce: attempt.nonce,
			redirectUri: participantCallbackUrl(options.url.origin),
			clientId,
			clientSecret
		});
		await upsertParticipant(await appDatabase(), identity);
		writeCookie(
			options.cookies,
			options.url,
			SESSION_COOKIE,
			await seal({ sub: identity.hackClubId, email: identity.email, exp: Date.now() + SESSION_MS }, secret),
			SESSION_MS / 1000
		);
		return { status: 'ok', from: signInFrom(attempt.from) };
	} catch (err) {
		console.error('participant sign-in failed', err instanceof Error ? err.message : 'failed');
		return { status: 'failed', from: null };
	}
}

async function identityFromCode(options: {
	code: string;
	nonce: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string;
}): Promise<ParticipantIdentity> {
	const body = new URLSearchParams({
		client_id: options.clientId,
		client_secret: options.clientSecret,
		redirect_uri: options.redirectUri,
		code: options.code,
		grant_type: 'authorization_code'
	});
	const res = await fetch('https://auth.hackclub.com/oauth/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
		body,
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) throw new Error(`token endpoint ${res.status}`);
	const json = (await res.json()) as { id_token?: unknown; access_token?: unknown };
	if (typeof json.id_token !== 'string' || typeof json.access_token !== 'string') throw new Error('token response missing id_token');
	const keys = await hackClubKeys();
	const verified = await verifyIdToken(json.id_token, { keys, clientId: options.clientId, nonce: options.nonce });
	const userinfo = await readJson('https://auth.hackclub.com/oauth/userinfo', json.access_token);
	const merged = { ...claimsOf(json.id_token), ...(userinfo ?? {}) };
	if (typeof merged.sub !== 'string') merged.sub = verified.sub;
	let identity = identityFromClaims(merged);
	if (!identity) throw new Error('hack club auth did not return an id and email');
	const me = await readJson('https://auth.hackclub.com/api/v1/me', json.access_token);
	if (me) identity = identityFromMe(me, identity);
	return identity;
}

function claimsOf(idToken: string): Record<string, unknown> {
	const part = idToken.split('.')[1];
	if (!part) return {};
	try {
		const padded = part.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (part.length % 4)) % 4);
		const json = JSON.parse(atob(padded)) as unknown;
		return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

async function readJson(url: string, accessToken: string): Promise<Record<string, unknown> | null> {
	const res = await fetch(url, {
		headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) return null;
	const body = (await res.json()) as unknown;
	return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

let jwks: { at: number; keys: JsonWebKey[] } | null = null;

async function hackClubKeys(force = false): Promise<JsonWebKey[]> {
	if (!force && jwks && Date.now() - jwks.at < 60 * 60 * 1000) return jwks.keys;
	const res = await fetch('https://auth.hackclub.com/oauth/discovery/keys', { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`jwks ${res.status}`);
	const body = (await res.json()) as { keys?: unknown };
	if (!Array.isArray(body.keys)) throw new Error('jwks missing keys');
	const keys = body.keys.filter((key): key is JsonWebKey => {
		if (!key || typeof key !== 'object') return false;
		const jwk = key as JsonWebKey;
		return jwk.kty === 'RSA' && !!jwk.n && !!jwk.e;
	});
	jwks = { at: Date.now(), keys };
	return keys;
}
