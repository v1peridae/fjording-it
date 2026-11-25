import { DATABASE_URL } from '$app/env/private';
import { databaseUrl, getPool, migrate } from '#lib/server/db.ts';

/** Runs once when the Node server starts, before it accepts requests. */
export async function init(): Promise<void> {
	const url = databaseUrl(DATABASE_URL);
	if (!url) {
		console.error('DATABASE_URL is not set; skipping migrations');
		return;
	}
	await migrate(getPool(url));
}
