import { hackathonDeadline, hackathonKickoff } from './hackathon.ts';

export const MIN_TRACKED_SECONDS = 5 * 60 * 60;

export type SubmitPhase = 'early' | 'open' | 'closed';

export function submitPhase(now: Date, start = hackathonKickoff(), end = hackathonDeadline()): SubmitPhase {
	if (now.getTime() < start.getTime()) return 'early';
	if (now.getTime() >= end.getTime()) return 'closed';
	return 'open';
}

/** Admins can try the form before it opens. After the deadline it stays closed. */
export function canSubmit(phase: SubmitPhase, isAdmin: boolean): boolean {
	if (phase === 'open') return true;
	return phase === 'early' && isAdmin;
}

export function cleanProjectName(value: string): string | null {
	const name = value.trim().replace(/\s+/g, ' ');
	if (name.length < 1 || name.length > 80) return null;
	if (/[\u0000-\u001f]/.test(name)) return null;
	return name;
}

export function cleanDescription(value: string): string | null {
	const text = value.trim().replace(/\r\n/g, '\n');
	if (text.length < 1 || text.length > 2000) return null;
	return text;
}

export function httpUrl(value: string): string | null {
	let raw = value.trim();
	if (!raw || raw.length > 500) return null;
	if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (!url.hostname || !url.hostname.includes('.') || url.username || url.password) return null;
	return url.href;
}

export function eligibleHours(totalSeconds: number): boolean {
	return Number.isFinite(totalSeconds) && totalSeconds >= MIN_TRACKED_SECONDS;
}

export function sniffImage(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | null {
	if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'webp';
	}
	return null;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;
export function imageType(kind: 'png' | 'jpg' | 'webp'): string {
	return MIME[kind];
}
