import { dayLabel, etDayKey } from './coding-days.ts';
import { countdownAt, hackathonDeadline, hackathonKickoff, type Countdown } from './hackathon.ts';
import { median } from './review-pipeline.ts';

/**
 * Admin programme stats. Everything here is counted from rows we already store.
 * Nothing is estimated: missing data is reported as its own "unknown" bucket.
 */

export type ProgrammeParticipant = {
	email: string;
	country: string | null;
	createdAt: string;
	joined: boolean;
	/** When the starter project was saved. The closest dated signal of joining we store. */
	projectAt: string | null;
	connected: boolean;
	/** Sum of cached Hackatime seconds in the challenge window. null = never fetched. */
	windowSeconds: number | null;
	submitted: boolean;
};

export type ProgrammeSubmission = { id: number; at: string; stage: string; status: string };
export type ProgrammeReview = { submissionId: number; at: string; decision: string };

export type DaySeries = { date: string; label: string; count: number; cumulative: number }[];
export type CountryRow = { key: string; label: string; accounts: number; joined: number };
export type HoursBucket = { key: string; label: string; count: number };
export type Turnaround = { median: number | null; average: number | null; n: number };

export type ProgrammeStats = {
	testersExcluded: number;
	accounts: number;
	joined: number;
	joinRate: number | null;
	connectedJoiners: number;
	submittedJoiners: number;
	countries: { rows: CountryRow[]; unknown: { accounts: number; joined: number }; known: number };
	signupsByDay: DaySeries;
	joinsByDay: DaySeries;
	joinsUndated: number;
	hours: {
		buckets: HoursBucket[];
		hitFive: number;
		closeToFive: number;
		stalled: number;
		noProject: number;
		fiveNotSubmitted: number;
	};
	submissions: {
		total: number;
		inReview: number;
		waiting: number;
		approved: number;
		rejected: number;
		firstReview: Turnaround;
		decision: Turnaround;
		backlog: { count: number; oldestAt: string | null; medianAgeHours: number | null; under1d: number; d1to3: number; over3d: number };
	};
	clock: { countdown: Countdown; startsAt: string; endsAt: string; day: number | null; totalDays: number };
};

const HOUR = 3_600_000;
const FINAL = new Set(['confirmed', 'rejected', 'fraud']);
const WAITING = new Set(['needs_changes', 'needs_info']);
const REJECTED = new Set(['rejected', 'fraud']);

export function buildProgrammeStats(
	input: {
		participants: ProgrammeParticipant[];
		submissions: ProgrammeSubmission[];
		reviews: ProgrammeReview[];
		testerEmails?: string;
	},
	now = new Date(),
	window = { start: hackathonKickoff(), end: hackathonDeadline() }
): ProgrammeStats {
	const testers = emailSet(input.testerEmails);
	const people = input.participants.filter((p) => !testers.has(p.email.trim().toLowerCase()));
	const joiners = people.filter((p) => p.joined);

	return {
		testersExcluded: input.participants.length - people.length,
		accounts: people.length,
		joined: joiners.length,
		joinRate: percent(joiners.length, people.length),
		connectedJoiners: joiners.filter((p) => p.connected).length,
		submittedJoiners: joiners.filter((p) => p.submitted).length,
		countries: countrySplit(people),
		signupsByDay: daily(people.map((p) => p.createdAt), now),
		joinsByDay: daily(joiners.flatMap((p) => (p.projectAt ? [p.projectAt] : [])), now),
		joinsUndated: joiners.filter((p) => !p.projectAt).length,
		hours: hoursSplit(joiners),
		submissions: submissionStats(input.submissions, input.reviews, now),
		clock: clock(now, window.start, window.end)
	};
}

export function hoursSplit(joiners: ProgrammeParticipant[]) {
	const buckets: HoursBucket[] = [
		{ key: 'zero', label: '0h', count: 0 },
		{ key: 'under1', label: 'under 1h', count: 0 },
		{ key: 'one_to_five', label: '1h to under 5h', count: 0 },
		{ key: 'five_plus', label: '5h+', count: 0 },
		{ key: 'unknown', label: 'no hackatime data yet', count: 0 }
	];
	let closeToFive = 0;
	let fiveNotSubmitted = 0;
	for (const person of joiners) {
		const seconds = person.windowSeconds;
		if (seconds == null || !Number.isFinite(seconds)) {
			buckets[4].count += 1;
			continue;
		}
		const hours = seconds / 3600;
		if (seconds <= 0) buckets[0].count += 1;
		else if (hours < 1) buckets[1].count += 1;
		else if (hours < 5) buckets[2].count += 1;
		else buckets[3].count += 1;
		if (hours >= 3 && hours < 5) closeToFive += 1;
		if (hours >= 5 && !person.submitted) fiveNotSubmitted += 1;
	}
	return {
		buckets,
		hitFive: buckets[3].count,
		closeToFive,
		stalled: buckets[0].count,
		noProject: joiners.filter((p) => !p.projectAt).length,
		fiveNotSubmitted
	};
}

export function submissionStats(submissions: ProgrammeSubmission[], reviews: ProgrammeReview[], now: Date) {
	const byId = new Map(submissions.map((s) => [s.id, s]));
	const firstAny = new Map<number, number>();
	const firstFinal = new Map<number, number>();
	for (const review of reviews) {
		const sub = byId.get(review.submissionId);
		if (!sub) continue;
		const at = time(review.at);
		if (at == null) continue;
		const prev = firstAny.get(sub.id);
		if (prev == null || at < prev) firstAny.set(sub.id, at);
		if (FINAL.has(review.decision)) {
			const prevFinal = firstFinal.get(sub.id);
			if (prevFinal == null || at < prevFinal) firstFinal.set(sub.id, at);
		}
	}
	const gaps = (map: Map<number, number>) =>
		[...map].flatMap(([id, at]) => {
			const start = time(byId.get(id)?.at);
			return start == null ? [] : [Math.max(0, at - start) / HOUR];
		});

	const approved = submissions.filter((s) => s.status === 'confirmed').length;
	const rejected = submissions.filter((s) => REJECTED.has(s.status)).length;
	const waiting = submissions.filter((s) => WAITING.has(s.status)).length;
	const open = submissions.filter((s) => s.status !== 'confirmed' && !REJECTED.has(s.status) && !WAITING.has(s.status));
	const ages = open.flatMap((s) => {
		const at = time(s.at);
		return at == null ? [] : [Math.max(0, now.getTime() - at) / HOUR];
	});
	const oldest = open.reduce<string | null>((min, s) => (min == null || s.at < min ? s.at : min), null);

	return {
		total: submissions.length,
		inReview: open.length,
		waiting,
		approved,
		rejected,
		firstReview: summary(gaps(firstAny)),
		decision: summary(gaps(firstFinal)),
		backlog: {
			count: open.length,
			oldestAt: oldest,
			medianAgeHours: median(ages),
			under1d: ages.filter((h) => h < 24).length,
			d1to3: ages.filter((h) => h >= 24 && h < 72).length,
			over3d: ages.filter((h) => h >= 72).length
		}
	};
}

const REGION_NAMES = (() => {
	try {
		return new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
	} catch {
		return null;
	}
})();

let nameToCode: Map<string, string> | null = null;

function regionCodeForName(name: string): string | null {
	if (!REGION_NAMES) return null;
	if (!nameToCode) {
		nameToCode = new Map();
		const A = 65;
		for (let i = 0; i < 26; i++) {
			for (let j = 0; j < 26; j++) {
				const code = String.fromCharCode(A + i, A + j);
				const label = REGION_NAMES.of(code);
				if (label && label !== code) nameToCode.set(label.toLowerCase(), code);
			}
		}
	}
	return nameToCode.get(name.toLowerCase()) ?? null;
}

/** Groups an ISO code and its English name together. Anything else keeps its own text. */
export function normalizeCountry(raw: string | null | undefined): { key: string; label: string } | null {
	const text = (raw ?? '').trim().replace(/\s+/g, ' ');
	if (!text) return null;
	const code = /^[a-z]{2}$/i.test(text) ? text.toUpperCase() : regionCodeForName(text);
	if (code) {
		const label = REGION_NAMES?.of(code);
		return { key: code, label: label && label !== code ? label : code };
	}
	return { key: `raw:${text.toLowerCase()}`, label: text };
}

export function countrySplit(people: ProgrammeParticipant[]) {
	const rows = new Map<string, CountryRow>();
	const unknown = { accounts: 0, joined: 0 };
	for (const person of people) {
		const country = normalizeCountry(person.country);
		if (!country) {
			unknown.accounts += 1;
			if (person.joined) unknown.joined += 1;
			continue;
		}
		const row = rows.get(country.key) ?? { ...country, accounts: 0, joined: 0 };
		row.accounts += 1;
		if (person.joined) row.joined += 1;
		rows.set(country.key, row);
	}
	const sorted = [...rows.values()].sort((a, b) => b.accounts - a.accounts || b.joined - a.joined || a.label.localeCompare(b.label));
	return { rows: sorted, unknown, known: people.length - unknown.accounts };
}

export function daily(isoTimes: string[], now: Date): DaySeries {
	const counts = new Map<string, number>();
	for (const iso of isoTimes) {
		const at = time(iso);
		if (at == null) continue;
		const key = etDayKey(new Date(at));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	if (counts.size === 0) return [];
	const keys = [...counts.keys()].sort();
	const today = etDayKey(now);
	const start = keys[0] < today ? keys[0] : today;
	const end = keys[keys.length - 1] > today ? keys[keys.length - 1] : today;
	const series: DaySeries = [];
	let cumulative = 0;
	for (let day = start, i = 0; day <= end && i < 800; day = nextDay(day), i++) {
		const count = counts.get(day) ?? 0;
		cumulative += count;
		series.push({ date: day, label: dayLabel(day), count, cumulative });
	}
	return series;
}

function clock(now: Date, start: Date, end: Date) {
	const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * HOUR)));
	const running = now.getTime() >= start.getTime() && now.getTime() < end.getTime();
	return {
		countdown: countdownAt(now, start, end),
		startsAt: start.toISOString(),
		endsAt: end.toISOString(),
		day: running ? Math.min(totalDays, Math.floor((now.getTime() - start.getTime()) / (24 * HOUR)) + 1) : null,
		totalDays
	};
}

function summary(hours: number[]): Turnaround {
	if (hours.length === 0) return { median: null, average: null, n: 0 };
	return { median: median(hours), average: hours.reduce((a, b) => a + b, 0) / hours.length, n: hours.length };
}

export function percent(part: number, whole: number): number | null {
	if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
	return Math.round((part / whole) * 1000) / 10;
}

function emailSet(list: string | undefined): Set<string> {
	return new Set(
		(list ?? '')
			.split(',')
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean)
	);
}

function time(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const at = new Date(iso).getTime();
	return Number.isFinite(at) ? at : null;
}

function nextDay(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	const next = new Date(Date.UTC(year, month - 1, date));
	next.setUTCDate(next.getUTCDate() + 1);
	return next.toISOString().slice(0, 10);
}
