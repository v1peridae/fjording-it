import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertCreateOnly } from '../src/lib/migrations.ts';
import { rewardSplit, type ProgrammeParticipant } from '../src/lib/programme-stats.ts';
import {
	canChangeReward,
	hourBalance,
	parseRewardChoice,
	REWARD_COPY,
	rewardOutcome,
	type BalanceSubmission
} from '../src/lib/reward.ts';

test('only cap or prize is a valid pick', () => {
	assert.equal(parseRewardChoice('cap'), 'cap');
	assert.equal(parseRewardChoice('prize'), 'prize');
	for (const bad of ['', 'Cap', ' cap', 'bank', 'both', null, undefined, 1, {}]) {
		assert.equal(parseRewardChoice(bad), null);
	}
});

test('the cap is cap only, skipping it is the $300 running, no pick counts as the cap', () => {
	assert.deepEqual(rewardOutcome('cap'), { cap: true, prizeEligible: false });
	assert.deepEqual(rewardOutcome('prize'), { cap: false, prizeEligible: true });
	assert.deepEqual(rewardOutcome(null), { cap: true, prizeEligible: false });
});

test('the pick can change until the challenge closes', () => {
	assert.equal(canChangeReward('early'), true);
	assert.equal(canChangeReward('open'), true);
	assert.equal(canChangeReward('closed'), false);
});

test('participant copy stays lowercase with no dashes, brackets or semicolons', () => {
	for (const line of Object.values(REWARD_COPY)) {
		assert.doesNotMatch(line, /[-–—()[\]{};]/, line);
		assert.equal(line.replace('HQ', 'hq'), line.replace('HQ', 'hq').toLowerCase(), line);
	}
	assert.equal(REWARD_COPY.ask, 'get the cap, or skip it and stay in the running for the $300');
});

const sub = (over: Partial<BalanceSubmission> = {}): BalanceSubmission => ({
	challenge: 'northern',
	stage: 'done',
	status: 'confirmed',
	isTest: false,
	hackatimeSeconds: 6 * 3600,
	overrideHours: null,
	...over
});

test('the balance is approved hours on HQ confirmed northern submissions', () => {
	assert.equal(hourBalance([]), 0);
	assert.equal(hourBalance([sub()]), 6);
	assert.equal(hourBalance([sub({ overrideHours: 4.5 })]), 4.5);
	assert.equal(hourBalance([sub(), sub({ hackatimeSeconds: 5400 })]), 7.5);
});

test('unconfirmed, test, and other challenge work adds nothing', () => {
	assert.equal(hourBalance([sub({ stage: 'hq', status: 'pending' })]), 0);
	assert.equal(hourBalance([sub({ stage: 'first_pass', status: 'rejected' })]), 0);
	assert.equal(hourBalance([sub({ stage: 'fraud', status: 'fraud' })]), 0);
	assert.equal(hourBalance([sub({ isTest: true })]), 0);
	assert.equal(hourBalance([sub({ challenge: 'other' })]), 0);
	assert.equal(hourBalance([sub({ hackatimeSeconds: Number.NaN })]), 0);
	assert.equal(hourBalance([sub({ overrideHours: -2 })]), 0);
});

test('computing the balance twice gives the same value, so syncing sets and never adds', () => {
	const rows = [sub({ hackatimeSeconds: 18_001 }), sub({ overrideHours: 1.25 })];
	const first = hourBalance(rows);
	assert.equal(hourBalance(rows), first);
	assert.equal(first, 6.25);
});

const person = (over: Partial<ProgrammeParticipant> = {}): ProgrammeParticipant => ({
	email: 'a@example.com',
	country: null,
	createdAt: '2026-11-27T03:00:00.000Z',
	joined: true,
	projectAt: null,
	connected: true,
	windowSeconds: 0,
	submitted: false,
	...over
});

test('admin split counts picks and sums only real stored balances', () => {
	const empty = rewardSplit([person()]);
	assert.deepEqual(empty, { cap: 0, prize: 0, none: 1, bankedTotal: null, people: [] });

	const split = rewardSplit([
		person({ email: 'cap@example.com', rewardChoice: 'cap', hourBalance: 0 }),
		person({ email: 'prize@example.com', rewardChoice: 'prize', hourBalance: 7.5 }),
		person({ email: 'quiet@example.com', hourBalance: 5 }),
		person({ email: 'later@example.com', joined: false })
	]);
	assert.equal(split.cap, 1);
	assert.equal(split.prize, 1);
	assert.equal(split.none, 1);
	assert.equal(split.bankedTotal, 12.5);
	assert.deepEqual(
		split.people.map((p) => p.email),
		['prize@example.com', 'quiet@example.com', 'cap@example.com']
	);
});

test('the migration only adds columns', () => {
	const sql = readFileSync(new URL('../migrations/008_reward_choice.sql', import.meta.url), 'utf8');
	assertCreateOnly('008_reward_choice.sql', sql);
	assert.match(sql, /ADD COLUMN IF NOT EXISTS reward_choice text/);
	assert.match(sql, /ADD COLUMN IF NOT EXISTS hour_balance numeric/);
	assert.doesNotMatch(sql, /\bdrop\b/i);
});

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : [path];
	});
}

test('participant routes never read or send the hour balance', () => {
	const root = fileURLToPath(new URL('../src/routes/hackathon', import.meta.url));
	for (const file of files(root)) {
		const text = readFileSync(file, 'utf8').replaceAll('syncHourBalance', '');
		assert.doesNotMatch(text, /hour_balance|hourBalance|bankedTotal|banked/i, file);
	}
	const you = readFileSync(join(root, 'you/+page.server.ts'), 'utf8');
	assert.match(you, /await syncHourBalance\(db, participant\.id\)\.catch/);
	assert.doesNotMatch(you, /=\s*await syncHourBalance/);
});

test('shipping does not check address, birthday or slack id', () => {
	const ship = readFileSync(new URL('../src/routes/hackathon/submit/+page.server.ts', import.meta.url), 'utf8');
	const code = ship.replace(/\/\/.*$/gm, '');
	assert.doesNotMatch(code, /birthday|address|slack/i);
});
