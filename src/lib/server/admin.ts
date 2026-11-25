import { ADMIN_COOKIE_PATH, LEGACY_ADMIN_COOKIE_PATHS, ownerGate, safeNext, staffGate } from '#lib/admin-gate.ts';
import { privateEnv } from '#lib/server/private-env.ts';
import { error, redirect, type Cookies } from '@sveltejs/kit';
import {
	OAUTH_MS,
	SESSION_MS,
	authorizeUrl,
	callbackUrl,
	openOauth,
	openSessionClaims,
	randomToken,
	sameToken,
	sealOauth,
	sealSession,
	verifiedEmail
} from './admin-auth';
import { adminCallbackDecision } from '../signup-stats';

async function stagesFor(email: string) {
	const { reviewerStagesFor } = await import('./access.ts');
	return reviewerStagesFor(email);
}

const SESSION_COOKIE = 'admin_session';
const OAUTH_COOKIE = 'admin_oauth';
const FLASH_COOKIE = 'admin_flash';
/** Old path-scoped copies plus the current site-wide cookie. */
const SESSION_PATHS = [ADMIN_COOKIE_PATH, ...LEGACY_ADMIN_COOKIE_PATHS] as const;

type Flash = 'denied' | 'failed';

function cookieOptions(url: URL, maxAge?: number, path = '/admin') {
	return {
		path,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		...(maxAge === undefined ? {} : { maxAge })
	};
}

function clearSession(cookies: Cookies, url: URL) {
	for (const path of SESSION_PATHS) {
		cookies.delete(SESSION_COOKIE, cookieOptions(url, undefined, path));
	}
}

/** One site-wide cookie, and drop any older path-scoped copies of the same name. */
function publishSession(cookies: Cookies, url: URL, token: string) {
	cookies.set(SESSION_COOKIE, token, cookieOptions(url, SESSION_MS / 1000, ADMIN_COOKIE_PATH));
	for (const path of LEGACY_ADMIN_COOKIE_PATHS) {
		cookies.delete(SESSION_COOKIE, cookieOptions(url, undefined, path));
	}
}

export function signOutAdmin(cookies: Cookies, url: URL) {
	clearSession(cookies, url);
}

export function enforceOwner(status: 'in' | 'reviewer' | 'denied' | 'out', url: URL) {
	const gate = ownerGate(status, `${url.pathname}${url.search}`);
	if (gate.type === 'signin') redirect(303, gate.location);
	if (gate.type === 'hide') error(404, 'Not Found');
}

export function enforceStaff(status: 'in' | 'reviewer' | 'denied' | 'out', url: URL) {
	const gate = staffGate(status, `${url.pathname}${url.search}`);
	if (gate.type === 'signin') redirect(303, gate.location);
	if (gate.type === 'hide') error(404, 'Not Found');
}

export type AdminView =
	| { status: 'in'; email: string; handle: string | null; role: 'owner' }
	| { status: 'reviewer'; email: string; handle: string | null; stages: string[] }
	| { status: 'denied' }
	| { status: 'out' };

export async function currentAdminView(cookies: Cookies, url: URL): Promise<AdminView> {
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	if (!sessionSecret) return { status: 'out' };
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return { status: 'out' };

	const claims = await openSessionClaims(token, sessionSecret);
	if (!claims) {
		clearSession(cookies, url);
		return { status: 'out' };
	}
	if (adminCallbackDecision(claims.email, privateEnv('ADMIN_EMAILS')) === 'allow') {
		publishSession(cookies, url, token);
		return { status: 'in', email: claims.email, handle: claims.handle, role: 'owner' };
	}
	const stages = await stagesFor(claims.email);
	if (stages.length > 0) {
		publishSession(cookies, url, token);
		return { status: 'reviewer', email: claims.email, handle: claims.handle, stages };
	}
	clearSession(cookies, url);
	return { status: 'denied' };
}

function authConfig() {
	const clientId = privateEnv('HACKCLUB_AUTH_CLIENT_ID');
	const clientSecret = privateEnv('HACKCLUB_AUTH_CLIENT_SECRET');
	const sessionSecret = privateEnv('ADMIN_SESSION_SECRET');
	if (!clientId || !clientSecret || !sessionSecret) return null;
	return { clientId, clientSecret, sessionSecret };
}

function missingAuthEnv(): string[] {
	const missing: string[] = [];
	if (!privateEnv('HACKCLUB_AUTH_CLIENT_ID')) missing.push('HACKCLUB_AUTH_CLIENT_ID');
	if (!privateEnv('HACKCLUB_AUTH_CLIENT_SECRET')) missing.push('HACKCLUB_AUTH_CLIENT_SECRET');
	if (!privateEnv('ADMIN_SESSION_SECRET')) missing.push('ADMIN_SESSION_SECRET');
	return missing;
}

export async function currentAdmin(cookies: Cookies, url: URL): Promise<'in' | 'denied' | 'out'> {
	const status = (await currentAdminView(cookies, url)).status;
	if (status === 'in') return 'in';
	if (status === 'denied') return 'denied';
	return 'out';
}

export function takeFlash(cookies: Cookies, url: URL): Flash | null {
	const value = cookies.get(FLASH_COOKIE);
	if (!value) return null;
	cookies.delete(FLASH_COOKIE, cookieOptions(url));
	return value === 'denied' || value === 'failed' ? value : null;
}

export function clearFlash(cookies: Cookies, url: URL) {
	cookies.delete(FLASH_COOKIE, cookieOptions(url));
}

function setFlash(cookies: Cookies, url: URL, flash: Flash) {
	cookies.set(FLASH_COOKIE, flash, cookieOptions(url, 120));
}

export async function beginHackClubLogin(options: {
	cookies: Cookies;
	origin: string;
	loginHint?: string;
	next?: string | null;
}): Promise<{ error: 'unconfigured' } | void> {
	const config = authConfig();
	if (!config) {
		console.error(`admin sign-in missing ${missingAuthEnv().join(', ')}`);
		return { error: 'unconfigured' };
	}

	const attempt = {
		state: randomToken(),
		nonce: randomToken(),
		exp: Date.now() + OAUTH_MS,
		...(safeNext(options.next) ? { next: safeNext(options.next)! } : {})
	};
	const url = new URL(options.origin);
	options.cookies.set(OAUTH_COOKIE, await sealOauth(attempt, config.sessionSecret), cookieOptions(url, OAUTH_MS / 1000));

	redirect(303, authorizeUrl({
		clientId: config.clientId,
		redirectUri: callbackUrl(options.origin),
		state: attempt.state,
		nonce: attempt.nonce,
		loginHint: options.loginHint
	}), { external: ['https://auth.hackclub.com'] });
}

export async function finishHackClubLogin(options: {
	cookies: Cookies;
	url: URL;
}): Promise<{ status: 'owner' | 'reviewer' | 'denied' | 'failed'; next: string | null }> {
	const config = authConfig();
	const token = options.cookies.get(OAUTH_COOKIE);
	options.cookies.delete(OAUTH_COOKIE, cookieOptions(options.url));

	const fail = (reason: string) => {
		console.error(`hack club auth: ${reason}`);
		setFlash(options.cookies, options.url, 'failed');
	};

	if (!config || !token) {
		fail(config ? 'missing oauth cookie' : `missing ${missingAuthEnv().join(', ')}`);
		return { status: 'failed', next: null };
	}

	const attempt = await openOauth(token, config.sessionSecret);
	const next = safeNext(attempt?.next);
	const code = options.url.searchParams.get('code');
	const state = options.url.searchParams.get('state');
	const providerError = options.url.searchParams.get('error');

	if (providerError || !attempt || !code || !state || !sameToken(state, attempt.state)) {
		fail(providerError ? `provider ${providerError}` : 'oauth state mismatch');
		return { status: 'failed', next };
	}

	try {
		const email = await emailFromCode({
			code,
			nonce: attempt.nonce,
			redirectUri: callbackUrl(options.url.origin),
			clientId: config.clientId,
			clientSecret: config.clientSecret
		});

		const owner = adminCallbackDecision(email, privateEnv('ADMIN_EMAILS')) === 'allow';
		const reviewer = owner ? false : (await stagesFor(email)).length > 0;
		if (!owner && !reviewer) {
			clearSession(options.cookies, options.url);
			console.error(`admin sign-in denied for ${email}`);
			setFlash(options.cookies, options.url, 'denied');
			return { status: 'denied', next };
		}

		publishSession(options.cookies, options.url, await sealSession(email, config.sessionSecret));
		clearFlash(options.cookies, options.url);
		return { status: owner ? 'owner' : 'reviewer', next };
	} catch (err) {
		fail(err instanceof Error ? err.message : 'failed');
		return { status: 'failed', next };
	}
}

async function emailFromCode(options: {
	code: string;
	nonce: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string;
}): Promise<string> {
	const body = new URLSearchParams({
		client_id: options.clientId,
		client_secret: options.clientSecret,
		redirect_uri: options.redirectUri,
		code: options.code,
		grant_type: 'authorization_code'
	});
	const res = await fetch('https://auth.hackclub.com/oauth/token', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json'
		},
		body,
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) throw new Error(`token endpoint ${res.status}`);

	const json = (await res.json()) as { id_token?: unknown; access_token?: unknown };
	if (typeof json.id_token !== 'string' || typeof json.access_token !== 'string') {
		throw new Error('token response missing id_token');
	}

	const keys = await hackClubKeys();
	try {
		return await verifiedEmail({
			idToken: json.id_token,
			accessToken: json.access_token,
			keys,
			clientId: options.clientId,
			nonce: options.nonce
		});
	} catch (err) {
		if (!(err instanceof Error) || err.message !== 'unknown signing key') throw err;
		return verifiedEmail({
			idToken: json.id_token,
			accessToken: json.access_token,
			keys: await hackClubKeys(true),
			clientId: options.clientId,
			nonce: options.nonce
		});
	}
}

let jwks: { at: number; keys: JsonWebKey[] } | null = null;

async function hackClubKeys(force = false): Promise<JsonWebKey[]> {
	if (!force && jwks && Date.now() - jwks.at < 60 * 60 * 1000) return jwks.keys;

	const res = await fetch('https://auth.hackclub.com/oauth/discovery/keys', {
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) throw new Error(`jwks ${res.status}`);

	const body = (await res.json()) as { keys?: unknown };
	if (!Array.isArray(body.keys)) throw new Error('jwks missing keys');

	const keys = body.keys.filter((key): key is JsonWebKey & { kid?: string } => {
		if (!key || typeof key !== 'object') return false;
		const jwk = key as JsonWebKey;
		return jwk.kty === 'RSA' && !!jwk.n && !!jwk.e && (jwk.alg === undefined || jwk.alg === 'RS256');
	});
	jwks = { at: Date.now(), keys };
	return keys;
}
