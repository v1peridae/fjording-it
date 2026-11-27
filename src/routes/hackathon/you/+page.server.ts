import { fail, redirect } from '@sveltejs/kit';
import { timeUntilDeadline } from '#lib/hackathon.ts';
import { displayName } from '#lib/participant-identity.ts';
import { submitPhase } from '#lib/northern.ts';
import { canChangeReward, parseRewardChoice, type RewardChoice } from '#lib/reward.ts';
import { formatHours } from '#lib/server/hackatime.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { refreshPerson } from '#lib/server/coding-dau.ts';
import {
	codingSecondsInWindow,
	participantProject,
	peopleAtFiveHours,
	rewardChoice,
	setRewardChoice,
	syncHourBalance
} from '#lib/server/northern-store.ts';
import { currentParticipant } from '#lib/server/participant.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const participant = await currentParticipant(cookies, url);
	if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/you');

	let reached = 0;
	let hours: string | null = null;
	let hoursUnknown = false;
	let linked = false;
	let nearFive = false;
	let reward: RewardChoice | null = null;
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
			else {
				hours = formatHours(seconds);
				nearFive = seconds >= 3 * 3600;
			}
		}
		reached = await peopleAtFiveHours(db).catch(() => 0);
		reward = await rewardChoice(db, participant.id).catch(() => null);
		// Keeps the admin-only hour balance current. Nothing from it goes into this page's data.
		await syncHourBalance(db, participant.id).catch(() => undefined);
	}

	return {
		label: displayName(participant.name) || participant.email,
		reached,
		hours,
		hoursUnknown,
		linked,
		reward,
		nearFive,
		rewardOpen: canChangeReward(submitPhase(new Date())),
		now: Date.now(),
		initial: timeUntilDeadline(new Date())
	};
};

export const actions: Actions = {
	reward: async ({ request, cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/hackathon/you');
		const choice = parseRewardChoice((await request.formData()).get('reward'));
		if (!choice) return fail(400, { error: 'pick the cap or the $300' });
		if (!canChangeReward(submitPhase(new Date()))) return fail(403, { error: "that's a wrap, picks are locked" });
		if (!databaseConfigured()) return fail(500, { error: "couldn't save that yet" });
		await setRewardChoice(await appDatabase(), participant.id, choice);
		return { saved: true };
	}
};
