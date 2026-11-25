declare module 'node:fs' {
	export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module 'node:fs/promises' {
	export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	export function writeFile(path: string, data: Uint8Array): Promise<void>;
	export function readFile(path: string): Promise<Uint8Array>;
}

declare module 'node:path' {
	export function dirname(path: string): string;
	export function join(...paths: string[]): string;
}

declare module 'node:crypto' {
	export function randomBytes(size: number): { toString(encoding: 'hex'): string };
}

declare module 'node:sqlite' {
	export class DatabaseSync {
		constructor(path: string);
		exec(sql: string): void;
		prepare(sql: string): StatementSync;
	}

	interface StatementSync {
		run(...params: unknown[]): { lastInsertRowid: number | bigint };
		get(...params: unknown[]): Record<string, unknown> | undefined;
		all(...params: unknown[]): Record<string, unknown>[];
	}
}

declare module '*.sql?raw' {
	const value: string;
	export default value;
}
