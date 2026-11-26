import { privateEnv } from '#lib/server/private-env.ts';
import { appDatabase } from '#lib/server/app-db.ts';
import {
	fetchHackatimeProjects,
	formatHours,
	hackatimeCredentials,
	refreshAccessToken,
	type HackatimeProject
} from '#lib/server/hackatime.ts';
import { readHackatimeConnection, updateHackatimeTokens } from '#lib/server/northern-store.ts';
import { hoursEligible } from '#lib/northern.ts';

export async function liveProjects(email: string, bypassHours = false): Promise<{
	github: string | null;
	linked: boolean;
	projects: { name: string; seconds: number; hours: string; eligible: boolean }[];
	failed: boolean;
}> {
	const empty = { github: null, linked: false, projects: [], failed: false };
	const client = hackatimeCredentials({
		HACKATIME_CLIENT_ID: privateEnv('HACKATIME_CLIENT_ID'),
		HACKATIME_CLIENT_SECRET: privateEnv('HACKATIME_CLIENT_SECRET')
	});
	if (!client) return empty;

	const db = await appDatabase();
	let connection = await readHackatimeConnection(db, email);
	if (!connection) return empty;

	const remembered = connection.githubUsername;
	if (connection.expiresAt != null && connection.expiresAt <= Date.now() + 30_000) {
		if (!connection.refreshToken) {
			return { github: remembered, linked: true, projects: [], failed: true };
		}
		try {
			const tokens = await refreshAccessToken({
				refreshToken: connection.refreshToken,
				clientId: client.id,
				clientSecret: client.secret
			});
			await updateHackatimeTokens(db, email, tokens);
			connection = await readHackatimeConnection(db, email);
		} catch {
			return { github: remembered, linked: true, projects: [], failed: true };
		}
	}
	if (!connection) return { github: null, linked: true, projects: [], failed: true };

	const list = await fetchHackatimeProjects(connection.accessToken);
	if (!list) return { github: connection.githubUsername, linked: true, projects: [], failed: true };
	return {
		github: connection.githubUsername,
		linked: true,
		failed: false,
		projects: list.map((project: HackatimeProject) => ({
			name: project.name,
			seconds: project.totalSeconds,
			hours: formatHours(project.totalSeconds),
			eligible: hoursEligible(project.totalSeconds, bypassHours)
		}))
	};
}
