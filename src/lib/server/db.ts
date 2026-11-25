import pg from 'pg';
import migrationSql from '../../../migrations/001_northern_challenge.sql?raw';

export class DatabaseUnconfigured extends Error {
	constructor() {
		super('database is not configured');
	}
}

export type Sql = {
	query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

const MIGRATION = '001_northern_challenge.sql';

let pool: pg.Pool | null = null;

export function databaseUrl(value: string | undefined): string | null {
	const raw = value?.trim();
	return raw || null;
}

export function getPool(connectionString: string): pg.Pool {
	if (!pool) pool = new pg.Pool({ connectionString });
	return pool;
}

export async function migrate(db: Sql): Promise<void> {
	await db.query(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			filename text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`
	);
	const seen = await db.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [MIGRATION]);
	if (seen.rows.length > 0) return;
	await db.query(migrationSql);
	await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [MIGRATION]);
}
