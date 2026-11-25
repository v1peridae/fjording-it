import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { authorizeUrl, formatHours, HACKATIME_REDIRECT_URI, projectsFromPayload } from '../src/lib/server/hackatime.ts';
import { DatabaseSync } from 'node:sqlite';
import { insertSubmission, listSubmissions, saveHackatimeConnection, sniffImage } from '../src/lib/server/northern-store.ts';
import { canSubmit, cleanProjectName, eligibleHours, httpUrl, submitPhase } from '../src/lib/northern.ts';
import { hackathonDeadline, hackathonKickoff } from '../src/lib/hackathon.ts';

test('submit stays closed until kickoff, and admins can preview before then', () => {
	const start = hackathonKickoff();
	const end = hackathonDeadline();
	const before = new Date(start.getTime() - 1000);
	assert.equal(submitPhase(before, start, end), 'early');
	assert.equal(canSubmit('early', false), false);
	assert.equal(canSubmit('early', true), true);
	assert.equal(canSubmit('open', false), true);
	assert.equal(canSubmit('closed', true), false);
	assert.equal(submitPhase(start, start, end), 'open');
	assert.equal(submitPhase(end, start, end), 'closed');
});

test('links can omit the scheme and hours under 5 are not eligible', () => {
	assert.equal(httpUrl('github.com/you/goose'), 'https://github.com/you/goose');
	assert.equal(httpUrl('javascript:alert(1)'), null);
	assert.equal(cleanProjectName('  goose   tracker '), 'goose tracker');
	assert.equal(eligibleHours(5 * 3600), true);
	assert.equal(eligibleHours(5 * 3600 - 1), false);
	assert.equal(formatHours(12 * 3600 + 40 * 60), '12h 40m');
});

test('hackatime authorize url uses the production callback exactly', () => {
	const url = new URL(
		authorizeUrl({
			clientId: 'client',
			redirectUri: HACKATIME_REDIRECT_URI,
			state: 'state'
		})
	);
	assert.equal(url.origin + url.pathname, 'https://hackatime.hackclub.com/oauth/authorize');
	assert.equal(url.searchParams.get('redirect_uri'), 'https://fjording.hackclub.com/auth/hackatime/callback');
	assert.equal(url.searchParams.get('scope'), 'profile read');
	assert.equal(url.searchParams.get('client_secret'), null);
});

test('project list keeps real rows and drops blanks', () => {
	const projects = projectsFromPayload({
		projects: [
			{ name: 'short', total_seconds: 3 * 3600 + 20 * 60 },
			{ name: '  ', total_seconds: 99 },
			{ name: 'long', total_seconds: 12 * 3600 + 40 * 60 }
		]
	});
	assert.deepEqual(
		projects?.map((project) => project.name),
		['long', 'short']
	);
});

test('the migration only creates tables and can store a submission', () => {
	const sql = readFileSync(new URL('../migrations/001_northern_challenge.sql', import.meta.url), 'utf8');
	assert.match(sql, /CREATE TABLE IF NOT EXISTS northern_submissions/i);
	assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
	assert.doesNotMatch(sql, /\bdelete\s+from\b/i);

	const dir = mkdtempSync(join(tmpdir(), 'fjord-'));
	const db = new DatabaseSync(join(dir, 'fjording.sqlite'));
	db.exec(sql);
	saveHackatimeConnection(
		db,
		'johnny@hackclub.com',
		{ accessToken: 'token', refreshToken: null, expiresIn: 60, scope: 'profile read' },
		{ id: '1', githubUsername: null }
	);
	const id = insertSubmission(db, {
		email: 'johnny@hackclub.com',
		projectName: 'lantern',
		description: 'a light',
		repoUrl: 'https://github.com/hackclub/lantern',
		demoUrl: 'https://lantern.hackclub.com',
		screenshotName: null,
		hackatimeProject: 'lantern',
		hackatimeSeconds: 6 * 3600
	});
	assert.equal(id, 1);
	assert.equal(listSubmissions(db)[0]?.projectName, 'lantern');
	assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), 'png');
	assert.equal(sniffImage(new Uint8Array([1, 2, 3, 4])), null);
});
