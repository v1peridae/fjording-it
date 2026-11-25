import { hackathonNav } from '#lib/hackathon-nav.ts';
import { currentParticipant, northernPageAllowed } from '#lib/server/participant.ts';
import type { PageServerLoad } from './$types';

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
		participantLabel: participant?.name || participant?.email || null,
		now: Date.now()
	};
};
