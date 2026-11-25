import { error } from '@sveltejs/kit';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import { listQueue, queueFacets } from '#lib/server/northern-store.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	if (admin.status !== 'in' && admin.status !== 'reviewer') error(404, 'Not Found');
	const role = admin.status === 'in' ? ('owner' as const) : ('reviewer' as const);
	const emptyQuery = { challenge: '', stage: '', status: '', sort: 'submitted_desc' as const, q: '' };
	const who = { email: admin.email, handle: admin.handle };
	if (!databaseConfigured()) {
		return { role, ...who, configured: false, rows: [], facets: { cells: [], challenges: [], flagged: 0 }, query: emptyQuery };
	}

	const sorts = ['submitted_desc', 'submitted_asc', 'hours_desc', 'hours_asc', 'flags_desc'] as const;
	const requested = url.searchParams.get('sort') ?? 'submitted_desc';
	const query = {
		challenge: url.searchParams.get('challenge') ?? '',
		stage: url.searchParams.get('stage') ?? '',
		status: url.searchParams.get('status') ?? '',
		sort: sorts.find((sort) => sort === requested) ?? 'submitted_desc',
		q: url.searchParams.get('q') ?? ''
	};
	const db = await appDatabase();
	return {
		role,
		...who,
		configured: true,
		rows: await listQueue(db, query),
		facets: await queueFacets(db, query.challenge),
		query
	};
};
