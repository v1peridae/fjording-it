import { env } from '$env/dynamic/private';

type RuntimeProcess = { env?: Record<string, string | undefined> };

/**
 * Read a private env var when a request runs.
 * Orchard injects these into the process at start, not during the Railpack build.
 * `$env/dynamic/private` is the runtime bag; `process.env` is the same source if that bag is empty.
 */
export function privateEnv(name: string): string | undefined {
	const fromKit = env[name];
	const fromProcess = (globalThis as { process?: RuntimeProcess }).process?.env?.[name];
	const raw = typeof fromKit === 'string' ? fromKit : fromProcess;
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	return trimmed || undefined;
}
