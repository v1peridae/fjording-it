import pg from 'pg';
import { assertCreateOnly } from '../migrations.ts';

export class DatabaseUnconfigured extends Error {
	constructor() {
		super('database is not configured');
	}
}

export type Sql = {
	query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

const migrations = import.meta.glob('../../../migrations/*.sql', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

let pool: pg.Pool | null = null;

export function databaseUrl(value: string | undefined): string | null {
	const raw = value?.trim();
	return raw || null;
}

export function getPool(connectionString: string): pg.Pool {
	if (!pool) pool = new pg.Pool({ connectionString });
	return pool;
}

export function migrationFiles(): { name: string; sql: string }[] {
	return Object.entries(migrations)
		.map(([path, sql]) => ({ name: path.split('/').pop() ?? path, sql }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function migrate(db: pg.Pool): Promise<void> {
	const client = await db.connect();
	try {
		await client.query('SELECT pg_advisory_lock($1)', [481516234]);
		await client.query(
			`CREATE TABLE IF NOT EXISTS schema_migrations (
				filename text PRIMARY KEY,
				applied_at timestamptz NOT NULL DEFAULT now()
			)`
		);
		for (const file of migrationFiles()) {
			const seen = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file.name]);
			if (seen.rows.length > 0) continue;
			assertCreateOnly(file.name, file.sql);
			await client.query('BEGIN');
			try {
				await client.query(file.sql);
				await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file.name]);
				await client.query('COMMIT');
				console.log(`applied migration ${file.name}`);
			} catch (err) {
				await client.query('ROLLBACK');
				throw err;
			}
		}
	} finally {
		await client.query('SELECT pg_advisory_unlock($1)', [481516234]).catch(() => undefined);
		client.release();
	}
}
