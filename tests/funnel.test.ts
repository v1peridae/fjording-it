import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FUNNEL_SQL, funnelFromRow, funnelStages } from '../src/lib/funnel.ts';

test('the funnel query reads participants, hackatime, and northern submissions', () => {
	assert.match(FUNNEL_SQL, /FROM participants/);
	assert.match(FUNNEL_SQL, /hackatime_connections/);
	assert.match(FUNNEL_SQL, /challenge = 'northern'/);
	assert.match(FUNNEL_SQL, /status = 'confirmed'/);
	assert.match(FUNNEL_SQL, /override_hours/);
	assert.doesNotMatch(FUNNEL_SQL, /test/i);

	const counts = funnelFromRow({
		signed_up: '4',
		opted_in: 3,
		connected: 2,
		added_project: 2,
		submitted: 3,
		approved: 1,
		approved_hours: '7.25'
	});
	const funnel = funnelStages(counts);
	assert.equal(funnel.approvedHours, 7.3);
	assert.deepEqual(
		funnel.stages.map((stage) => [stage.label, stage.count, stage.ofPrevious, stage.ofSignups]),
		[
			['signed up', 4, null, 100],
			['opted in', 3, 75, 75],
			['connected hackatime', 2, 66.7, 50],
			['added a project', 2, 100, 50],
			['submitted', 3, 150, 75],
			['approved', 1, 33.3, 25]
		]
	);
});

test('an empty database stays at zero without a percent', () => {
	const funnel = funnelStages(funnelFromRow({}));
	assert.equal(funnel.approvedHours, 0);
	assert.deepEqual(
		funnel.stages.map((stage) => stage.count),
		[0, 0, 0, 0, 0, 0]
	);
	assert.ok(funnel.stages.every((stage) => stage.ofSignups == null));
	assert.equal(funnel.stages[0].ofPrevious, null);
	assert.equal(funnel.stages[1].ofPrevious, null);
});
