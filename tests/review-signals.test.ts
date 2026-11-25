import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReviewSignals, type SignalFacts } from '../src/lib/review-signals.ts';

const empty: SignalFacts = {
	githubAccountCreated: null,
	publicRepoCount: null,
	priorSubmissions: null,
	fork: null,
	forkParent: null,
	firstCommitAt: null,
	firstCommitAdditions: null,
	earliestCommitBeforeEvent: null,
	commitsBeforeEvent: null,
	duplicateRepoIds: null,
	otherClaims: null,
	secondsBeforeWindow: null,
	secondsAfterWindow: null,
	windowSeconds: null,
	heartbeatOverlaps: null,
	eventStart: '2026-11-27T05:00:00.000Z'
};

test('missing review data stays unknown and does not look like a rejection', () => {
	const signals = buildReviewSignals(empty);
	assert.deepEqual(
		signals.map((signal) => signal.state),
		['unknown', 'unknown', 'unknown']
	);
	assert.ok(signals.every((signal) => signal.lines.some((line) => line.value === 'not checked')));
});

test('real prior work, a copied repo, and overlapping hours are signals to look at', () => {
	const signals = buildReviewSignals({
		...empty,
		githubAccountCreated: '2020-01-01T00:00:00.000Z',
		publicRepoCount: 12,
		priorSubmissions: [{ id: 4, challenge: 'northern', project: 'lantern' }],
		commitsBeforeEvent: 2,
		fork: true,
		forkParent: { name: 'hackclub/some-template', url: 'https://github.com/hackclub/some-template' },
		firstCommitAt: '2024-01-01T00:00:00.000Z',
		firstCommitAdditions: 2400,
		earliestCommitBeforeEvent: '2024-02-01T00:00:00.000Z',
		duplicateRepoIds: [2, 3],
		otherClaims: [{ id: 2, project: 'tide', seconds: 7200 }],
		secondsBeforeWindow: 3600,
		secondsAfterWindow: 0,
		windowSeconds: 18000,
		heartbeatOverlaps: ['tide overlaps lantern']
	});
	assert.deepEqual(
		signals.map((signal) => [signal.key, signal.state]),
		[
			['prior_experience', 'look'],
			['copied_project', 'look'],
			['hackatime_lapse', 'look']
		]
	);
	const copy = signals[1].lines.find((line) => line.label === 'same repo on another submission');
	assert.equal(copy?.value, '#2, #3');
	const hours = signals[2].lines.find((line) => line.label === 'hackatime total inside the event window');
	assert.equal(hours?.value, '18000s');
	assert.equal(hours?.state, 'clear');
});

test('a checked person with nothing earlier stays clear', () => {
	const signals = buildReviewSignals({
		...empty,
		githubAccountCreated: '2026-11-28T00:00:00.000Z',
		publicRepoCount: 0,
		priorSubmissions: [],
		commitsBeforeEvent: 0,
		fork: false,
		firstCommitAt: '2026-11-28T00:00:00.000Z',
		firstCommitAdditions: 40,
		earliestCommitBeforeEvent: null,
		duplicateRepoIds: [],
		otherClaims: [],
		secondsBeforeWindow: 0,
		secondsAfterWindow: 0,
		windowSeconds: 20000,
		heartbeatOverlaps: []
	});
	assert.ok(signals.every((signal) => signal.state === 'clear'));
});
