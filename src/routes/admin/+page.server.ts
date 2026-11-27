import { privateEnv } from '#lib/server/private-env.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import { safeNext } from '#lib/admin-gate.ts';
import { medianHoursLabel } from '#lib/admin-charts.ts';
import { median } from '#lib/review-pipeline.ts';
import { isAdminEmail } from '#lib/signup-stats.ts';
import { getSignupStats } from '#lib/server/airtable-signups.ts';
import { beginHackClubLogin, currentAdminView, signOutAdmin, takeFlash } from '#lib/server/admin.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { codingWindow, etDayKey } from '#lib/coding-days.ts';
import { refreshCodingDays } from '#lib/server/coding-dau.ts';
import { codingSnapshot, flagTesterSubmissions, listReviewers, loadAdminHome, loadParticipantFunnel, loadProgrammeRows, reviewerStats, syncAllHourBalances } from '#lib/server/northern-store.ts';
import { buildProgrammeStats, type ProgrammeStats } from '#lib/programme-stats.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	const next = safeNext(url.searchParams.get('next'));
	if (admin.status === 'in' && next) redirect(303, next);
	if (admin.status === 'reviewer') {
		if (next === '/reviews' || next?.startsWith('/reviews/')) redirect(303, next);
		error(404, 'Not Found');
	}
	if (admin.status !== 'in') {
		const flash = takeFlash(cookies, url);
		return {
			view: 'signin' as const,
			next,
			error:
				flash === 'denied'
					? 'not authorised'
					: flash === 'mismatch'
						? 'Hack Club signed in a different account than the email in this form. Sign out of Hack Club Auth, then sign in as that email.'
						: flash === 'failed'
							? "sign-in didn't work, try again"
							: undefined
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
		return { view: 'home' as const, email: admin.email, handle: admin.handle, signups, db: null, dbError: null, funnel: null, dau: null, programme: null, programmeError: null, people: [], from, to };
	}
	try {
		const db = await appDatabase();
		await flagTesterSubmissions(db, privateEnv('PRESUBMIT_TESTER_EMAILS')).catch(() => undefined);
		const home = await loadAdminHome(db);
		const funnel = await loadParticipantFunnel(db);
		const refresh = await refreshCodingDays(db).catch(() => ({ checked: 0, failed: 0 }));
		const snap = await codingSnapshot(db, etDayKey(new Date()));
		const dau = { ...codingWindow(snap.rows, etDayKey(new Date())), signups: snap.signups, onboarded: snap.onboarded, today: snap.today, refreshFailed: refresh.failed };
		const rows = await reviewerStats(db, dateParam(from), dateParam(to) ? new Date(dateParam(to)!.getTime() + 86_400_000) : null);
		const directory = await listReviewers(db);
		let programme: ProgrammeStats | null = null;
		let programmeError: string | null = null;
		try {
			await syncAllHourBalances(db).catch(() => undefined);
			programme = buildProgrammeStats({ ...(await loadProgrammeRows(db)), testerEmails: privateEnv('PRESUBMIT_TESTER_EMAILS') });
		} catch {
			programmeError = "couldn't load programme stats";
		}
		return {
			view: 'home' as const,
			email: admin.email,
			handle: admin.handle,
			signups,
			db: home,
			funnel,
			dau,
			programme,
			programmeError,
			dbError: null,
			people: shapePeople(rows, directory),
			from,
			to
		};
	} catch {
		return { view: 'home' as const, email: admin.email, handle: admin.handle, signups, db: null, funnel: null, dau: null, programme: null, programmeError: null, dbError: "couldn't load submissions", people: [], from, to };
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
		const next = safeNext(String(data.get('next') ?? ''));
		const started = await beginHackClubLogin({ cookies, origin: url.origin, loginHint: email || undefined, next });
		if (started?.error === 'unconfigured') return fail(500, { email, error: 'sign-in is not configured' });
	},
	signout: async ({ cookies, url }) => {
		signOutAdmin(cookies, url);
		redirect(303, '/admin');
	}
};
