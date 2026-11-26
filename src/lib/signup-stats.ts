export type SignupRecord = {
	createdTime?: string;
	fields?: Record<string, unknown>;
};

export type AirtablePage = {
	records: SignupRecord[];
	offset?: string;
};

export type SignupTally = {
	count: number;
	firstCreatedAt: string | null;
};

export type SignupEvent = {
	at: string;
	name?: string;
};

export type DayBar = {
	date: string;
	label: string;
	count: number;
	cumulative: number;
};

export type HourBar = {
	hour: number;
	label: string;
	count: number;
};

export type RecentSignup = {
	at: string;
	when: string;
	name?: string;
};

export type SignupReport = {
	count: number;
	days: number | null;
	line: string;
	today: number;
	perDay: string;
	daysSeries: DayBar[];
	hours: HourBar[];
	recent: RecentSignup[];
	hasNames: boolean;
};

const MAX_PAGES = 500;
const ET = 'America/New_York';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function readSignups(
	fetchPage: (offset: string) => Promise<AirtablePage>
): Promise<{ count: number; events: SignupEvent[] }> {
	let offset = '';
	let count = 0;
	const events: SignupEvent[] = [];
	const seen = new Set<string>();

	for (let page = 0; page < MAX_PAGES; page++) {
		if (offset) {
			if (seen.has(offset)) throw new Error('airtable offset repeated');
			seen.add(offset);
		}

		const body = await fetchPage(offset);
		for (const record of body.records) {
			const email = record.fields?.Email;
			if (typeof email !== 'string' || email.trim() === '') continue;
			count += 1;
			if (!record.createdTime || Number.isNaN(new Date(record.createdTime).getTime())) continue;
			const name = signupName(record.fields);
			events.push(name ? { at: record.createdTime, name } : { at: record.createdTime });
		}

		if (!body.offset) return { count, events };
		offset = body.offset;
	}

	throw new Error('too many airtable pages');
}

export async function tallySignups(
	fetchPage: (offset: string) => Promise<AirtablePage>
): Promise<SignupTally> {
	const { count, events } = await readSignups(fetchPage);
	let firstCreatedAt: string | null = null;
	for (const event of events) {
		if (!firstCreatedAt || event.at < firstCreatedAt) firstCreatedAt = event.at;
	}
	return { count, firstCreatedAt };
}

/** Calendar days from the first sign-up through today, inclusive, in UTC. */
export function daysSinceFirstSignup(firstCreatedAt: string, now = new Date()): number {
	const first = new Date(firstCreatedAt);
	if (Number.isNaN(first.getTime())) throw new Error('bad created time');

	const start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
	const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

export function formatSignupStats(count: number, days: number | null): string {
	const signups = `${count} ${count === 1 ? 'sign-up' : 'sign-ups'}`;
	if (days === null) return signups;
	const span = Math.max(1, days);
	return `${signups} in ${span} ${span === 1 ? 'day' : 'days'}`;
}

export function signupName(fields: Record<string, unknown> | undefined): string | undefined {
	if (!fields) return undefined;
	const direct = cleanName(fields['Full Name'] ?? fields.Name);
	if (direct) return direct;
	const joined = [cleanName(fields['First Name']), cleanName(fields['Last Name'])].filter(Boolean).join(' ');
	return joined || undefined;
}

export function summarizeSignups(count: number, events: SignupEvent[], now = new Date()): SignupReport {
	const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, label: hourLabel(hour), count: 0 }));
	const byDay = new Map<string, number>();

	for (const event of events) {
		const when = new Date(event.at);
		const parts = etParts(when);
		if (parts.hour >= 0 && parts.hour <= 23) hours[parts.hour].count += 1;
		byDay.set(parts.key, (byDay.get(parts.key) ?? 0) + 1);
	}

	const today = etParts(now).key;
	const keys = [...byDay.keys()];
	const daysSeries: DayBar[] = [];
	if (keys.length > 0) {
		const start = [today, ...keys].sort()[0];
		const end = [today, ...keys].sort().at(-1) ?? today;
		let cumulative = 0;
		for (const date of eachDay(start, end)) {
			const dayCount = byDay.get(date) ?? 0;
			cumulative += dayCount;
			daysSeries.push({ date, label: dayLabel(date, start, end), count: dayCount, cumulative });
		}
	}

	const first = events.reduce<string | null>((earliest, event) => {
		return !earliest || event.at < earliest ? event.at : earliest;
	}, null);
	const days = first ? daysSinceFirstSignup(first, now) : null;
	const recent = [...events]
		.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
		.slice(0, 20)
		.map((event) => (event.name ? { at: event.at, when: formatEt(event.at), name: event.name } : { at: event.at, when: formatEt(event.at) }));

	return {
		count,
		days,
		line: formatSignupStats(count, days),
		today: byDay.get(today) ?? 0,
		perDay: formatPerDay(count, days),
		daysSeries,
		hours,
		recent,
		hasNames: recent.some((row) => row.name)
	};
}

function formatPerDay(count: number, days: number | null): string {
	if (!days) return '0';
	const value = count / days;
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const DEFAULT_ADMIN_EMAILS = 'johnny@hackclub.com';
export const ADMIN_ENTRY_EMAIL = 'johnny@hackclub.com';

export function adminAllowlist(value: string | undefined): Set<string> {
	const raw = value && value.trim() ? value : DEFAULT_ADMIN_EMAILS;
	return new Set(
		raw
			.split(',')
			.map((email) => email.trim().toLowerCase())
			.filter((email) => email.length > 0)
	);
}

export function isAdminEmail(email: string, allowlist: string | undefined): boolean {
	return adminAllowlist(allowlist).has(email.trim().toLowerCase());
}

/** The address typed on the admin form must be the account Hack Club Auth actually returned. */
export function sameAccountEmail(verified: string, expected: string | null | undefined): boolean {
	if (!expected || !expected.trim()) return true;
	return verified.trim().toLowerCase() === expected.trim().toLowerCase();
}

/** The public RSVP box starts admin sign-in only for this exact address. */
export function isAdminEntryEmail(email: string): boolean {
	return email.trim().toLowerCase() === ADMIN_ENTRY_EMAIL;
}

export function adminCallbackDecision(
	verifiedEmail: string,
	allowlist: string | undefined
): 'allow' | 'deny' {
	return isAdminEmail(verifiedEmail, allowlist) ? 'allow' : 'deny';
}

function cleanName(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed || trimmed.includes('@')) return undefined;
	return trimmed.slice(0, 80);
}

function etParts(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ET,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
	let hour = Number(get('hour'));
	if (hour === 24) hour = 0;
	const month = get('month');
	const day = get('day');
	return { key: `${get('year')}-${month}-${day}`, month, day, hour, minute: get('minute') };
}

function eachDay(start: string, end: string): string[] {
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

function nextEtDay(key: string): string {
	const [year, month, day] = key.split('-').map(Number);
	return etParts(new Date(Date.UTC(year, month - 1, day, 17, 0, 0) + 86_400_000)).key;
}

function dayLabel(key: string, start: string, end: string): string {
	const [, month, day] = key.split('-');
	const label = `${MONTHS[Number(month) - 1]} ${Number(day)}`;
	return start.slice(0, 4) === end.slice(0, 4) ? label : `${label} ${key.slice(0, 4)}`;
}

function hourLabel(hour: number): string {
	if (hour === 0) return '12a';
	if (hour < 12) return `${hour}a`;
	if (hour === 12) return '12p';
	return `${hour - 12}p`;
}

function formatEt(iso: string): string {
	const parts = etParts(new Date(iso));
	const hour12 = parts.hour % 12 || 12;
	const suffix = parts.hour < 12 ? 'AM' : 'PM';
	return `${MONTHS[Number(parts.month) - 1]} ${Number(parts.day)}, ${hour12}:${parts.minute} ${suffix}`;
}
