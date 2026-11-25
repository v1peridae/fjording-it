import { privateEnv } from '#lib/server/private-env.ts';
import { error, fail } from '@sveltejs/kit';
import { medianHoursLabel } from '#lib/admin-charts.ts';
import { median } from '#lib/review-pipeline.ts';
import { isAdminEmail } from '#lib/signup-stats.ts';
import { getSignupStats } from '#lib/server/airtable-signups.ts';
import { beginHackClubLogin, currentAdminView, takeFlash } from '#lib/server/admin.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { listReviewers, loadAdminHome, reviewerStats } from '#lib/server/northern-store.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	if (admin.status === 'reviewer') error(404, 'Not Found');
	if (admin.status !== 'in') {
		const flash = takeFlash(cookies, url);
		return {
			view: 'signin' as const,
			error: flash === 'denied' ? 'not authorised' : flash === 'failed' ? "sign-in didn't work, try again" : undefined
		};
	}

	let signups: { error: string } | { count: number; today: number; days: { date: string; label: string; count: number; cumulative: number }[] } =
		{ error: "couldn't load sign-ups" };
	try {
		const report = await getSignupStats();
		signups = { count: report.count, today: report.today, days: report.daysSeries };
	} catch {
		signups = { error: "couldn't load sign-ups" };
	}

	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	if (!databaseConfigured()) {
		return { view: 'home' as const, email: admin.email, handle: admin.handle, signups, db: null, dbError: null, people: [], from, to };
	}
	try {
		const db = await appDatabase();
		const home = await loadAdminHome(db);
		const rows = await reviewerStats(db, dateParam(from), dateParam(to) ? new Date(dateParam(to)!.getTime() + 86_400_000) : null);
		const directory = await listReviewers(db);
		return {
			view: 'home' as const,
			email: admin.email,
			handle: admin.handle,
			signups,
			db: home,
			dbError: null,
			people: shapePeople(rows, directory),
			from,
			to
		};
	} catch {
		return { view: 'home' as const, email: admin.email, handle: admin.handle, signups, db: null, dbError: "couldn't load submissions", people: [], from, to };
	}
};

function dateParam(value: string | null): Date | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function shapePeople(
	rows: { email: string; stage: string; decision: string; createdAt: number; startedAt: number }[],
	directory: { email: string; stages: string[] }[]
) {
	const byEmail = new Map<string, typeof rows>();
	for (const row of rows) {
		const list = byEmail.get(row.email) ?? [];
		list.push(row);
		byEmail.set(row.email, list);
	}
	const emails = new Set([...directory.map((reviewer) => reviewer.email), ...byEmail.keys()]);
	return [...emails].sort().map((email) => {
		const reviews = byEmail.get(email) ?? [];
		const hours = reviews.map((review) => (review.createdAt - review.startedAt) / 3_600_000);
		const count = (decision: string) => reviews.filter((review) => review.decision === decision).length;
		return {
			email,
			owner: isAdminEmail(email, privateEnv('ADMIN_EMAILS')),
			stages: directory.find((reviewer) => reviewer.email === email)?.stages ?? [],
			firstPass: reviews.filter((review) => review.stage === 'first_pass').length,
			fraud: reviews.filter((review) => review.stage === 'fraud').length,
			hq: reviews.filter((review) => review.stage === 'hq').length,
			approved: count('approved'),
			rejected: count('rejected'),
			needsChanges: count('needs_changes'),
			median: reviews.length ? medianHoursLabel(median(hours)) : '',
			lastActive: reviews.length ? new Date(Math.max(...reviews.map((review) => review.createdAt))).toISOString() : ''
		};
	});
}

export const actions: Actions = {
	signin: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim().toLowerCase().slice(0, 255);
		if (email && (email.length > 254 || !EMAIL.test(email))) return fail(400, { email, error: "that doesn't look like an email" });
		const started = await beginHackClubLogin({ cookies, origin: url.origin, loginHint: email || undefined });
		if (started?.error === 'unconfigured') return fail(500, { email, error: 'sign-in is not configured' });
	}
};
