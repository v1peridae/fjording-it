import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewerAssignment } from '../src/lib/reviewer-access.ts';

test('a gmail address can be a first-pass and fraud reviewer', () => {
	const result = reviewerAssignment('  AnjaliDadlani0@gmail.com ', ['first_pass', 'fraud']);
	assert.deepEqual(result, {
		email: 'anjalidadlani0@gmail.com',
		stages: ['first_pass', 'fraud']
	});
});

test('the domain is not limited to hack club', () => {
	const result = reviewerAssignment('reviewer@example.org', ['hq']);
	assert.ok(!('error' in result));
});

test('a missing email or stage is rejected without mentioning a domain', () => {
	assert.deepEqual(reviewerAssignment('not-an-email', ['first_pass']), { error: 'need an email address' });
	assert.deepEqual(reviewerAssignment('a@b.co', []), { error: 'pick at least one stage' });
	const missing = reviewerAssignment('', ['fraud']);
	assert.equal('error' in missing && missing.error.includes('hack club'), false);
});
