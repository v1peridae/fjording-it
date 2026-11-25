import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import migrationSql from '../../../migrations/001_northern_challenge.sql?raw';

const applied = new WeakSet<DatabaseSync>();

export function openDatabase(path: string): DatabaseSync {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	if (!applied.has(db)) {
		db.exec(migrationSql);
		applied.add(db);
	}
	return db;
}

export function databasePath(envPath: string | undefined): string {
	const raw = envPath?.trim();
	return raw || 'data/fjording.sqlite';
}
