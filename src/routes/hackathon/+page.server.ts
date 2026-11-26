import { hackathonNav } from '#lib/hackathon-nav.ts';
import { displayName } from '#lib/participant-identity.ts';
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

	return {
		nav: hackathonNav(admin.status, Boolean(participant)),
		handle: staff ? admin.handle : null,
		email: staff ? admin.email : null,
		participantLabel: displayName(participant?.name) || participant?.email || null,
		notice: url.searchParams.get('signin') === 'failed' ? "sign-in didn't work. try again." : null,
		now: Date.now()
	};
};

export const actions: Actions = {
	signout: async ({ cookies, url }) => {
		signOutParticipant(cookies, url);
		redirect(303, '/hackathon');
	}
};
