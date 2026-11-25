import { DATABASE_URL } from '$app/env/private';
import { DatabaseUnconfigured, databaseUrl, getPool, migrate, type Sql } from './db.ts';

export { DatabaseUnconfigured };

export async function withTransaction<T>(fn: (db: Sql) => Promise<T>): Promise<T> {
	const url = databaseUrl(DATABASE_URL);
	if (!url) throw new DatabaseUnconfigured();
	const client = await getPool(url).connect();
	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}

let ready: Promise<Sql> | null = null;

export function appDatabase(): Promise<Sql> {
	const url = databaseUrl(DATABASE_URL);
	if (!url) return Promise.reject(new DatabaseUnconfigured());
	ready ??= migrate(getPool(url)).then(() => getPool(url));
	return ready;
}

export function databaseConfigured(): boolean {
	return databaseUrl(DATABASE_URL) !== null;
}
