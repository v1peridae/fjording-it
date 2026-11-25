const ET = 'America/New_York';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type DayPoint = { date: string; label: string; count: number; cumulative: number };
export type StackPart = { key: string; label: string; count: number };
export type StackColumn = { key: string; label: string; parts: StackPart[]; total: number };
export type ChallengeDay = { date: string; label: string; counts: Record<string, number> };
export type HoursPoint = { date: string; label: string; hours: number; cumulative: number };
export type FlagBar = { kind: string; label: string; flagged: number; ran: number };
export type Throughput = { reviewers: string[]; days: { date: string; label: string; counts: Record<string, number> }[] };

export type HomeSubmission = {
	id: number;
	at: string;
	challenge: string;
	stage: string;
	status: string;
	email: string;
	projectName: string;
	seconds: number;
	overrideHours: number | null;
};

const CHECK_LABEL: Record<string, string> = {
	prior_experience: 'prior experience',
	copied_project: 'possibly copied',
	hackatime_lapse: 'hackatime lapse'
};

const PIPELINE = [
	{ key: 'first_pass', label: 'First pass' },
	{ key: 'fraud', label: 'Fraud check' },
	{ key: 'hq', label: 'HQ confirmation' },
	{ key: 'approved', label: 'Approved' }
] as const;

export function buildAdminHome(
	input: {
		challenges: { slug: string; name: string }[];
		submissions: HomeSubmission[];
		confirms: { at: string; hours: number; submissionId: number }[];
		flags: { submissionId: number; kind: string }[];
		flagRuns: { kind: string; flagged: number; ran: number }[];
		reviews: { at: string; email: string }[];
		unsynced: number;
		synced: number;
	},
	now = new Date()
) {
	const names = new Map(input.challenges.map((challenge) => [challenge.slug, challenge.name]));
	const waiting = input.submissions
		.filter((row) => row.stage !== 'done' && row.status !== 'rejected')
		.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));
	const oldest = waiting[0] ?? null;
	const oldestFlags = oldest ? input.flags.filter((flag) => flag.submissionId === oldest.id).map((flag) => flag.kind) : [];

	const perChallenge = input.challenges.map((challenge) => {
		const rows = input.submissions.filter((row) => row.challenge === challenge.slug);
		return {
			slug: challenge.slug,
			name: challenge.name,
			total: rows.length,
			pending: rows.filter((row) => row.status === 'pending').length,
			needsChanges: rows.filter((row) => row.status === 'needs_changes').length,
			approved: rows.filter((row) => row.status === 'confirmed').length,
			rejected: rows.filter((row) => row.status === 'rejected').length
		};
	});

	const inStage = (stage: string) => input.submissions.filter((row) => row.stage === stage);
	const countStatus = (rows: HomeSubmission[], status: string) => rows.filter((row) => row.status === status).length;
	const first = inStage('first_pass');
	const fraud = inStage('fraud');
	const hq = inStage('hq');
	const done = inStage('done');
	const confirmed = input.submissions.filter((row) => row.status === 'confirmed');
	const approvedHours = round1(
		confirmed.reduce((sum, row) => sum + approvedHoursOf(row.seconds, row.overrideHours), 0)
	);
	const eligible = confirmed.filter((row) => approvedHoursOf(row.seconds, row.overrideHours) >= 5).length;

	const hasSubmissions = input.submissions.length > 0;
	return {
		submissions: input.submissions.length,
		northern: input.submissions.filter((row) => row.challenge === 'northern').length,
		flagged: new Set(input.flags.map((flag) => flag.submissionId)).size,
		approvedHours,
		eligibleShips: eligible,
		unsynced: input.unsynced,
		perChallenge,
		stages: {
			first_pass: {
				total: first.length,
				pending: countStatus(first, 'pending'),
				needsChanges: countStatus(first, 'needs_changes'),
				rejected: countStatus(first, 'rejected')
			},
			fraud: {
				total: fraud.length,
				pending: countStatus(fraud, 'pending'),
				fraud: countStatus(fraud, 'fraud'),
				needsInfo: countStatus(fraud, 'needs_info')
			},
			hq: { total: hq.length, pending: countStatus(hq, 'pending') },
			done: { total: done.length, confirmed: countStatus(done, 'confirmed'), synced: input.synced }
		},
		oldest: oldest
			? {
					id: oldest.id,
					projectName: oldest.projectName,
					email: oldest.email,
					stage: oldest.stage,
					createdAt: oldest.at,
					flags: oldestFlags
				}
			: null,
		charts: {
			submissions: hasSubmissions ? submissionsByDay(input.submissions, names, now) : [],
			challenges: input.challenges,
			pipeline: hasSubmissions ? pipelineColumns(input.submissions) : [],
			approved: input.confirms.length ? approvedSeries(input.confirms, now) : [],
			flags: flagBars(input.flagRuns),
			throughput: input.reviews.length ? throughput(input.reviews, now) : { reviewers: [], days: [] }
		}
	};
}

export function submissionsByDay(
	rows: { at: string; challenge: string }[],
	names: Map<string, string>,
	now: Date
): ChallengeDay[] {
	const byDay = new Map<string, Record<string, number>>();
	for (const row of rows) {
		const key = etKey(new Date(row.at));
		const counts = byDay.get(key) ?? {};
		counts[row.challenge] = (counts[row.challenge] ?? 0) + 1;
		byDay.set(key, counts);
	}
	void names;
	return spanDays(byDay.keys(), now).map((date) => ({
		date,
		label: dayLabel(date),
		counts: byDay.get(date) ?? {}
	}));
}

export function pipelineColumns(rows: { stage: string; status: string }[]): StackColumn[] {
	const bucket = (row: { stage: string; status: string }) => (row.status === 'confirmed' || row.stage === 'done' ? 'approved' : row.stage);
	return PIPELINE.map((stage) => {
		const mine = rows.filter((row) => bucket(row) === stage.key);
		const counts = new Map<string, number>();
		for (const row of mine) {
			const key = stage.key === 'approved' ? 'confirmed' : row.status;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		const parts = [...counts.entries()]
			.filter(([, count]) => count > 0)
			.map(([key, count]) => ({ key, label: statusLabel(key), count }));
		return { key: stage.key, label: stage.label, parts, total: mine.length };
	});
}

export function approvedSeries(rows: { at: string; hours: number }[], now: Date): HoursPoint[] {
	const byDay = new Map<string, number>();
	for (const row of rows) {
		const key = etKey(new Date(row.at));
		byDay.set(key, (byDay.get(key) ?? 0) + row.hours);
	}
	let cumulative = 0;
	return spanDays(byDay.keys(), now).map((date) => {
		const hours = round1(byDay.get(date) ?? 0);
		cumulative = round1(cumulative + hours);
		return { date, label: dayLabel(date), hours, cumulative };
	});
}

export function flagBars(rows: { kind: string; flagged: number; ran: number }[]): FlagBar[] {
	return rows
		.filter((row) => row.ran > 0)
		.map((row) => ({
			kind: row.kind,
			label: CHECK_LABEL[row.kind] ?? row.kind.replaceAll('_', ' '),
			flagged: row.flagged,
			ran: row.ran
		}));
}

export function throughput(rows: { at: string; email: string }[], now: Date): Throughput {
	const byDay = new Map<string, Record<string, number>>();
	const totals = new Map<string, number>();
	for (const row of rows) {
		const key = etKey(new Date(row.at));
		const counts = byDay.get(key) ?? {};
		counts[row.email] = (counts[row.email] ?? 0) + 1;
		byDay.set(key, counts);
		totals.set(row.email, (totals.get(row.email) ?? 0) + 1);
	}
	const reviewers = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([email]) => email);
	const days = spanDays(byDay.keys(), now).map((date) => ({
		date,
		label: dayLabel(date),
		counts: byDay.get(date) ?? {}
	}));
	return { reviewers, days };
}

export function statusLabel(status: string): string {
	const labels: Record<string, string> = {
		pending: 'pending',
		needs_changes: 'needs changes',
		rejected: 'rejected',
		fraud: 'fraud',
		needs_info: 'needs info',
		confirmed: 'approved',
		clear: 'clear',
		sent_back: 'sent back'
	};
	return labels[status] ?? status.replaceAll('_', ' ');
}

export function checkLabel(kind: string): string {
	return CHECK_LABEL[kind] ?? kind.replaceAll('_', ' ');
}

function approvedHoursOf(seconds: number, overrideHours: number | null): number {
	if (overrideHours != null && Number.isFinite(overrideHours)) return overrideHours;
	return seconds / 3600;
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function spanDays(keys: Iterable<string>, now: Date): string[] {
	const list = [...keys].sort();
	if (list.length === 0) return [];
	const today = etKey(now);
	const start = list[0] < today ? list[0] : today;
	const end = list[list.length - 1] > today ? list[list.length - 1] : today;
	const days: string[] = [];
	let cursor = start;
	for (let i = 0; i < 800 && cursor <= end; i++) {
		days.push(cursor);
		const next = nextEtDay(cursor);
		if (next <= cursor) break;
		cursor = next;
	}
	return days;
}

function etKey(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ET,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

function nextEtDay(key: string): string {
	const [year, month, day] = key.split('-').map(Number);
	return etKey(new Date(Date.UTC(year, month - 1, day, 17, 0, 0) + 86_400_000));
}

function dayLabel(key: string): string {
	const [, month, day] = key.split('-');
	return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export function formatEt(iso: string): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ET,
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hourCycle: 'h12'
	}).formatToParts(new Date(iso));
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
	return `${get('month')} ${get('day')}, ${get('year')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')} ET`;
}

export function ago(iso: string, now = Date.now()): string {
	const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
	if (!Number.isFinite(minutes)) return '';
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 36) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days === 1) return 'yesterday';
	return `${days}d ago`;
}

export function waitAge(iso: string, now = Date.now()): string {
	const ms = Math.max(0, now - new Date(iso).getTime());
	const hours = Math.floor(ms / 3_600_000);
	const days = Math.floor(hours / 24);
	const rest = hours % 24;
	if (days > 0) return `${days}d ${rest}h`;
	if (hours > 0) return `${hours}h`;
	const minutes = Math.max(1, Math.round(ms / 60_000));
	return `${minutes}m`;
}

export function clockHours(seconds: number): string {
	const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
	const hours = Math.floor(safe / 3600);
	const minutes = Math.round((safe % 3600) / 60);
	return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function medianHoursLabel(hours: number | null): string {
	if (hours == null || !Number.isFinite(hours)) return '';
	if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
	const whole = Math.floor(hours);
	const minutes = Math.round((hours - whole) * 60);
	return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}
