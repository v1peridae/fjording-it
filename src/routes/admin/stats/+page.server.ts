import { error, fail } from '@sveltejs/kit';
import { beginHackClubLogin, clearFlash, currentAdminView, enforceOwner } from '#lib/server/admin.ts';
import { getSignupStats } from '#lib/server/airtable-signups.ts';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });

	const admin = await currentAdminView(cookies, url);
	enforceOwner(admin.status, url);
	if (admin.status !== 'in') error(404, 'Not Found');
	clearFlash(cookies, url);
	try {
		const report = await getSignupStats();
		return { view: 'stats' as const, report, email: admin.email, handle: admin.handle };
	} catch (err) {
		console.error('signup stats failed:', err instanceof Error ? err.message : 'error');
		return { view: 'error' as const, email: admin.email, handle: admin.handle };
	}
};

export const actions: Actions = {
	signin: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase()
			.slice(0, 255);

		if (email && (email.length > 254 || !EMAIL.test(email))) {
			return fail(400, { email, error: "that doesn't look like an email" });
		}

		const started = await beginHackClubLogin({
			cookies,
			origin: url.origin,
			loginHint: email || undefined
		});
		if (started?.error === 'unconfigured') {
			return fail(500, { email, error: 'sign-in is not configured' });
		}
	}
};
