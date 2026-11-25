import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertCreateOnly } from '../src/lib/migrations.ts';
import { addressCheck, ageCheck, identityFromClaims, identityFromMe, PARTICIPANT_SCOPES } from '../src/lib/participant-identity.ts';
import { northernIsPublic } from '../src/lib/northern-access.ts';
import { airtableRecordFields, northernAirtableConfigured } from '../src/lib/airtable-fields.ts';
import {
	copiedProjectCheck,
	hackatimeLapseCheck,
	parseGithubRepo,
	priorExperienceCheck
} from '../src/lib/review-checks.ts';
import { applyDecision, approvedHours, lapseLinks, median } from '../src/lib/review-pipeline.ts';
import { hackathonKickoff } from '../src/lib/hackathon.ts';
import { canSubmit, hoursEligible, presubmitTester, submitPhase } from '../src/lib/northern.ts';

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
		overrideHours: 4,
		windowLabel: '2026-11-27 to 2026-12-06',
		firstName: 'Ada'
	});
	assert.equal(fields['First Name'], 'Ada');
	assert.equal(fields['Code URL'], 'https://github.com/hackclub/lantern');
	assert.equal(fields['Justification - Lapse Links, comma-separated'], 'https://lapse.example/1');
	assert.equal(fields['Justification - Specific Technical Features'], 'pwm');
	assert.equal(fields['Justification - Deflation Justification'], 'counted pauses');
	assert.equal(fields['Optional - Override Hours Spent'], 4);
	assert.equal(fields['Optional - Override Hours Spent Justification'], 'counted pauses');
	assert.equal(fields['Approved Hours'], undefined);
	assert.equal(fields['Automation - Submit to Unified YSWS'], undefined);
	assert.equal(parseGithubRepo('https://github.com/hackclub/hackatime.git')?.repo, 'hackatime');
});

test('the migration creates tables and does not remove them', () => {
	const sql = readFileSync(new URL('../migrations/001_northern_challenge.sql', import.meta.url), 'utf8');
	assert.match(sql, /CREATE TABLE IF NOT EXISTS submissions/);
	assert.match(sql, /CREATE TABLE IF NOT EXISTS airtable_outbox/);
	assert.match(sql, /CREATE TABLE IF NOT EXISTS reviewer_audit/);
	assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
	assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
	assertCreateOnly('001_northern_challenge.sql', sql);
	assert.throws(() => assertCreateOnly('bad.sql', 'DROP TABLE submissions'), /create-only/);
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
		scripts: { start: string };
		engines: { node: string };
	};
	assert.equal(pkg.scripts.start, 'node build');
	assert.match(pkg.engines.node, />=22\.17/);
	const participants = readFileSync(new URL('../migrations/002_participants.sql', import.meta.url), 'utf8');
	assert.match(participants, /CREATE TABLE IF NOT EXISTS participants/);
	assert.match(participants, /submissions_one_hackatime_project/);
	assertCreateOnly('002_participants.sql', participants);
	assert.equal(northernIsPublic('true'), true);
	assert.equal(northernIsPublic('false'), false);
	assert.equal(northernIsPublic(undefined), false);
	const identity = identityFromClaims({
		sub: 'ident!abc',
		email: 'Ada@hackclub.com',
		email_verified: true,
		given_name: 'Ada',
		family_name: 'Lovelace',
		slack_id: 'U123',
		verification_status: 'verified',
		address: { street_address: '1 Main\nApt 2', locality: 'Shelburne', region: 'VT', postal_code: '05482', country: 'US' }
	});
	assert.equal(identity?.email, 'ada@hackclub.com');
	assert.equal(identity?.slackId, 'U123');
	assert.equal(identity?.address?.line2, 'Apt 2');
	assert.equal(identity?.birthday, null);
	const withBirthday = identityFromMe({ identity: { birthday: '2008-01-02', addresses: [] } }, identity!);
	assert.equal(withBirthday.birthday, '2008-01-02');
	assert.equal(ageCheck(withBirthday.birthday), 'recorded');
	assert.equal(addressCheck(withBirthday.address), 'recorded');
});

test('participant sign-in omits address and birthday and treats them as unknown', () => {
	assert.equal(PARTICIPANT_SCOPES, 'openid profile email name slack_id verification_status');
	assert.equal(/\baddress\b/.test(PARTICIPANT_SCOPES), false);
	assert.equal(/\bbirthdate\b/.test(PARTICIPANT_SCOPES), false);
	const bare = identityFromClaims({ sub: 'ident!1', email: 'a@hackclub.com', email_verified: true });
	assert.ok(bare);
	assert.equal(ageCheck(bare?.birthday), 'unknown');
	assert.equal(addressCheck(bare?.address), 'unknown');
	const messy = identityFromMe(
		{ identity: { addresses: 'not-a-list', birthday: { year: 2008 }, verification_status: 'pending' } },
		bare!
	);
	assert.equal(messy.verificationStatus, 'pending');
	assert.equal(messy.birthday, null);
	assert.equal(ageCheck(messy.birthday), 'unknown');
	assert.equal(addressCheck(messy.address), 'unknown');
	assert.equal(identityFromMe(null, bare!), bare);
});

test('presubmit testers can submit before kickoff; a normal participant cannot', () => {
	const before = new Date('2026-11-26T12:00:00.000Z');
	const list = 'johnathanmcphilbin2@gmail.com, other@hackclub.com';
	assert.equal(submitPhase(before), 'early');
	assert.equal(hackathonKickoff().toISOString(), '2026-11-27T05:00:00.000Z');
	assert.equal(canSubmit('early', presubmitTester('JohnathanMcphilbin2@gmail.com', list)), true);
	assert.equal(canSubmit('early', presubmitTester('someone@hackclub.com', list)), false);
	assert.equal(canSubmit('early', presubmitTester('someone@hackclub.com', '')), false);
	assert.equal(canSubmit('early', presubmitTester('someone@hackclub.com', undefined)), false);
	assert.equal(canSubmit('early', false), false);
	assert.equal(canSubmit('closed', presubmitTester('johnathanmcphilbin2@gmail.com', list)), false);
	assert.equal(canSubmit('open', false), true);
	assert.equal(hoursEligible(60, true), true);
	assert.equal(hoursEligible(60, false), false);
	assert.equal(hoursEligible(5 * 60 * 60, false), true);
});
