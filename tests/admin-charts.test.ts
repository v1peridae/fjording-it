import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAdminHome, pipelineColumns } from '../src/lib/admin-charts.ts';

const now = new Date('2026-11-25T16:00:00Z');

test('an empty database stays empty', () => {
	const home = buildAdminHome(
		{
			challenges: [{ slug: 'northern', name: 'The Northern Challenge' }],
			submissions: [],
			confirms: [],
			flags: [],
			flagRuns: [],
			reviews: [],
			unsynced: 0,
			synced: 0
		},
		now
	);
	assert.equal(home.submissions, 0);
	assert.equal(home.oldest, null);
	assert.deepEqual(home.charts.submissions, []);
	assert.deepEqual(home.charts.pipeline, []);
	assert.deepEqual(home.charts.approved, []);
	assert.equal(home.charts.throughput.days.length, 0);
});

test('pipeline, hours, and flags come from the rows', () => {
	const home = buildAdminHome(
		{
			challenges: [{ slug: 'northern', name: 'The Northern Challenge' }],
			submissions: [
				row(1, '2026-11-24T18:00:00Z', 'first_pass', 'pending', 6 * 3600, null),
				row(2, '2026-11-25T15:00:00Z', 'done', 'confirmed', 4 * 3600, 7)
			],
			confirms: [{ at: '2026-11-25T15:30:00Z', hours: 7, submissionId: 2 }],
			flags: [{ submissionId: 1, kind: 'prior_experience' }],
			flagRuns: [
				{ kind: 'prior_experience', flagged: 1, ran: 2 },
				{ kind: 'copied_project', flagged: 0, ran: 2 }
			],
			reviews: [
				{ at: '2026-11-25T15:00:00Z', email: 'ada@hackclub.com' },
				{ at: '2026-11-25T15:30:00Z', email: 'ada@hackclub.com' }
			],
			unsynced: 1,
			synced: 0
		},
		now
	);
	assert.equal(home.northern, 2);
	assert.equal(home.flagged, 1);
	assert.equal(home.approvedHours, 7);
	assert.equal(home.eligibleShips, 1);
	assert.equal(home.oldest?.id, 1);
	assert.equal(home.charts.pipeline.find((column) => column.key === 'first_pass')?.total, 1);
	assert.equal(home.charts.pipeline.find((column) => column.key === 'approved')?.total, 1);
	assert.equal(home.charts.approved.at(-1)?.cumulative, 7);
	assert.equal(home.charts.flags[0]?.label, 'prior experience');
	assert.equal(home.charts.throughput.reviewers[0], 'ada@hackclub.com');
	assert.equal(pipelineColumns([]).length, 4);
});

function row(id: number, at: string, stage: string, status: string, seconds: number, overrideHours: number | null) {
	return {
		id,
		at,
		challenge: 'northern',
		stage,
		status,
		email: 'ship@hackclub.com',
		projectName: 'lantern',
		seconds,
		overrideHours
	};
}
