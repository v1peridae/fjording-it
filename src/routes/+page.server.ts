import { fail } from '@sveltejs/kit';
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE } from '$app/env/private';
import { beginHackClubLogin } from '#lib/server/admin.ts';
import { isAdminEntryEmail } from '#lib/signup-stats.ts';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const LIMIT = 20;
const WINDOW = 10 * 60 * 1000;

const attempts = new Map<string, number[]>();

function tooMany(ip: string) {
	const now = Date.now();
	const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW);
	recent.push(now);
	attempts.set(ip, recent);

	if (attempts.size > 5000) {
		for (const [key, times] of attempts) {
			if (now - times[times.length - 1] > WINDOW) attempts.delete(key);
		}
	}

	return recent.length > LIMIT;
}

function airtable(query = '', init: RequestInit = {}) {
	return fetch(
		`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}${query}`,
		{
			...init,
			headers: {
				Authorization: `Bearer ${AIRTABLE_TOKEN}`,
				'Content-Type': 'application/json'
			}
		}
	);
}

async function alreadySignedUp(email: string) {
	const formula = `LOWER({Email}) = "${email.replace(/["\\]/g, '\\$&')}"`;
	const res = await airtable(`?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`);
	if (!res.ok) throw new Error(`lookup ${res.status}: ${await res.text()}`);

	const { records } = await res.json();
	return records.length > 0;
}

let signups: number | null = null;
let countedAt = 0;
let counting: Promise<unknown> | null = null;

async function countSignups() {
	let total = 0;
	let offset = '';
	do {
		const params = new URLSearchParams({
			pageSize: '100',
			'fields[]': 'Email',
			filterByFormula: '{Email} != ""'
		});
		if (offset) params.set('offset', offset);

		const res = await airtable(`?${params}`);
		if (!res.ok) throw new Error(`count ${res.status}: ${await res.text()}`);

		const page = await res.json();
		total += page.records.length;
		offset = page.offset ?? '';
	} while (offset);
	return total;
}

function recount() {
	counting ??= countSignups()
		.then((n) => (signups = n))
		.catch((err) => console.error("couldn't count signups:", err))
		.finally(() => {
			countedAt = Date.now();
			counting = null;
		});
	return counting;
}

export const load: PageServerLoad = async () => {
	if (Date.now() - countedAt > 60_000) {
		const pending = recount();
		if (signups === null) await pending;
	}
	return { signups };
};

export const actions: Actions = {
	default: async ({ request, getClientAddress, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase()
			.slice(0, 255);

		if (data.get('website')) {
			return { success: true };
		}

		if (email.length > 254 || !EMAIL.test(email)) {
			return fail(400, { email, error: "that doesn't look like an email" });
		}

		if (isAdminEntryEmail(email)) {
			const started = await beginHackClubLogin({
				cookies,
				origin: url.origin,
				loginHint: email
			});
			if (started?.error === 'unconfigured') {
				return fail(500, { email, error: 'something broke, try again in a bit' });
			}
			return;
		}

		if (tooMany(getClientAddress())) {
			return fail(429, { email, error: 'slow down a little and try again in a few minutes' });
		}

		try {
			if (!(await alreadySignedUp(email))) {
				const res = await airtable('', {
					method: 'POST',
					body: JSON.stringify({ fields: { Email: email } })
				});
				if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
				if (signups !== null) signups++;
			}
		} catch (err) {
			console.error('airtable said no:', err);
			return fail(500, { email, error: 'something broke, try again in a bit' });
		}

		return { success: true };
	}
};
