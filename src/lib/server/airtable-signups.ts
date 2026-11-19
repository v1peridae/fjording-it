import { AIRTABLE_BASE_ID, AIRTABLE_TABLE, AIRTABLE_TOKEN } from '$app/env/private';
import {
	daysSinceFirstSignup,
	formatSignupStats,
	tallySignups,
	type AirtablePage
} from './signup-stats';

export type SignupStats = {
	count: number;
	days: number | null;
	line: string;
};

let cache: { at: number; stats: SignupStats } | null = null;
let pending: Promise<SignupStats> | null = null;
const TTL = 60_000;

export function getSignupStats(): Promise<SignupStats> {
	if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.stats);

	pending ??= loadSignupStats()
		.then((stats) => {
			cache = { at: Date.now(), stats };
			return stats;
		})
		.finally(() => {
			pending = null;
		});

	return pending;
}

async function loadSignupStats(): Promise<SignupStats> {
	const tally = await tallySignups(fetchPage);
	const days = tally.firstCreatedAt ? daysSinceFirstSignup(tally.firstCreatedAt) : null;
	return { count: tally.count, days, line: formatSignupStats(tally.count, days) };
}

async function fetchPage(offset: string): Promise<AirtablePage> {
	const params = new URLSearchParams({
		pageSize: '100',
		'fields[]': 'Email',
		filterByFormula: '{Email} != ""'
	});
	if (offset) params.set('offset', offset);

	const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?${params}`;
	let lastStatus = 0;

	for (let attempt = 0; attempt < 4; attempt++) {
		const res = await fetch(url, {
			headers: {
				authorization: `Bearer ${AIRTABLE_TOKEN}`,
				accept: 'application/json'
			},
			signal: AbortSignal.timeout(15_000)
		});

		if (res.ok) {
			const body = (await res.json()) as { records?: unknown; offset?: unknown };
			if (!Array.isArray(body.records)) throw new Error('airtable records missing');
			return {
				records: body.records.flatMap((record) => {
					if (!record || typeof record !== 'object') return [];
					const createdTime = (record as { createdTime?: unknown }).createdTime;
					const fields = (record as { fields?: unknown }).fields;
					const email =
						fields && typeof fields === 'object' ? (fields as { Email?: unknown }).Email : undefined;
					return [
						{
							createdTime: typeof createdTime === 'string' ? createdTime : undefined,
							fields: { Email: email }
						}
					];
				}),
				offset: typeof body.offset === 'string' && body.offset ? body.offset : undefined
			};
		}

		lastStatus = res.status;
		if (res.status !== 429 && res.status < 500) break;
		await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
	}

	throw new Error(`airtable ${lastStatus}`);
}
