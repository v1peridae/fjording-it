import { error } from '@sveltejs/kit';
import { hackathonAllowed } from '#lib/hackathon.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow'
	});

	// Same Hack Club Auth session as /admin. Everyone else gets a not-found.
	const admin = await currentAdminView(cookies, url);
	if (!hackathonAllowed(admin.status)) error(404, 'Not Found');

	return {
		handle: admin.status === 'in' ? admin.handle : null,
		now: Date.now()
	};
};
