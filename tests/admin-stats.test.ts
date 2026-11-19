import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	authorizeUrl,
	callbackUrl,
	openOauth,
	openSealed,
	openSession,
	sameToken,
	seal,
	sealOauth,
	sealSession,
	verifiedEmail,
	verifyIdToken
} from '../src/lib/server/admin-auth.ts';
import {
	adminAllowlist,
	daysSinceFirstSignup,
	formatSignupStats,
	adminCallbackDecision,
	isAdminEmail,
	isAdminEntryEmail,
	readSignups,
	signupName,
	summarizeSignups,
	tallySignups,
	type AirtablePage
} from '../src/lib/signup-stats.ts';

const SECRET = 'test-session-secret';

test('counts every page and keeps the earliest sign-up', async () => {
	const pages: Record<string, AirtablePage> = {
		'': {
			records: [
				{ createdTime: '2026-11-17T00:00:00.000Z', fields: { Email: 'a@hackclub.com' } },
				{ createdTime: '2026-11-18T00:00:00.000Z', fields: { Email: ' ' } }
			],
			offset: 'page-2'
		},
		'page-2': {
			records: [
				{ createdTime: '2026-11-15T03:00:00.000Z', fields: { Email: 'b@hackclub.com' } },
				{ createdTime: '2026-11-16T00:00:00.000Z', fields: { Email: 12 } }
			],
			offset: 'page-3'
		},
		'page-3': {
			records: [{ createdTime: '2026-11-19T00:00:00.000Z', fields: { Email: 'c@hackclub.com' } }]
		}
	};
	const seen: string[] = [];
	const tally = await tallySignups(async (offset) => {
		seen.push(offset);
		const page = pages[offset];
		if (!page) throw new Error(`missing ${offset}`);
		return page;
	});

	assert.deepEqual(seen, ['', 'page-2', 'page-3']);
	assert.equal(tally.count, 3);
	assert.equal(tally.firstCreatedAt, '2026-11-15T03:00:00.000Z');
	assert.equal(
		formatSignupStats(tally.count, daysSinceFirstSignup(tally.firstCreatedAt, new Date('2026-11-19T22:00:00.000Z'))),
		'3 sign-ups in 5 days'
	);
});

test('stops when a page repeats its offset instead of looping', async () => {
	await assert.rejects(
		() => tallySignups(async () => ({ records: [], offset: 'again' })),
		/offset repeated/
	);
});

test('days include the first day and today', () => {
	const now = new Date('2026-11-19T01:00:00.000Z');
	assert.equal(daysSinceFirstSignup('2026-11-19T23:30:00.000Z', now), 1);
	assert.equal(daysSinceFirstSignup('2026-11-15T23:00:00.000Z', now), 5);
	assert.equal(daysSinceFirstSignup('2026-11-30T12:00:00.000Z', new Date('2026-12-01T00:30:00.000Z')), 2);
});

test('formats the stats line', () => {
	assert.equal(formatSignupStats(412, 5), '412 sign-ups in 5 days');
	assert.equal(formatSignupStats(1, 1), '1 sign-up in 1 day');
	assert.equal(formatSignupStats(0, null), '0 sign-ups');
});

test('allowlist defaults to johnny and ignores case and spaces', () => {
	assert.deepEqual([...adminAllowlist(undefined)], ['johnny@hackclub.com']);
	assert.deepEqual([...adminAllowlist('  ')], ['johnny@hackclub.com']);
	assert.equal(isAdminEmail('Johnny@HackClub.com', undefined), true);
	assert.equal(isAdminEmail('ada@hackclub.com', ' johnny@hackclub.com, Ada@HackClub.com '), true);
	assert.equal(isAdminEmail('ada@hackclub.com', 'johnny@hackclub.com'), false);
});

test('authorize url is the hack club auth endpoint and keeps the secret off it', () => {
	const url = new URL(
		authorizeUrl({
			clientId: 'client-id',
			redirectUri: 'https://fjording.hackclub.com/admin/auth/callback',
			state: 'state',
			nonce: 'nonce',
			loginHint: 'johnny@hackclub.com'
		})
	);

	assert.equal(callbackUrl('https://fjording.hackclub.com'), 'https://fjording.hackclub.com/admin/auth/callback');
	assert.equal(url.origin + url.pathname, 'https://auth.hackclub.com/oauth/authorize');
	assert.equal(url.searchParams.get('redirect_uri'), 'https://fjording.hackclub.com/admin/auth/callback');
	assert.equal(url.searchParams.get('response_type'), 'code');
	assert.equal(url.searchParams.get('scope'), 'openid email');
	assert.equal(url.searchParams.get('state'), 'state');
	assert.equal(url.searchParams.get('nonce'), 'nonce');
	assert.equal(url.searchParams.get('login_hint'), 'johnny@hackclub.com');
	assert.equal(url.searchParams.get('email'), 'johnny@hackclub.com');
	assert.equal(url.searchParams.get('client_secret'), null);
});

test('session cookie round-trips and rejects tampering, expiry, and the wrong secret', async () => {
	const token = await sealSession('johnny@hackclub.com', SECRET, 1_000);
	assert.equal(await openSession(token, SECRET, 1_000), 'johnny@hackclub.com');
	assert.equal(await openSession(token, SECRET, 1_000 + 7 * 24 * 60 * 60 * 1000), null);
	assert.equal(await openSession(token, 'other-secret', 1_000), null);
	const [body, signature] = token.split('.');
	assert.equal(await openSession(`${body}x.${signature}`, SECRET, 1_000), null);
	assert.equal(await openSealed('nope', SECRET), null);

	const oauth = await sealOauth({ state: 'abc', nonce: 'def', exp: 5_000 }, SECRET);
	assert.deepEqual(await openOauth(oauth, SECRET, 4_000), { state: 'abc', nonce: 'def', exp: 5_000 });
	assert.equal(await openOauth(oauth, SECRET, 5_000), null);
	assert.equal(sameToken('abc', 'abc'), true);
	assert.equal(sameToken('abc', 'abd'), false);
});

test('id token must be a verified email for this client', async () => {
	const { publicKey, privateKey } = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	);
	const jwk = await crypto.subtle.exportKey('jwk', publicKey);
	jwk.kid = 'test-key';
	jwk.alg = 'RS256';
	const now = 1_700_000_000;

	async function token(claims: object, alg = 'RS256', kid = 'test-key') {
		const header = base64Url(JSON.stringify({ alg, kid, typ: 'JWT' }));
		const payload = base64Url(JSON.stringify(claims));
		const data = `${header}.${payload}`;
		if (alg === 'none') return `${data}.`;
		const signature = new Uint8Array(
			await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, privateKey, new TextEncoder().encode(data))
		);
		return `${data}.${base64UrlBytes(signature)}`;
	}

	const good = {
		iss: 'https://auth.hackclub.com',
		sub: 'ident!johnny',
		aud: 'client-id',
		exp: now + 600,
		iat: now,
		nonce: 'nonce',
		email: 'Johnny@HackClub.com',
		email_verified: true
	};

	assert.deepEqual(await verifyIdToken(await token(good), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }), {
		sub: 'ident!johnny',
		email: 'Johnny@HackClub.com',
		emailVerified: true
	});

	const email = await verifiedEmail({
		idToken: await token(good),
		accessToken: 'access',
		keys: [jwk],
		clientId: 'client-id',
		nonce: 'nonce',
		nowSeconds: now
	});
	assert.equal(email, 'johnny@hackclub.com');

	await assert.rejects(
		async () => verifyIdToken(await token({ ...good, nonce: 'other' }), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }),
		/nonce/
	);
	await assert.rejects(
		async () => verifyIdToken(await token({ ...good, aud: 'other-app' }), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }),
		/audience/
	);
	await assert.rejects(
		async () => verifyIdToken(await token({ ...good, exp: now - 120 }), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }),
		/expired/
	);
	await assert.rejects(
		async () => verifyIdToken(await token(good, 'none'), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }),
		/alg/
	);
	await assert.rejects(
		async () => verifyIdToken(await token(good, 'RS256', 'other-key'), { keys: [jwk], clientId: 'client-id', nonce: 'nonce', nowSeconds: now }),
		/signing key/
	);

	const tampered = await token(good);
	const [header, , signature] = tampered.split('.');
	const flipped = await token({ ...good, email: 'ada@hackclub.com' });
	const [, flippedPayload] = flipped.split('.');
	await assert.rejects(
		() =>
			verifyIdToken(`${header}.${flippedPayload}.${signature}`, {
				keys: [jwk],
				clientId: 'client-id',
				nonce: 'nonce',
				nowSeconds: now
			}),
		/signature/
	);

	let userinfoCalled = false;
	await assert.rejects(
		async () =>
			verifiedEmail({
				idToken: await token({ ...good, email_verified: false }),
				accessToken: 'access',
				keys: [jwk],
				clientId: 'client-id',
				nonce: 'nonce',
				nowSeconds: now,
				fetch: async () => {
					userinfoCalled = true;
					return new Response('{}');
				}
			}),
		/not verified/
	);
	assert.equal(userinfoCalled, false);

	const fromUserinfo = await verifiedEmail({
		idToken: await token({ ...good, email: undefined, email_verified: undefined }),
		accessToken: 'access-token',
		keys: [jwk],
		clientId: 'client-id',
		nonce: 'nonce',
		nowSeconds: now,
		fetch: async (input, init) => {
			assert.equal(input, 'https://auth.hackclub.com/oauth/userinfo');
			assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer access-token');
			return Response.json({ sub: 'ident!johnny', email: 'Johnny@HackClub.com', email_verified: true });
		}
	});
	assert.equal(fromUserinfo, 'johnny@hackclub.com');
});

test('charts use eastern time, keep the utc headline, and drop emails', async () => {
	const now = new Date('2026-11-19T15:00:00.000Z');
	const { count, events } = await readSignups(async () => ({
		records: [
			{
				createdTime: '2026-11-19T04:30:00.000Z',
				fields: { Email: 'secret@hackclub.com', Name: 'Ada Lovelace' }
			},
			{
				createdTime: '2026-11-17T15:00:00.000Z',
				fields: { Email: 'other@hackclub.com', Name: 'ada@hackclub.com', 'First Name': 'Grace', 'Last Name': 'H' }
			},
			{ createdTime: 'not-a-date', fields: { Email: 'counted@hackclub.com' } },
			{ createdTime: '2026-11-17T16:30:00.000Z', fields: { Email: 'third@hackclub.com' } }
		]
	}));

	assert.equal(count, 4);
	assert.equal(events.length, 3);
	assert.equal(JSON.stringify({ count, events }).includes('@'), false);
	assert.equal(events[0]?.name, 'Ada Lovelace');
	assert.equal(events[1]?.name, 'Grace H');
	assert.equal(events[2]?.name, undefined);
	assert.equal(signupName({ Name: '  ' }), undefined);

	const report = summarizeSignups(count, events, now);
	const span = daysSinceFirstSignup('2026-11-17T15:00:00.000Z', now);
	assert.equal(report.line, formatSignupStats(4, span));
	assert.equal(report.today, 0);
	assert.equal(report.perDay, '1.3');
	assert.deepEqual(
		report.daysSeries.map((day) => [day.date, day.count, day.cumulative]),
		[
			['2026-11-17', 2, 2],
			['2026-11-18', 1, 3],
			['2026-11-19', 0, 3]
		]
	);
	assert.equal(report.hours[10].count, 1);
	assert.equal(report.hours[11].count, 1);
	assert.equal(report.hours[23].count, 1);
	assert.equal(
		report.hours.reduce((sum, hour) => sum + hour.count, 0),
		3
	);
	assert.deepEqual(
		report.recent.map((row) => row.when),
		['Nov 18, 11:30 PM', 'Nov 17, 11:30 AM', 'Nov 17, 10:00 AM']
	);
	assert.equal(report.recent[0]?.name, 'Ada Lovelace');
	assert.equal(report.hasNames, true);
	assert.equal(JSON.stringify(report).includes('@'), false);
});

test('daily series stays continuous across the daylight saving change', () => {
	const report = summarizeSignups(
		2,
		[
			{ at: '2026-03-07T17:00:00.000Z' },
			{ at: '2026-03-09T17:00:00.000Z' },
			{ at: '2026-11-01T04:30:00.000Z' }
		],
		new Date('2026-11-01T16:00:00.000Z')
	);
	const dates = report.daysSeries.map((day) => day.date);
	assert.equal(dates[0], '2026-03-07');
	assert.ok(dates.includes('2026-03-08'));
	assert.ok(dates.includes('2026-11-01'));
	assert.equal(dates.at(-1), '2026-11-01');
	for (let i = 1; i < report.daysSeries.length; i++) {
		assert.ok(report.daysSeries[i].cumulative >= report.daysSeries[i - 1].cumulative);
	}
	assert.equal(report.daysSeries.at(-1)?.cumulative, 3);
});

test('latest list keeps the 20 newest timestamps', () => {
	const events = Array.from({ length: 25 }, (_, index) => ({
		at: new Date(Date.UTC(2026, 10, 1, index)).toISOString()
	}));
	const report = summarizeSignups(25, events, new Date('2026-11-02T12:00:00.000Z'));
	assert.equal(report.recent.length, 20);
	assert.equal(report.recent[0]?.at, events[24]?.at);
	assert.equal(report.recent.at(-1)?.at, events[5]?.at);
	assert.equal(report.hasNames, false);
});

test('another email stays on the normal rsvp path', () => {
	assert.equal(isAdminEntryEmail('ada@hackclub.com'), false);
	assert.equal(isAdminEntryEmail('notjohnny@hackclub.com'), false);
	assert.equal(isAdminEntryEmail('johnny@hackclub.co'), false);
	assert.equal(isAdminEntryEmail('johnny@hackclub.com.evil.com'), false);
	assert.equal(isAdminEntryEmail('johnny+stats@hackclub.com'), false);
});

test('johnny email routes to admin auth', () => {
	assert.equal(isAdminEntryEmail('johnny@hackclub.com'), true);
	assert.equal(isAdminEntryEmail('  Johnny@HackClub.com '), true);
	assert.equal(isAdminEntryEmail('johnny@hackclub.com\n'), true);
});

test('non-allowlisted auth callback is denied', () => {
	assert.deepEqual([...adminAllowlist(undefined)], ['johnny@hackclub.com']);
	assert.equal(adminCallbackDecision('ada@hackclub.com', undefined), 'deny');
	assert.equal(adminCallbackDecision('ada@hackclub.com', 'johnny@hackclub.com'), 'deny');
	assert.equal(adminCallbackDecision('johnny@hackclub.com', undefined), 'allow');
	assert.equal(adminCallbackDecision('  Johnny@HackClub.com ', 'johnny@hackclub.com'), 'allow');
});

test('sealed payload that is not an object is ignored', async () => {
	const token = await seal(['nope'], SECRET);
	assert.equal(await openSealed(token, SECRET), null);
});

function base64Url(value: string) {
	return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
