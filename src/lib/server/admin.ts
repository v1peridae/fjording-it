import {
	ADMIN_EMAILS,
	ADMIN_SESSION_SECRET,
	HACKCLUB_AUTH_CLIENT_ID,
	HACKCLUB_AUTH_CLIENT_SECRET
} from '$app/env/private';
import { redirect, type Cookies } from '@sveltejs/kit';
import {
	OAUTH_MS,
	SESSION_MS,
	authorizeUrl,
	callbackUrl,
	openOauth,
	openSession,
	randomToken,
	sameToken,
	sealOauth,
	sealSession,
	verifiedEmail
} from './admin-auth';
import { isAdminEmail } from '../signup-stats';

const SESSION_COOKIE = 'admin_session';
const OAUTH_COOKIE = 'admin_oauth';
const FLASH_COOKIE = 'admin_flash';

type Flash = 'denied' | 'failed';

function cookieOptions(url: URL, maxAge?: number) {
	return {
		path: '/admin',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		...(maxAge === undefined ? {} : { maxAge })
	};
}

function authConfig() {
	if (!HACKCLUB_AUTH_CLIENT_ID || !HACKCLUB_AUTH_CLIENT_SECRET || !ADMIN_SESSION_SECRET) return null;
	return {
		clientId: HACKCLUB_AUTH_CLIENT_ID,
		clientSecret: HACKCLUB_AUTH_CLIENT_SECRET,
		sessionSecret: ADMIN_SESSION_SECRET
	};
}

function missingAuthEnv(): string[] {
	const missing: string[] = [];
	if (!HACKCLUB_AUTH_CLIENT_ID) missing.push('HACKCLUB_AUTH_CLIENT_ID');
	if (!HACKCLUB_AUTH_CLIENT_SECRET) missing.push('HACKCLUB_AUTH_CLIENT_SECRET');
	if (!ADMIN_SESSION_SECRET) missing.push('ADMIN_SESSION_SECRET');
	return missing;
}

export async function currentAdmin(cookies: Cookies, url: URL): Promise<'in' | 'denied' | 'out'> {
	if (!ADMIN_SESSION_SECRET) return 'out';
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return 'out';

	const email = await openSession(token, ADMIN_SESSION_SECRET);
	if (!email) {
		cookies.delete(SESSION_COOKIE, cookieOptions(url));
		return 'out';
	}
	if (!isAdminEmail(email, ADMIN_EMAILS)) {
		cookies.delete(SESSION_COOKIE, cookieOptions(url));
		return 'denied';
	}
	return 'in';
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
}): Promise<{ error: 'unconfigured' } | void> {
	const config = authConfig();
	if (!config) {
		console.error(`admin sign-in missing ${missingAuthEnv().join(', ')}`);
		return { error: 'unconfigured' };
	}

	const attempt = {
		state: randomToken(),
		nonce: randomToken(),
		exp: Date.now() + OAUTH_MS
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

export async function finishHackClubLogin(options: { cookies: Cookies; url: URL }): Promise<void> {
	const config = authConfig();
	const token = options.cookies.get(OAUTH_COOKIE);
	options.cookies.delete(OAUTH_COOKIE, cookieOptions(options.url));

	const fail = (reason: string) => {
		console.error(`hack club auth: ${reason}`);
		setFlash(options.cookies, options.url, 'failed');
	};

	if (!config || !token) {
		fail(config ? 'missing oauth cookie' : `missing ${missingAuthEnv().join(', ')}`);
		return;
	}

	const attempt = await openOauth(token, config.sessionSecret);
	const code = options.url.searchParams.get('code');
	const state = options.url.searchParams.get('state');
	const providerError = options.url.searchParams.get('error');

	if (providerError || !attempt || !code || !state || !sameToken(state, attempt.state)) {
		fail(providerError ? `provider ${providerError}` : 'oauth state mismatch');
		return;
	}

	try {
		const email = await emailFromCode({
			code,
			nonce: attempt.nonce,
			redirectUri: callbackUrl(options.url.origin),
			clientId: config.clientId,
			clientSecret: config.clientSecret
		});

		if (!isAdminEmail(email, ADMIN_EMAILS)) {
			options.cookies.delete(SESSION_COOKIE, cookieOptions(options.url));
			console.error(`admin sign-in denied for ${email}`);
			setFlash(options.cookies, options.url, 'denied');
			return;
		}

		options.cookies.set(
			SESSION_COOKIE,
			await sealSession(email, config.sessionSecret),
			cookieOptions(options.url, SESSION_MS / 1000)
		);
		clearFlash(options.cookies, options.url);
	} catch (err) {
		fail(err instanceof Error ? err.message : 'failed');
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
