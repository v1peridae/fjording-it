const ET = 'America/New_York';

export type AdminStatus = 'in' | 'denied' | 'out';

/** Signed-out visitors and non-admins get the same not-found as a missing page. */
export function hackathonAllowed(status: AdminStatus): boolean {
	return status === 'in';
}

type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

/** Fri Nov 27, 2026, 00:00 America/New_York. */
export const KICKOFF: WallTime = { year: 2026, month: 11, day: 27, hour: 0, minute: 0 };
/** Sun Dec 6, 2026, 11:59 PM America/New_York. */
export const DEADLINE: WallTime = { year: 2026, month: 12, day: 6, hour: 23, minute: 59 };

export const CHALLENGE_SPAN = 'Nov 27 to Dec 6';
export const CHALLENGE_CLOSES = 'closes Sun Dec 6 at 11:59pm ET';

export function zonedWallTime(time: WallTime, timeZone = ET): Date {
	let utc = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, 0);
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	});

	for (let i = 0; i < 4; i++) {
		const parts = fmt.formatToParts(new Date(utc));
		const get = (type: Intl.DateTimeFormatPartTypes) =>
			Number(parts.find((part) => part.type === type)?.value);
		let hour = get('hour');
		if (hour === 24) hour = 0;
		const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
		const target = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, 0);
		const diff = target - asUtc;
		if (diff === 0) return new Date(utc);
		utc += diff;
	}

	return new Date(utc);
}

export function hackathonKickoff(): Date {
	return zonedWallTime(KICKOFF);
}

export function hackathonDeadline(): Date {
	return zonedWallTime(DEADLINE);
}

export type Countdown =
	| { phase: 'until-start' | 'until-end'; label: string; days: string; hours: string; minutes: string }
	| { phase: 'done'; label: string };

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** Always the time remaining until 11:59pm ET on Dec 6, even before kickoff. */
export function timeUntilDeadline(now: Date): Countdown {
	return countdownAt(now, new Date(0), hackathonDeadline());
}

export function countdownAt(now: Date, start = hackathonKickoff(), end = hackathonDeadline()): Countdown {
	if (now.getTime() >= end.getTime()) return { phase: 'done', label: "that's a wrap" };

	const running = now.getTime() >= start.getTime();
	const target = running ? end : start;
	const seconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
	return {
		phase: running ? 'until-end' : 'until-start',
		label: running ? 'time left' : 'kicks off in',
		days: pad(Math.floor(seconds / 86400)),
		hours: pad(Math.floor((seconds % 86400) / 3600)),
		minutes: pad(Math.floor((seconds % 3600) / 60))
	};
}
