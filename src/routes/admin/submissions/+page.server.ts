import { error } from '@sveltejs/kit';
import { currentAdmin } from '#lib/server/admin.ts';
import { appDatabase } from '#lib/server/app-db.ts';
import { formatHours } from '#lib/server/hackatime.ts';
import { listSubmissions } from '#lib/server/northern-store.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

const ET = 'America/New_York';

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	if ((await currentAdmin(cookies, url)) !== 'in') error(404, 'Not Found');

	try {
		const rows = listSubmissions(appDatabase()).map((row) => ({
			...row,
			hours: formatHours(row.hackatimeSeconds),
			when: formatEt(row.createdAt)
		}));
		return { view: 'list' as const, rows };
	} catch (err) {
		console.error('submissions failed');
		return { view: 'error' as const, rows: [] };
	}
};

function formatEt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: ET,
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}
