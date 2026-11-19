export type SignupRecord = {
	createdTime?: string;
	fields?: { Email?: unknown };
};

export type AirtablePage = {
	records: SignupRecord[];
	offset?: string;
};

export type SignupTally = {
	count: number;
	firstCreatedAt: string | null;
};

const MAX_PAGES = 500;

export async function tallySignups(
	fetchPage: (offset: string) => Promise<AirtablePage>
): Promise<SignupTally> {
	let offset = '';
	let count = 0;
	let firstCreatedAt: string | null = null;
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
			if (record.createdTime && (!firstCreatedAt || record.createdTime < firstCreatedAt)) {
				firstCreatedAt = record.createdTime;
			}
		}

		if (!body.offset) return { count, firstCreatedAt };
		offset = body.offset;
	}

	throw new Error('too many airtable pages');
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

export const DEFAULT_ADMIN_EMAILS = 'johnny@hackclub.com';

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
