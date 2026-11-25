import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { sealSession } from '../src/lib/server/admin-auth.ts';
import {
	ADMIN_COOKIE_PATH,
	LEGACY_ADMIN_COOKIE_PATHS,
	afterLoginPath,
	safeNext,
	signInLocation,
	staffGate
} from '../src/lib/admin-gate.ts';

register('./env-hooks.mjs', import.meta.url);

const SECRET = 'test-session-secret';

type CookieCall = { op: 'set' | 'delete'; name: string; value?: string; path?: string };

function jar(initial: Record<string, string>) {
	const calls: CookieCall[] = [];
	return {
		calls,
		cookies: {
			get(name: string) {
				return initial[name];
			},
			set(name: string, value: string, options: { path?: string }) {
				calls.push({ op: 'set', name, value, path: options.path });
				initial[name] = value;
			},
			delete(name: string, options: { path?: string }) {
				calls.push({ op: 'delete', name, path: options.path });
				delete initial[name];
			}
		}
	};
}

test('return-to stays on this site', () => {
	assert.equal(safeNext('/reviews'), '/reviews');
	assert.equal(safeNext('/reviews/12?stage=hq'), '/reviews/12?stage=hq');
	assert.equal(safeNext('/hackathon/submit'), '/hackathon/submit');
	assert.equal(safeNext('/admin/stats'), '/admin/stats');
	assert.equal(safeNext('/admin'), null);
	assert.equal(safeNext('//evil.com'), null);
	assert.equal(safeNext('https://evil.com/reviews'), null);
	assert.equal(safeNext('/reviews\\@evil'), null);
	assert.equal(signInLocation('/reviews'), '/admin?next=%2Freviews');
	assert.equal(signInLocation('//evil.com'), '/admin');
	assert.deepEqual(staffGate('out', '/reviews'), { type: 'signin', location: '/admin?next=%2Freviews' });
	assert.deepEqual(staffGate('denied', '/reviews'), { type: 'hide' });
	assert.deepEqual(staffGate('in', '/reviews'), { type: 'allow' });
	assert.equal(afterLoginPath('owner', '/hackathon'), '/hackathon');
	assert.equal(afterLoginPath('reviewer', '/hackathon'), '/reviews');
	assert.equal(afterLoginPath('reviewer', '/reviews/4'), '/reviews/4');
	assert.equal(afterLoginPath('denied', '/reviews'), '/admin');
});

test('an owner session is rewritten onto path / and old path copies are cleared', async () => {
	process.env.ADMIN_SESSION_SECRET = SECRET;
	process.env.ADMIN_EMAILS = 'johnny@hackclub.com';
	const token = await sealSession('johnny@hackclub.com', SECRET);
	const { currentAdminView, signOutAdmin } = await import('../src/lib/server/admin.ts');
	const seen = jar({ admin_session: token });
	const view = await currentAdminView(seen.cookies as never, new URL('http://localhost/admin'));
	assert.equal(view.status, 'in');
	if (view.status === 'in') assert.equal(view.email, 'johnny@hackclub.com');

	const set = seen.calls.find((call) => call.op === 'set');
	assert.equal(set?.name, 'admin_session');
	assert.equal(set?.value, token);
	assert.equal(set?.path, ADMIN_COOKIE_PATH);

	const cleared = seen.calls.filter((call) => call.op === 'delete').map((call) => call.path);
	for (const path of LEGACY_ADMIN_COOKIE_PATHS) assert.ok(cleared.includes(path));

	const signedOut = jar({ admin_session: token });
	signOutAdmin(signedOut.cookies as never, new URL('https://fjording.hackclub.com/admin'));
	const gone = signedOut.calls.filter((call) => call.op === 'delete' && call.name === 'admin_session').map((call) => call.path);
	assert.ok(gone.includes('/'));
	for (const path of LEGACY_ADMIN_COOKIE_PATHS) assert.ok(gone.includes(path));
});

test('a missing session does not mint a cookie', async () => {
	process.env.ADMIN_SESSION_SECRET = SECRET;
	const { currentAdminView } = await import('../src/lib/server/admin.ts');
	const seen = jar({});
	const view = await currentAdminView(seen.cookies as never, new URL('http://localhost/reviews'));
	assert.equal(view.status, 'out');
	assert.equal(seen.calls.length, 0);
});
