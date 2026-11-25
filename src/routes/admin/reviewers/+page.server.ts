import { error, fail } from '@sveltejs/kit';
import { appDatabase, databaseConfigured, withTransaction } from '#lib/server/app-db.ts';
import { currentAdminView, enforceOwner } from '#lib/server/admin.ts';
import { listReviewerAudit, listReviewers, removeReviewer, reviewerStats, saveReviewer } from '#lib/server/northern-store.ts';
import { isStage, median, type Stage } from '#lib/review-pipeline.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	enforceOwner(admin.status, url);
	if (admin.status !== 'in') error(404, 'Not Found');
	const who = { email: admin.email, handle: admin.handle };
	if (!databaseConfigured()) return { view: 'unconfigured' as const, ...who, reviewers: [], audit: [], stats: [] };

	const from = dateParam(url.searchParams.get('from'));
	const to = dateParam(url.searchParams.get('to'));
	const db = await appDatabase();
	const rows = await reviewerStats(db, from, to ? new Date(to.getTime() + 86400000) : null);
	const byEmail = new Map<string, typeof rows>();
	for (const row of rows) {
		const list = byEmail.get(row.email) ?? [];
		list.push(row);
		byEmail.set(row.email, list);
	}
	const stats = [...byEmail.entries()].map(([email, reviews]) => {
		const hours = reviews.map((review) => (review.createdAt - review.startedAt) / 3_600_000);
		const count = (decision: string) => reviews.filter((review) => review.decision === decision).length;
		return {
			email,
			total: reviews.length,
			firstPass: reviews.filter((review) => review.stage === 'first_pass').length,
			fraud: reviews.filter((review) => review.stage === 'fraud').length,
			hq: reviews.filter((review) => review.stage === 'hq').length,
			approved: count('approved'),
			rejected: count('rejected'),
			needsChanges: count('needs_changes'),
			medianHours: median(hours),
			lastActive: new Date(Math.max(...reviews.map((review) => review.createdAt))).toISOString()
		};
	});
	return {
		view: 'ready' as const,
		...who,
		reviewers: await listReviewers(db),
		audit: await listReviewerAudit(db),
		stats,
		from: url.searchParams.get('from') ?? '',
		to: url.searchParams.get('to') ?? ''
	};
};

function dateParam(value: string | null): Date | null {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export const actions: Actions = {
	save: async ({ request, cookies, url }) => {
		const admin = await currentAdminView(cookies, url);
		enforceOwner(admin.status, url);
		if (admin.status !== 'in') error(404, 'Not Found');
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim().toLowerCase();
		const stages = ['first_pass', 'fraud', 'hq'].filter((stage) => data.get(stage) === 'on' && isStage(stage)) as Stage[];
		if (!email.endsWith('@hackclub.com') || stages.length === 0) {
			return fail(400, { error: 'need a hack club email and at least one stage' });
		}
		await withTransaction((db) => saveReviewer(db, admin.email, email, stages));
	},
	remove: async ({ request, cookies, url }) => {
		const admin = await currentAdminView(cookies, url);
		enforceOwner(admin.status, url);
		if (admin.status !== 'in') error(404, 'Not Found');
		const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
		if (!email) return fail(400, { error: 'missing email' });
		await withTransaction((db) => removeReviewer(db, admin.email, email));
	}
};
