import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeHackatimeProjects } from '../src/lib/hackatime-projects.ts';
import { projectsFromPayload } from '../src/lib/server/hackatime.ts';
import { displayName, identityFromClaims, identityFromMe, participantAfterLogin } from '../src/lib/participant-identity.ts';

test('sign-in lands on the hackathon page', () => {
	assert.equal(participantAfterLogin(true), '/hackathon');
	assert.equal(participantAfterLogin(false), '/hackathon?signin=failed');
});

test('the hack club name is trimmed and not rebuilt from first and last', () => {
	assert.equal(displayName('  McPhilbin  '), 'McPhilbin');
	const claims = identityFromClaims({
		sub: 'ident!mc',
		email: 'mc@hackclub.com',
		email_verified: true,
		name: 'McPhilbin',
		given_name: 'Mc',
		family_name: 'philbin'
	});
	assert.equal(claims?.name, 'McPhilbin');
	const merged = identityFromMe(
		{ identity: { first_name: 'Mc', last_name: 'philbin', name: '  McPhilbin  ' } },
		claims!
	);
	assert.equal(merged.name, 'McPhilbin');
	const kept = identityFromMe({ identity: { first_name: 'Mc', last_name: 'philbin' } }, claims!);
	assert.equal(kept.name, 'McPhilbin');
});

test('hackatime project payloads keep the name and the seconds', () => {
	const direct = projectsFromPayload({ projects: [{ name: 'lantern', total_seconds: 10 }] });
	assert.equal(direct?.[0]?.name, 'lantern');
	assert.equal(direct?.[0]?.totalSeconds, 10);
	const nested = projectsFromPayload({ data: { projects: [{ project: 'tide', totalSeconds: 20 }] } });
	assert.equal(nested?.[0]?.name, 'tide');
	assert.equal(nested?.[0]?.totalSeconds, 20);
});

test('eligible hackatime projects lead, junk and short projects do not', () => {
	const arranged = arrangeHackatimeProjects([
		{ name: 'vscode-typescript', seconds: 8 * 3600, hours: '8h 0m', eligible: true },
		{ name: 'lantern', seconds: 6 * 3600, hours: '6h 0m', eligible: true },
		{ name: 'tide', seconds: 20 * 3600, hours: '20h 0m', eligible: true },
		{ name: 'QWxhZGRpbjpvcGVuIHNlc2FtZQ', seconds: 9 * 3600, hours: '9h 0m', eligible: true },
		{ name: 'frost', seconds: 2 * 3600, hours: '2h 0m', eligible: false },
		{ name: 'empty', seconds: 0, hours: '0m', eligible: false },
		{ name: '   ', seconds: 4000, hours: '1h 6m', eligible: false }
	]);
	assert.deepEqual(
		arranged.eligible.map((project) => project.name),
		['tide', 'lantern', 'QWxhZGRpbjpvcGVuIHNlc2FtZQ', 'vscode-typescript']
	);
	assert.deepEqual(
		arranged.later.map((project) => project.name),
		['frost', 'empty']
	);
});
