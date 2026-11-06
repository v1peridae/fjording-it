import { fail } from '@sveltejs/kit';
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE } from '$app/env/private';
import type { Actions } from './$types';

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

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase()
			.slice(0, 255);

		if (tooMany(getClientAddress())) {
			return fail(429, { email, error: 'slow down a little and try again in a few minutes' });
		}

		if (data.get('website')) {
			return { success: true };
		}

		if (email.length > 254 || !EMAIL.test(email)) {
			return fail(400, { email, error: "that doesn't look like an email" });
		}

		try {
			if (!(await alreadySignedUp(email))) {
				const res = await airtable('', {
					method: 'POST',
					body: JSON.stringify({ fields: { Email: email } })
				});
				if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
			}
		} catch (err) {
			console.error('airtable said no:', err);
			return fail(500, { email, error: 'something broke, try again in a bit' });
		}

		return { success: true };
	}
};
