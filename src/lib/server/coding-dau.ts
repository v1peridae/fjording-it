import { challengeDayKeys, etDayKey, secondsOnDay, spansFromPayload } from '../coding-days.ts';
import type { Sql } from './db.ts';
import { HACKATIME_API } from './hackatime.ts';
import { codingFetchedAt, linkedProjects, readHackatimeConnection, saveCodingDays } from './northern-store.ts';

const FRESH_MS = 15 * 60 * 1000;

/** One spans request per linked project, skipped when that person's cache is under 15 minutes old. */
export async function refreshCodingDays(db: Sql, now = new Date()): Promise<{ checked: number; failed: number }> {
	const people = await linkedProjects(db);
	let checked = 0;
	let failed = 0;
	for (const person of people) {
		const result = await refreshPerson(db, person, now);
		if (result === 'checked') checked += 1;
		if (result === 'failed') failed += 1;
	}
	return { checked, failed };
}

export async function refreshPerson(
	db: Sql,
	person: { participantId: number; email: string; hackatimeProject: string },
	now = new Date()
): Promise<'fresh' | 'checked' | 'failed'> {
	const fetched = await codingFetchedAt(db, person.participantId);
	if (fetched != null && now.getTime() - fetched < FRESH_MS) return 'fresh';
	const days = daysToStore(etDayKey(now));
	const spans = await fetchSpans(db, person.email, person.hackatimeProject, days[0], days[days.length - 1]);
	if (!spans) return 'failed';
	await saveCodingDays(
		db,
		person.participantId,
		days.map((day) => ({ day, seconds: secondsOnDay(spans, day) }))
	);
	return 'checked';
}

function daysToStore(today: string): string[] {
	const days = new Set(challengeDayKeys());
	if (today >= '2026-11-26' && today <= '2026-12-07') days.add(today);
	return [...days].sort();
}

async function fetchSpans(db: Sql, email: string, project: string, start: string, end: string) {
	const connection = await readHackatimeConnection(db, email);
	if (!connection) return null;
	const query = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&project=${encodeURIComponent(project)}`;
	for (const path of [`/users/my/heartbeats/spans?${query}`, `/users/current/heartbeats/spans?${query}`]) {
		try {
			const res = await fetch(`${HACKATIME_API}${path}`, {
				headers: { authorization: `Bearer ${connection.accessToken}`, accept: 'application/json' },
				signal: AbortSignal.timeout(8000)
			});
			if (!res.ok) continue;
			const spans = spansFromPayload(await res.json().catch(() => null), project);
			if (spans) return spans;
		} catch {
			continue;
		}
	}
	return null;
}
