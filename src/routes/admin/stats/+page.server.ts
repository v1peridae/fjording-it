import { fail } from '@sveltejs/kit';
import { beginHackClubLogin, clearFlash, currentAdmin, takeFlash } from '#lib/server/admin.ts';
import { getSignupStats } from '#lib/server/airtable-signups.ts';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store' });

	const admin = await currentAdmin(cookies, url);
	if (admin === 'in') {
		clearFlash(cookies, url);
		try {
			const stats = await getSignupStats();
			return { view: 'stats' as const, line: stats.line };
		} catch (err) {
			console.error('signup stats failed:', err instanceof Error ? err.message : 'error');
			return { view: 'error' as const };
		}
	}

	if (admin === 'denied') {
		clearFlash(cookies, url);
		return { view: 'denied' as const };
	}

	const flash = takeFlash(cookies, url);
	if (flash === 'denied') return { view: 'denied' as const };
	return {
		view: 'signin' as const,
		error: flash === 'failed' ? "sign-in didn't work, try again" : undefined
	};
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
