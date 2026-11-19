import { AIRTABLE_BASE_ID, AIRTABLE_TABLE, AIRTABLE_TOKEN } from '$app/env/private';
import { readSignups, summarizeSignups, type AirtablePage, type SignupReport } from '../signup-stats';

let cache: { at: number; report: SignupReport } | null = null;
let pending: Promise<SignupReport> | null = null;
const TTL = 60_000;

export function getSignupStats(): Promise<SignupReport> {
	if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.report);

	pending ??= loadSignupStats()
		.then((report) => {
			cache = { at: Date.now(), report };
			return report;
		})
		.finally(() => {
			pending = null;
		});

	return pending;
}

async function loadSignupStats(): Promise<SignupReport> {
	const { count, events } = await readSignups(fetchPage);
	return summarizeSignups(count, events);
}

async function fetchPage(offset: string): Promise<AirtablePage> {
	const params = new URLSearchParams({
		pageSize: '100',
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
					return [
						{
							createdTime: typeof createdTime === 'string' ? createdTime : undefined,
							fields:
								fields && typeof fields === 'object' && !Array.isArray(fields)
									? (fields as Record<string, unknown>)
									: undefined
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
