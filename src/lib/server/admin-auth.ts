const ISSUER = 'https://auth.hackclub.com';
const AUTHORIZE = 'https://auth.hackclub.com/oauth/authorize';
export const CALLBACK_PATH = '/admin/auth/callback';
const SCOPE = 'openid email';
const SKEW_SECONDS = 60;

const encoder = new TextEncoder();

export function callbackUrl(origin: string): string {
	const url = new URL(CALLBACK_PATH, origin);
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad origin');
	return url.href;
}

export function authorizeUrl(options: {
	clientId: string;
	redirectUri: string;
	state: string;
	nonce: string;
	loginHint?: string;
	scope?: string;
	prompt?: string;
}): string {
	const url = new URL(AUTHORIZE);
	url.searchParams.set('client_id', options.clientId);
	url.searchParams.set('redirect_uri', options.redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', options.scope ?? SCOPE);
	url.searchParams.set('state', options.state);
	url.searchParams.set('nonce', options.nonce);
	if (options.loginHint) {
		url.searchParams.set('login_hint', options.loginHint);
		url.searchParams.set('email', options.loginHint);
	}
	if (options.prompt) url.searchParams.set('prompt', options.prompt);
	return url.href;
}

export function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

export async function seal(payload: object, secret: string): Promise<string> {
	const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
	const key = await hmacKey(secret);
	const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
	return `${body}.${base64UrlEncode(signature)}`;
}

export async function openSealed(token: string, secret: string): Promise<Record<string, unknown> | null> {
	const dot = token.indexOf('.');
	if (dot <= 0 || token.indexOf('.', dot + 1) !== -1) return null;

	const body = token.slice(0, dot);
	const signature = token.slice(dot + 1);
	if (!body || !signature) return null;

	try {
		const key = await hmacKey(secret);
		const ok = await crypto.subtle.verify(
			'HMAC',
			key,
			base64UrlDecode(signature),
			encoder.encode(body)
		);
		if (!ok) return null;
		const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_MS = 10 * 60 * 1000;

export async function sealSession(email: string, secret: string, now = Date.now()): Promise<string> {
	return seal({ email, exp: now + SESSION_MS }, secret);
}

export type SessionClaims = {
	email: string;
	handle: string | null;
};

/** A slack-style handle stored on the session. Emails are not handles. */
export function sessionHandle(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > 32 || /\s/.test(trimmed)) return null;
	if (trimmed.includes('@') && !trimmed.startsWith('@')) return null;
	const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
	if (!/^@[A-Za-z0-9._-]{1,31}$/.test(handle)) return null;
	return handle;
}

export async function openSessionClaims(
	token: string,
	secret: string,
	now = Date.now()
): Promise<SessionClaims | null> {
	const data = await openSealed(token, secret);
	if (!data || typeof data.email !== 'string' || typeof data.exp !== 'number') return null;
	if (data.exp <= now || !data.email) return null;
	return { email: data.email, handle: sessionHandle(data.handle) };
}

export async function openSession(token: string, secret: string, now = Date.now()): Promise<string | null> {
	const claims = await openSessionClaims(token, secret, now);
	return claims?.email ?? null;
}

export type OauthAttempt = {
	state: string;
	nonce: string;
	exp: number;
	next?: string;
	expectedEmail?: string;
	from?: string;
};

export async function sealOauth(attempt: OauthAttempt, secret: string): Promise<string> {
	return seal(attempt, secret);
}

export async function openOauth(token: string, secret: string, now = Date.now()): Promise<OauthAttempt | null> {
	const data = await openSealed(token, secret);
	if (!data) return null;
	const { state, nonce, exp } = data;
	if (typeof state !== 'string' || typeof nonce !== 'string' || typeof exp !== 'number') return null;
	if (!state || !nonce || exp <= now) return null;
	const next = typeof data.next === 'string' ? data.next : undefined;
	const expectedEmail = typeof data.expectedEmail === 'string' ? data.expectedEmail : undefined;
	const from = typeof data.from === 'string' ? data.from : undefined;
	return {
		state,
		nonce,
		exp,
		...(next ? { next } : {}),
		...(expectedEmail ? { expectedEmail } : {}),
		...(from ? { from } : {})
	};
}

export function sameToken(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}

type RsaJwk = JsonWebKey & { kid?: string };

export type IdClaims = {
	sub: string;
	email?: string;
	emailVerified: boolean;
};

export async function verifyIdToken(
	token: string,
	options: { keys: RsaJwk[]; clientId: string; nonce: string; nowSeconds?: number }
): Promise<IdClaims> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('malformed id token');
	const [headerPart, payloadPart, signaturePart] = parts;
	if (!headerPart || !payloadPart) throw new Error('malformed id token');

	const header = decodeJson(headerPart);
	if (!header || header.alg !== 'RS256') throw new Error('unexpected id token alg');
	if (!signaturePart) throw new Error('malformed id token');

	const key = signingKey(options.keys, typeof header.kid === 'string' ? header.kid : undefined);
	const cryptoKey = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'RSA', n: key.n, e: key.e, alg: 'RS256' },
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	);
	const ok = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		base64UrlDecode(signaturePart),
		encoder.encode(`${headerPart}.${payloadPart}`)
	);
	if (!ok) throw new Error('bad id token signature');

	const claims = decodeJson(payloadPart);
	if (!claims) throw new Error('malformed id token');

	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	if (claims.iss !== ISSUER) throw new Error('bad id token issuer');
	if (!audienceMatches(claims.aud, options.clientId)) throw new Error('bad id token audience');
	if (typeof claims.exp !== 'number' || claims.exp < now - SKEW_SECONDS) throw new Error('expired id token');
	if (typeof claims.iat === 'number' && claims.iat > now + SKEW_SECONDS) throw new Error('id token issued in the future');
	if (typeof claims.nbf === 'number' && claims.nbf > now + SKEW_SECONDS) throw new Error('id token not yet valid');
	if (typeof claims.nonce !== 'string' || !sameToken(claims.nonce, options.nonce)) throw new Error('bad id token nonce');
	if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('id token missing sub');

	return {
		sub: claims.sub,
		email: typeof claims.email === 'string' ? claims.email : undefined,
		emailVerified: claims.email_verified === true
	};
}

export async function verifiedEmail(options: {
	idToken: string;
	accessToken: string;
	keys: RsaJwk[];
	clientId: string;
	nonce: string;
	fetch?: typeof fetch;
	nowSeconds?: number;
}): Promise<string> {
	const claims = await verifyIdToken(options.idToken, options);
	if (claims.email) {
		if (!claims.emailVerified) throw new Error('email not verified');
		return claims.email.trim().toLowerCase();
	}
	return emailFromUserinfo(options.accessToken, claims.sub, options.fetch ?? fetch);
}

async function emailFromUserinfo(accessToken: string, expectedSub: string, fetchImpl: typeof fetch): Promise<string> {
	const res = await fetchImpl('https://auth.hackclub.com/oauth/userinfo', {
		headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) throw new Error(`userinfo ${res.status}`);
	const body = (await res.json()) as { sub?: unknown; email?: unknown; email_verified?: unknown };
	if (typeof body.sub !== 'string' || !sameToken(body.sub, expectedSub)) throw new Error('userinfo sub mismatch');
	if (body.email_verified !== true) throw new Error('email not verified');
	if (typeof body.email !== 'string' || !body.email.trim()) throw new Error('userinfo missing email');
	return body.email.trim().toLowerCase();
}

function signingKey(keys: RsaJwk[], kid: string | undefined): RsaJwk {
	const usable = keys.filter(
		(key) => key.kty === 'RSA' && key.n && key.e && (key.alg === undefined || key.alg === 'RS256')
	);
	const match = kid ? usable.filter((key) => key.kid === kid) : usable.length === 1 ? usable : [];
	if (match.length !== 1 || !match[0]) throw new Error('unknown signing key');
	return match[0];
}

function audienceMatches(aud: unknown, clientId: string): boolean {
	if (typeof aud === 'string') return sameToken(aud, clientId);
	return Array.isArray(aud) && aud.some((value) => typeof value === 'string' && sameToken(value, clientId));
}

function decodeJson(part: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
