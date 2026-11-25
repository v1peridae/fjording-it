import { sameToken } from './admin-auth.ts';

/**
 * Hackatime OAuth and read API, following HackCast.
 * Tokens stay on the server. Never request the admin scope.
 * No database and no SvelteKit env imports — callers pass credentials in.
 */

export const HACKATIME_AUTHORIZE = 'https://hackatime.hackclub.com/oauth/authorize';
export const HACKATIME_TOKEN = 'https://hackatime.hackclub.com/oauth/token';
export const HACKATIME_API = 'https://hackatime.hackclub.com/api/v1';

/** Register this exact URI on the Hackatime OAuth app. */
export const HACKATIME_REDIRECT_URI = 'https://fjording.hackclub.com/auth/hackatime/callback';

/** `profile` is the person; `read` is their project hours. */
export const HACKATIME_SCOPES = 'profile read';

export type HackatimeTokens = {
	accessToken: string;
	refreshToken: string | null;
	expiresIn: number | null;
	scope: string | null;
};

export type HackatimeProfile = {
	id: string;
	email: string | null;
	githubUsername: string | null;
	slackId: string | null;
};

export type HackatimeProject = {
	name: string;
	totalSeconds: number;
	languages: string[];
};

export function hackatimeCredentials(env: {
	HACKATIME_CLIENT_ID?: string;
	HACKATIME_CLIENT_SECRET?: string;
}): { id: string; secret: string } | undefined {
	const id = env.HACKATIME_CLIENT_ID?.trim();
	const secret = env.HACKATIME_CLIENT_SECRET?.trim();
	if (!id || !secret) return undefined;
	return { id, secret };
}

export function authorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
	const url = new URL(HACKATIME_AUTHORIZE);
	url.searchParams.set('client_id', input.clientId);
	url.searchParams.set('redirect_uri', input.redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', HACKATIME_SCOPES);
	url.searchParams.set('state', input.state);
	return url.href;
}

export function statesMatch(a: string, b: string): boolean {
	return sameToken(a, b);
}

export async function exchangeCode(input: {
	code: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string;
	fetchImpl?: typeof fetch;
}): Promise<HackatimeTokens> {
	return tokenRequest(
		{
			grant_type: 'authorization_code',
			code: input.code,
			redirect_uri: input.redirectUri,
			client_id: input.clientId,
			client_secret: input.clientSecret
		},
		input.fetchImpl
	);
}

export async function refreshAccessToken(input: {
	refreshToken: string;
	clientId: string;
	clientSecret: string;
	fetchImpl?: typeof fetch;
}): Promise<HackatimeTokens> {
	return tokenRequest(
		{
			grant_type: 'refresh_token',
			refresh_token: input.refreshToken,
			client_id: input.clientId,
			client_secret: input.clientSecret
		},
		input.fetchImpl
	);
}

async function tokenRequest(
	fields: Record<string, string>,
	fetchImpl: typeof fetch = fetch
): Promise<HackatimeTokens> {
	const response = await fetchImpl(HACKATIME_TOKEN, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
		body: new URLSearchParams(fields),
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) throw new Error('token');
	const json = (await response.json()) as {
		access_token?: unknown;
		refresh_token?: unknown;
		expires_in?: unknown;
		scope?: unknown;
	};
	if (typeof json.access_token !== 'string' || !json.access_token) throw new Error('token');
	return {
		accessToken: json.access_token,
		refreshToken: typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : null,
		expiresIn: typeof json.expires_in === 'number' && Number.isFinite(json.expires_in) ? json.expires_in : null,
		scope: typeof json.scope === 'string' && json.scope ? json.scope : null
	};
}

export function profileFromPayload(json: unknown): HackatimeProfile | null {
	if (!json || typeof json !== 'object') return null;
	const me = json as { id?: unknown; emails?: unknown; github_username?: unknown; slack_id?: unknown };
	if (me.id == null || me.id === '') return null;
	const emails = Array.isArray(me.emails)
		? me.emails.filter((item): item is string => typeof item === 'string' && !!item.trim())
		: [];
	return {
		id: String(me.id),
		email: emails[0] ?? null,
		githubUsername:
			typeof me.github_username === 'string' && me.github_username.trim() ? me.github_username.trim() : null,
		slackId: typeof me.slack_id === 'string' && me.slack_id.trim() ? me.slack_id.trim() : null
	};
}

export function projectsFromPayload(json: unknown): HackatimeProject[] | null {
	if (!json || typeof json !== 'object') return null;
	const list = (json as { projects?: unknown }).projects;
	if (!Array.isArray(list)) return null;
	return list
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const project = item as { name?: unknown; total_seconds?: unknown; languages?: unknown };
			if (typeof project.name !== 'string' || !project.name.trim()) return null;
			const seconds = Number(project.total_seconds ?? 0);
			const languages = Array.isArray(project.languages)
				? project.languages.filter((lang): lang is string => typeof lang === 'string' && !!lang.trim())
				: [];
			return {
				name: project.name.trim(),
				totalSeconds: Number.isFinite(seconds) ? seconds : 0,
				languages
			};
		})
		.filter((project): project is HackatimeProject => project !== null)
		.sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function formatHours(totalSeconds: number): string {
	const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
	const hours = Math.floor(safe / 3600);
	const minutes = Math.round((safe % 3600) / 60);
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function authedJson(path: string, accessToken: string, fetchImpl: typeof fetch): Promise<unknown | null> {
	const response = await fetchImpl(`${HACKATIME_API}${path}`, {
		headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		signal: AbortSignal.timeout(8_000)
	});
	if (!response.ok) return null;
	return response.json();
}

export async function fetchHackatimeProfile(
	accessToken: string,
	fetchImpl: typeof fetch = fetch
): Promise<HackatimeProfile | null> {
	try {
		const json = await authedJson('/authenticated/me', accessToken, fetchImpl);
		if (!json) return null;
		return profileFromPayload(json);
	} catch {
		return null;
	}
}

export async function fetchHackatimeProjects(
	accessToken: string,
	fetchImpl: typeof fetch = fetch
): Promise<HackatimeProject[] | null> {
	try {
		const json = await authedJson('/authenticated/projects', accessToken, fetchImpl);
		if (!json) return null;
		return projectsFromPayload(json);
	} catch {
		return null;
	}
}
