import { DATABASE_PATH } from '$app/env/private';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { databasePath, openDatabase } from './db.ts';

let db: DatabaseSync | null = null;

export function appDatabase(): DatabaseSync {
	if (!db) db = openDatabase(databasePath(DATABASE_PATH));
	return db;
}

export function appDatabaseFile(): string {
	return databasePath(DATABASE_PATH);
}

export function screenshotDirectory(): string {
	return join(dirname(appDatabaseFile()), 'screenshots');
}
