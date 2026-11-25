import { currentAdminView } from '#lib/server/admin.ts';
import { northernPageAllowed } from '#lib/server/participant.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow'
	});

	await northernPageAllowed(cookies, url);
	const admin = await currentAdminView(cookies, url);

	return {
		handle: admin.status === 'in' ? admin.handle : null,
		email: admin.status === 'in' ? admin.email : null,
		now: Date.now()
	};
};
