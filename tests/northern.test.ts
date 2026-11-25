import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { airtableRecordFields, northernAirtableConfigured } from '../src/lib/airtable-fields.ts';
import {
	copiedProjectCheck,
	hackatimeLapseCheck,
	parseGithubRepo,
	priorExperienceCheck
} from '../src/lib/review-checks.ts';
import { applyDecision, approvedHours, lapseLinks, median } from '../src/lib/review-pipeline.ts';
import { hackathonKickoff } from '../src/lib/hackathon.ts';

test('the pipeline walks first pass, fraud, then hq, and send-back steps backward', () => {
	assert.deepEqual(applyDecision('first_pass', 'approved'), { stage: 'fraud', status: 'pending' });
	assert.deepEqual(applyDecision('first_pass', 'needs_changes'), { stage: 'first_pass', status: 'needs_changes' });
	assert.equal(applyDecision('first_pass', 'clear'), null);
	assert.deepEqual(applyDecision('fraud', 'clear'), { stage: 'hq', status: 'pending' });
	assert.deepEqual(applyDecision('fraud', 'sent_back'), { stage: 'first_pass', status: 'pending' });
	assert.deepEqual(applyDecision('hq', 'confirmed'), { stage: 'done', status: 'confirmed' });
	assert.deepEqual(applyDecision('hq', 'sent_back'), { stage: 'fraud', status: 'pending' });
	assert.equal(approvedHours(7200, null), 2);
	assert.equal(approvedHours(7200, 1.5), 1.5);
	assert.deepEqual(lapseLinks('https://a.test/x, b.test/y'), ['https://a.test/x', 'https://b.test/y']);
	assert.equal(lapseLinks('not a url'), null);
	assert.equal(median([4, 1, 3]), 3);
});

test('checks only flag, and a missing repo is an honest miss', () => {
	const start = hackathonKickoff();
	const missing = priorExperienceCheck({ repo: null, challengeStart: start, hackatimeBeforeSeconds: null });
	assert.equal(missing.flag, 'unavailable');
	const old = priorExperienceCheck({
		repo: {
			fullName: 'hackclub/hackatime',
			url: 'https://github.com/hackclub/hackatime',
			createdAt: '2024-01-01T00:00:00Z',
			fork: false,
			parent: null,
			template: null,
			commitsBefore: [{ date: '2024-02-01T00:00:00Z', url: 'https://github.com/hackclub/hackatime/commit/abc' }],
			contributors: [{ login: 'hackclub', url: 'https://github.com/hackclub' }],
			earlyAdditions: null,
			sameName: []
		},
		challengeStart: start,
		hackatimeBeforeSeconds: 0
	});
	assert.equal(old.flag, 'flag');
	assert.equal(copiedProjectCheck({ repo: null }).flag, 'unavailable');
	const lapse = hackatimeLapseCheck({
		project: 'lantern',
		storedSeconds: 100,
		claims: [{ id: 2, challenge: 'northern', email: 'a@hackclub.com', seconds: 100 }],
		heartbeats: null,
		challengeStart: start,
		challengeEnd: new Date(start.getTime() + 86400000),
		unavailable: "couldn't check heartbeats"
	});
	assert.equal(lapse.flag, 'flag');
	assert.match(lapse.summary, /another submission/);
});

test('airtable sync stays off the sign-ups base and maps the ysws fields', () => {
	assert.equal(northernAirtableConfigured({ token: '', baseId: 'base', table: 'YSWS' }).error, 'Airtable sync is not configured');
	assert.match(
		northernAirtableConfigured({ token: 't', baseId: 'signups', table: 'YSWS', signupsBaseId: 'signups' }).error ?? '',
		/sign-ups/
	);
	const fields = airtableRecordFields({
		email: 'ada@hackclub.com',
		repoUrl: 'https://github.com/hackclub/lantern',
		demoUrl: 'https://lantern.example',
		description: 'a light',
		githubUsername: null,
		hackatimeUserId: 'ht-1',
		hackatimeProject: 'lantern',
		hackatimeSeconds: 6 * 3600,
		lapseLinks: ['https://lapse.example/1'],
		technicalFeatures: 'pwm',
		deflationJustification: 'counted pauses',
		alternateTracking: '',
		additionalJustification: 'notes',
		note: 'looks good',
		overrideHours: 4
	});
	assert.equal(fields['Code URL'], 'https://github.com/hackclub/lantern');
	assert.equal(fields['Justification - Lapse Links, comma-separated'], 'https://lapse.example/1');
	assert.equal(fields['Justification - Specific Technical Features'], 'pwm');
	assert.equal(fields['Justification - Deflation Justification'], 'counted pauses');
	assert.equal(fields['Justification - Alternate Tracking Method'], '');
	assert.equal(fields['Optional - Override Hours Spent'], 4);
	assert.equal(fields['Approved Hours'], 4);
	assert.equal(parseGithubRepo('https://github.com/hackclub/hackatime.git')?.repo, 'hackatime');
});

test('the migration creates tables and does not remove them', () => {
	const sql = readFileSync(new URL('../migrations/001_northern_challenge.sql', import.meta.url), 'utf8');
	assert.match(sql, /CREATE TABLE IF NOT EXISTS submissions/);
	assert.match(sql, /CREATE TABLE IF NOT EXISTS airtable_outbox/);
	assert.match(sql, /CREATE TABLE IF NOT EXISTS reviewer_audit/);
	assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
	assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
});
