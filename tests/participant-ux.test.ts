import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codingWindow, secondsOnDay, spansFromPayload } from '../src/lib/coding-days.ts';
import { allHackatimeProjects, arrangeHackatimeProjects } from '../src/lib/hackatime-projects.ts';
import { fetchHackatimeProjects, HACKATIME_PROJECT_PATHS, hoursLine, projectsFromPayload } from '../src/lib/server/hackatime.ts';
import { afterSignIn, displayName, identityFromClaims, identityFromMe, participantAfterLogin } from '../src/lib/participant-identity.ts';

test('sign-in lands on the hackathon page', () => {
	assert.equal(participantAfterLogin(true), '/hackathon');
	assert.equal(participantAfterLogin(true, true), '/hackathon/start');
	assert.equal(participantAfterLogin(false), '/hackathon?signin=failed');
});

test('homepage sign-in asks before setup, and a hackathon sign-in does not', () => {
	assert.equal(afterSignIn({ ok: true, from: '/', choice: null, hasProject: false }), '/hackathon/join');
	assert.equal(afterSignIn({ ok: true, from: '/', choice: 'in', hasProject: false }), '/hackathon/start');
	assert.equal(afterSignIn({ ok: true, from: '/', choice: 'later', hasProject: false }), '/hackathon');
	assert.equal(afterSignIn({ ok: true, from: '/hackathon', choice: null, hasProject: false }), '/hackathon/start');
	assert.equal(afterSignIn({ ok: true, from: '/hackathon/submit', choice: null, hasProject: true }), '/hackathon');
	assert.equal(afterSignIn({ ok: false, from: '/', choice: null, hasProject: false }), '/hackathon?signin=failed');
});

test('the setup list keeps short projects, and the tracker is zero before kickoff', () => {
	const listed = allHackatimeProjects([
		{ name: 'short', seconds: 100, hours: '1m', eligible: false },
		{ name: 'long', seconds: 20000, hours: '5h 33m', eligible: true }
	]);
	assert.deepEqual(listed.map((project) => project.name), ['long', 'short']);
	assert.deepEqual(hoursLine(null, true), { hours: '0m', unknown: false });
	assert.equal(hoursLine(null, false).unknown, true);
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

test('coding time on a linked project counts for that ET day', () => {
	const spans = spansFromPayload(
		{ spans: [{ project: 'lantern', start_time: Date.parse('2026-11-27T15:00:00Z'), duration: 3600 }] },
		'lantern'
	);
	assert.ok(spans);
	assert.ok(secondsOnDay(spans!, '2026-11-27') > 0);
	assert.equal(secondsOnDay(spans!, '2026-11-28'), 0);
	const other = spansFromPayload(
		{ spans: [{ project: 'tide', start_time: Date.parse('2026-11-27T15:00:00Z'), duration: 3600 }] },
		'lantern'
	);
	assert.equal(other?.length, 0);
	const window = codingWindow([{ day: '2026-11-27', people: 2, seconds: 7200 }], '2026-11-27');
	assert.equal(window.today, 2);
	assert.equal(window.days[0]?.people, 2);
	assert.equal(window.days[0]?.hours, 2);
	assert.equal(window.days.length, 10);
});

test('the project picker uses the all-time list and skips an empty first response', async () => {
	assert.ok(HACKATIME_PROJECT_PATHS.every((path) => !path.includes('start_date') && !path.includes('2026-11-27')));
	const calls: string[] = [];
	const projects = await fetchHackatimeProjects('token', async (url) => {
		calls.push(String(url));
		if (String(url).endsWith('/authenticated/projects')) {
			return new Response(JSON.stringify({ projects: [] }), { status: 200 });
		}
		if (String(url).includes('/users/my/stats')) {
			return new Response(
				JSON.stringify({
					data: {
						range: 'all_time',
						projects: [
							{ name: 'Compsci', total_seconds: 14432 },
							{ name: 'Boxed-In', total_seconds: 800 }
						]
					}
				}),
				{ status: 200 }
			);
		}
		return new Response(JSON.stringify({ projects: [] }), { status: 200 });
	});
	assert.deepEqual(projects?.map((project) => project.name), ['Compsci', 'Boxed-In']);
	assert.ok(calls.every((url) => !url.includes('start_date') && !url.includes('2026-11-27')));
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
