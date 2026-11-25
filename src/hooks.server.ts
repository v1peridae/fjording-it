import { databaseUrl, getPool, migrate } from '#lib/server/db.ts';
import { privateEnv } from '#lib/server/private-env.ts';

/** Runs once when the Node server starts, before it accepts requests. */
export async function init(): Promise<void> {
	const url = databaseUrl(privateEnv('DATABASE_URL'));
	if (!url) {
		console.error('DATABASE_URL is not set; skipping migrations');
		return;
	}
	await migrate(getPool(url));
}
