import { hackathonNav } from '#lib/hackathon-nav.ts';
import { displayName } from '#lib/participant-identity.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { challengeChoice, participantProject, setChallengeChoice } from '#lib/server/northern-store.ts';
import { currentParticipant, northernPageAllowed, signOutParticipant } from '#lib/server/participant.ts';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow'
	});

	const admin = (await northernPageAllowed(cookies, url)).view;
	const participant = await currentParticipant(cookies, url);
	const staff = admin.status === 'in' || admin.status === 'reviewer';
	const fromHome = url.searchParams.get('from') === '/';
	let choice: 'in' | 'later' | null = null;
	let hasProject = false;
	if (participant && databaseConfigured()) {
		try {
			const db = await appDatabase();
			choice = await challengeChoice(db, participant.id);
			hasProject = Boolean(await participantProject(db, participant.id));
			if (hasProject && choice !== 'in') {
				await setChallengeChoice(db, participant.id, 'in');
				choice = 'in';
			}
		} catch {
			choice = null;
		}
	}
	if (participant && fromHome && choice == null && !hasProject) redirect(303, '/hackathon/join');

	return {
		nav: hackathonNav(admin.status, Boolean(participant), fromHome ? '/' : '/hackathon'),
		handle: staff ? admin.handle : null,
		email: staff ? admin.email : null,
		participantLabel: displayName(participant?.name) || participant?.email || null,
		needsOnboarding: choice === 'in' && !hasProject,
		showJoin: Boolean(participant) && choice !== 'in' && !hasProject,
		notice: url.searchParams.get('signin') === 'failed' ? "sign-in didn't work. try again." : null,
		now: Date.now()
	};
};

export const actions: Actions = {
	signout: async ({ cookies, url }) => {
		signOutParticipant(cookies, url);
		redirect(303, '/hackathon');
	},
	join: async ({ cookies, url }) => {
		const participant = await currentParticipant(cookies, url);
		if (!participant) redirect(303, '/hackathon/auth/login?from=/');
		if (databaseConfigured()) await setChallengeChoice(await appDatabase(), participant.id, 'in');
		redirect(303, '/hackathon/start');
	}
};
