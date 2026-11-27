import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	buildProgrammeStats,
	normalizeCountry,
	type ProgrammeParticipant
} from '../src/lib/programme-stats.ts';

const START = new Date('2026-11-27T02:00:00Z');
const END = new Date('2026-12-07T04:59:00Z');
const NOW = new Date('2026-11-29T17:00:00Z');

function person(overrides: Partial<ProgrammeParticipant>): ProgrammeParticipant {
	return {
		email: 'x@example.com',
		country: null,
		createdAt: '2026-11-25T15:00:00Z',
		joined: false,
		projectAt: null,
		connected: false,
		windowSeconds: null,
		submitted: false,
		...overrides
	};
}

test('country codes and names group together, and missing country is an explicit unknown', () => {
	assert.deepEqual(normalizeCountry('us'), { key: 'US', label: 'United States' });
	assert.equal(normalizeCountry('United States')?.key, 'US');
	assert.equal(normalizeCountry('  '), null);
	assert.equal(normalizeCountry(null), null);
	assert.deepEqual(normalizeCountry('Atlantis'), { key: 'raw:atlantis', label: 'Atlantis' });

	const stats = buildProgrammeStats(
		{
			participants: [
				person({ email: 'a@x.com', country: 'US', joined: true }),
				person({ email: 'b@x.com', country: 'United States' }),
				person({ email: 'c@x.com', country: 'IN', joined: true }),
				person({ email: 'd@x.com', country: null, joined: true }),
				person({ email: 'e@x.com', country: '' })
			],
			submissions: [],
			reviews: []
		},
		NOW,
		{ start: START, end: END }
	);
	assert.deepEqual(
		stats.countries.rows.map((row) => [row.key, row.accounts, row.joined]),
		[
			['US', 2, 1],
			['IN', 1, 1]
		]
	);
	assert.deepEqual(stats.countries.unknown, { accounts: 2, joined: 1 });
	assert.equal(stats.countries.known, 3);
	assert.equal(stats.joinRate, 60);
});

test('testers are left out, and an empty database is all zeros with no invented rates', () => {
	const stats = buildProgrammeStats(
		{ participants: [person({ email: 'Tester@X.com', joined: true })], submissions: [], reviews: [], testerEmails: 'tester@x.com' },
		NOW,
		{ start: START, end: END }
	);
	assert.equal(stats.testersExcluded, 1);
	assert.equal(stats.accounts, 0);
	assert.equal(stats.joinRate, null);
	assert.deepEqual(stats.signupsByDay, []);
	assert.equal(stats.submissions.firstReview.median, null);
	assert.equal(stats.submissions.backlog.oldestAt, null);
	assert.equal(stats.countries.unknown.accounts, 0);
});

test('hours buckets keep "no data" apart from 0h and count nudges', () => {
	const stats = buildProgrammeStats(
		{
			participants: [
				person({ email: '1@x', joined: true, windowSeconds: 0, projectAt: '2026-11-27T03:00:00Z' }),
				person({ email: '2@x', joined: true, windowSeconds: 1800, projectAt: '2026-11-27T03:00:00Z' }),
				person({ email: '3@x', joined: true, windowSeconds: 4 * 3600, projectAt: '2026-11-28T03:00:00Z' }),
				person({ email: '4@x', joined: true, windowSeconds: 5 * 3600, submitted: true, projectAt: '2026-11-28T03:00:00Z' }),
				person({ email: '5@x', joined: true, windowSeconds: 6 * 3600, projectAt: '2026-11-28T03:00:00Z' }),
				person({ email: '6@x', joined: true }),
				person({ email: '7@x', joined: false, windowSeconds: 9 * 3600 })
			],
			submissions: [],
			reviews: []
		},
		NOW,
		{ start: START, end: END }
	);
	assert.deepEqual(
		stats.hours.buckets.map((b) => [b.key, b.count]),
		[
			['zero', 1],
			['under1', 1],
			['one_to_five', 1],
			['five_plus', 2],
			['unknown', 1]
		]
	);
	assert.equal(stats.hours.hitFive, 2);
	assert.equal(stats.hours.closeToFive, 1);
	assert.equal(stats.hours.fiveNotSubmitted, 1);
	assert.equal(stats.hours.stalled, 1);
	assert.equal(stats.hours.noProject, 1);
	assert.equal(stats.joinsUndated, 1);
	const joins = Object.fromEntries(stats.joinsByDay.map((d) => [d.date, d.count]));
	assert.equal(joins['2026-11-26'], 2);
	assert.equal(joins['2026-11-27'], 3);
	assert.equal(stats.joinsByDay.at(-1)?.date, '2026-11-29');
	assert.equal(stats.joinsByDay.at(-1)?.cumulative, 5);
});

test('submission status split, turnaround and backlog age come from real timestamps', () => {
	const stats = buildProgrammeStats(
		{
			participants: [],
			submissions: [
				{ id: 1, at: '2026-11-27T10:00:00Z', stage: 'done', status: 'confirmed' },
				{ id: 2, at: '2026-11-27T10:00:00Z', stage: 'first_pass', status: 'rejected' },
				{ id: 3, at: '2026-11-28T17:00:00Z', stage: 'first_pass', status: 'pending' },
				{ id: 4, at: '2026-11-25T17:00:00Z', stage: 'fraud', status: 'pending' },
				{ id: 5, at: '2026-11-28T17:00:00Z', stage: 'first_pass', status: 'needs_changes' }
			],
			reviews: [
				{ submissionId: 1, at: '2026-11-27T12:00:00Z', decision: 'approved' },
				{ submissionId: 1, at: '2026-11-27T20:00:00Z', decision: 'clear' },
				{ submissionId: 1, at: '2026-11-28T10:00:00Z', decision: 'confirmed' },
				{ submissionId: 2, at: '2026-11-27T14:00:00Z', decision: 'rejected' },
				{ submissionId: 4, at: '2026-11-26T17:00:00Z', decision: 'approved' },
				{ submissionId: 99, at: '2026-11-26T17:00:00Z', decision: 'approved' }
			]
		},
		NOW,
		{ start: START, end: END }
	);
	const s = stats.submissions;
	assert.deepEqual([s.total, s.inReview, s.waiting, s.approved, s.rejected], [5, 2, 1, 1, 1]);
	assert.deepEqual(s.firstReview, { median: 4, average: (2 + 4 + 24) / 3, n: 3 });
	assert.deepEqual(s.decision, { median: 14, average: 14, n: 2 });
	assert.equal(s.backlog.oldestAt, '2026-11-25T17:00:00Z');
	assert.deepEqual([s.backlog.under1d, s.backlog.d1to3, s.backlog.over3d], [0, 1, 1]);
	assert.equal(s.backlog.medianAgeHours, (24 + 96) / 2);
});

test('the clock counts down to the deadline and numbers the challenge day', () => {
	const before = buildProgrammeStats({ participants: [], submissions: [], reviews: [] }, new Date('2026-11-26T20:00:00Z'), { start: START, end: END });
	assert.equal(before.clock.countdown.phase, 'until-start');
	assert.equal(before.clock.day, null);
	const during = buildProgrammeStats({ participants: [], submissions: [], reviews: [] }, NOW, { start: START, end: END });
	assert.equal(during.clock.countdown.phase, 'until-end');
	assert.equal(during.clock.day, 3);
	assert.equal(during.clock.totalDays, 11);
	const after = buildProgrammeStats({ participants: [], submissions: [], reviews: [] }, new Date('2026-12-08T00:00:00Z'), { start: START, end: END });
	assert.equal(after.clock.countdown.phase, 'done');
});
