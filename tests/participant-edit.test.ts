import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertCreateOnly } from '../src/lib/migrations.ts';
import {
	cleanDisplayName,
	editSyncMethod,
	lockReason,
	ownProjectUpdateSql,
	ownSubmissionUpdateSql,
	shouldReopen
} from '../src/lib/participant-edit.ts';

test('a fresh submission can be edited in place, and a reviewed one goes back to pending', () => {
	assert.equal(lockReason('first_pass', 'pending'), null);
	assert.equal(lockReason('first_pass', 'needs_changes'), null);
	assert.equal(lockReason('fraud', 'needs_info'), null);
	assert.equal(shouldReopen('first_pass', 'pending', 0), false);
	assert.equal(shouldReopen('first_pass', 'needs_changes', 1), true);
	assert.equal(shouldReopen('fraud', 'pending', 1), true);
	assert.equal(shouldReopen('hq', 'pending', 2), true);

	assert.match(lockReason('done', 'confirmed') ?? '', /confirmed/);
	assert.match(lockReason('first_pass', 'rejected') ?? '', /turned down/);
	assert.match(lockReason('fraud', 'fraud') ?? '', /flagged/);
	assert.equal(shouldReopen('done', 'confirmed', 3), false);
	assert.equal(shouldReopen('fraud', 'fraud', 1), false);
	assert.equal(shouldReopen('first_pass', 'rejected', 1), false);
});

test('an edit patches an existing airtable record and never creates one', () => {
	assert.equal(editSyncMethod(null), null);
	assert.equal(editSyncMethod(''), null);
	assert.equal(editSyncMethod('  '), null);
	assert.equal(editSyncMethod('recPJlkVDGVvCnDj1'), 'PATCH');
});

test('the name can be cleared, and a long name is refused', () => {
	assert.equal(cleanDisplayName('  Ada   Lovelace '), 'Ada Lovelace');
	assert.equal(cleanDisplayName('   '), null);
	assert.equal(cleanDisplayName('x'.repeat(81)), undefined);
});

test('updates stay on the signed-in participant and do not delete rows', () => {
	const project = ownProjectUpdateSql();
	const submission = ownSubmissionUpdateSql();
	assert.match(project, /WHERE participant_id = \$1/);
	assert.match(project, /RETURNING id/);
	assert.match(submission, /WHERE id = \$1 AND participant_id = \$2/);
	assert.match(submission, /status NOT IN \('confirmed', 'rejected', 'fraud'\)/);
	assert.doesNotMatch(project, /\bdelete\s+from\b/i);
	assert.doesNotMatch(submission, /\bdelete\s+from\b/i);
	const migration = readFileSync(new URL('../migrations/008_name_edited.sql', import.meta.url), 'utf8');
	assert.match(migration, /ADD COLUMN IF NOT EXISTS name_edited/);
	assertCreateOnly('008_name_edited.sql', migration);
	const signIn = readFileSync(new URL('../src/lib/server/northern-store.ts', import.meta.url), 'utf8');
	assert.match(signIn, /WHEN participants\.name_edited THEN participants\.name/);
});
