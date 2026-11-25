import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openSession, openSessionClaims, seal, sealSession, sessionHandle } from '../src/lib/server/admin-auth.ts';
import {
	countdownAt,
	hackathonAllowed,
	hackathonDeadline,
	hackathonKickoff
} from '../src/lib/hackathon.ts';
import { hackathonNav } from '../src/lib/hackathon-nav.ts';

const SECRET = 'test-session-secret';

test('public hackathon nav stays free of admin links', () => {
	const labels = (status: 'in' | 'reviewer' | 'denied' | 'out', participant = false) =>
		hackathonNav(status, participant).public.map((link) => link.label);
	const publicLabels = ['The Northern Challenge', 'prizes', 'rules', 'submit', 'sign in'];
	assert.deepEqual(labels('out'), publicLabels);
	assert.deepEqual(labels('denied'), publicLabels);
	assert.equal(hackathonNav('out').staff, null);
	assert.equal(hackathonNav('denied').staff, null);

	const signedIn = hackathonNav('out', true);
	assert.equal(signedIn.staff, null);
	assert.deepEqual(
		signedIn.public.map((link) => link.label),
		['The Northern Challenge', 'prizes', 'rules', 'submit']
	);

	assert.equal(hackathonNav('in').staff, 'owner');
	assert.equal(hackathonNav('reviewer').staff, 'reviewer');
	assert.ok(!labels('in').includes('Stats'));
	assert.ok(!labels('reviewer').includes('Reviews'));
});

test('hackathon stays hidden unless the visitor is an allowed admin', () => {
	assert.equal(hackathonAllowed('in'), true);
	assert.equal(hackathonAllowed('out'), false);
	assert.equal(hackathonAllowed('denied'), false);
});

test('countdown runs to kickoff, then to 11:59pm ET on dec 6', () => {
	const start = hackathonKickoff();
	const end = hackathonDeadline();
	assert.equal(start.toISOString(), '2026-11-27T05:00:00.000Z');
	assert.equal(end.toISOString(), '2026-12-07T04:59:00.000Z');

	const before = countdownAt(new Date('2026-11-25T05:00:00.000Z'), start, end);
	assert.equal(before.phase, 'until-start');
	assert.equal(before.label, 'kicks off in');
	assert.equal(before.days, '02');
	assert.equal(before.hours, '00');
	assert.equal(before.minutes, '00');

	const atStart = countdownAt(start, start, end);
	assert.equal(atStart.phase, 'until-end');
	assert.equal(atStart.label, 'time left');

	const atEnd = countdownAt(end, start, end);
	assert.equal(atEnd.phase, 'done');
	assert.equal(atEnd.label, "that's a wrap");
});

test('a session handle is shown only when the cookie actually has one', async () => {
	assert.equal(sessionHandle(undefined), null);
	assert.equal(sessionHandle('johnny@hackclub.com'), null);
	assert.equal(sessionHandle('@johnny'), '@johnny');
	assert.equal(sessionHandle('johnny'), '@johnny');
	assert.equal(sessionHandle('not a handle'), null);

	const plain = await sealSession('johnny@hackclub.com', SECRET, 1_000);
	assert.equal(await openSession(plain, SECRET, 1_000), 'johnny@hackclub.com');
	assert.equal((await openSessionClaims(plain, SECRET, 1_000))?.handle, null);

	const tagged = await seal({ email: 'johnny@hackclub.com', exp: 10_000, handle: '@johnny' }, SECRET);
	assert.equal((await openSessionClaims(tagged, SECRET, 1_000))?.handle, '@johnny');
});
