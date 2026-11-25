import { redirect } from '@sveltejs/kit';
import { currentAdminView, enforceStaff } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, url }) => {
	const admin = await currentAdminView(cookies, url);
	enforceStaff(admin.status, url);
	redirect(303, '/reviews');
};
