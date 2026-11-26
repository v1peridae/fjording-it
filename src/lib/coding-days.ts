import { zonedWallTime } from './hackathon.ts';

export const WINDOW_START = '2026-11-27';
export const WINDOW_END = '2026-12-06';

export type CodingSpan = { startMs: number; endMs: number };

export function challengeDayKeys(): string[] {
	const days: string[] = [];
	let day = WINDOW_START;
	while (day <= WINDOW_END) {
		days.push(day);
		day = nextDay(day);
	}
	return days;
}

export function etDayKey(now: Date): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

export function dayLabel(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
		new Date(Date.UTC(year, month - 1, date))
	);
}

export function spansFromPayload(json: unknown, project: string): CodingSpan[] | null {
	if (!json || typeof json !== 'object') return null;
	const body = json as { spans?: unknown; data?: unknown; heartbeats?: unknown };
	const list = body.spans ?? body.heartbeats ?? body.data;
	if (!Array.isArray(list)) return null;
	const want = project.trim().toLowerCase();
	const spans: CodingSpan[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const name = text(row.project) ?? text(row.name);
		if (name && name.toLowerCase() !== want) continue;
		const start = millis(row.start_time ?? row.start ?? row.time ?? row.from);
		if (start == null) continue;
		let end = millis(row.end_time ?? row.end ?? row.to);
		const duration = Number(row.duration ?? row.seconds ?? row.duration_seconds);
		if (end == null && Number.isFinite(duration) && duration > 0) end = start + duration * 1000;
		if (end == null || end <= start) continue;
		spans.push({ startMs: start, endMs: end });
	}
	return spans;
}

export function secondsOnDay(spans: CodingSpan[], day: string): number {
	const { start, end } = dayBounds(day);
	let ms = 0;
	for (const span of spans) {
		const from = Math.max(span.startMs, start);
		const to = Math.min(span.endMs, end);
		if (to > from) ms += to - from;
	}
	return Math.round(ms / 1000);
}

export type DayTotal = { day: string; label: string; people: number; hours: number };

export function codingWindow(
	rows: { day: string; people: number; seconds: number }[],
	today: string
): { today: number; days: DayTotal[]; empty: boolean } {
	const byDay = new Map(rows.map((row) => [row.day.slice(0, 10), row]));
	const days = challengeDayKeys().map((day) => {
		const row = byDay.get(day);
		const seconds = row?.seconds ?? 0;
		return {
			day,
			label: dayLabel(day),
			people: row?.people ?? 0,
			hours: Math.round((seconds / 3600) * 10) / 10
		};
	});
	const todayRow = byDay.get(today);
	return {
		today: todayRow?.people ?? 0,
		days,
		empty: days.every((day) => day.people === 0 && day.hours === 0)
	};
}

function dayBounds(day: string): { start: number; end: number } {
	const [year, month, date] = day.split('-').map(Number);
	const start = zonedWallTime({ year, month, day: date, hour: 0, minute: 0 }).getTime();
	const [ny, nm, nd] = nextDay(day).split('-').map(Number);
	const end = zonedWallTime({ year: ny, month: nm, day: nd, hour: 0, minute: 0 }).getTime();
	return { start, end };
}

function nextDay(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	const next = new Date(Date.UTC(year, month - 1, date));
	next.setUTCDate(next.getUTCDate() + 1);
	return next.toISOString().slice(0, 10);
}

function millis(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value;
	if (typeof value !== 'string' || !value.trim()) return null;
	const parsed = Date.parse(value);
	if (Number.isFinite(parsed)) return parsed;
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return null;
	return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}
