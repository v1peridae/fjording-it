import { redirect } from '@sveltejs/kit';
import { timeUntilDeadline } from '#lib/hackathon.ts';
import { displayName } from '#lib/participant-identity.ts';
import { formatHours } from '#lib/server/hackatime.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { refreshPerson } from '#lib/server/coding-dau.ts';
import {
	codingSecondsInWindow,
	participantProject,
	peopleAtFiveHours
} from '#lib/server/northern-store.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const participant = await currentParticipant(cookies, url);
	if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/you');

	let reached = 0;
	let hours: string | null = null;
	let hoursUnknown = false;
	let linked = false;
	if (databaseConfigured()) {
		const db = await appDatabase();
		const project = await participantProject(db, participant.id).catch(() => null);
		linked = Boolean(project);
		if (project) {
			await refreshPerson(db, {
				participantId: participant.id,
				email: participant.email,
				hackatimeProject: project.hackatimeProject
			}).catch(() => 'failed' as const);
			const seconds = await codingSecondsInWindow(db, participant.id).catch(() => null);
			if (seconds == null) hoursUnknown = true;
			else hours = formatHours(seconds);
		}
		reached = await peopleAtFiveHours(db).catch(() => 0);
	}

	return {
		label: displayName(participant.name) || participant.email,
		reached,
		hours,
		hoursUnknown,
		linked,
		now: Date.now(),
		initial: timeUntilDeadline(new Date())
	};
};
