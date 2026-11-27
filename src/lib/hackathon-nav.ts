export type HackathonLink = { href: string; label: string };

const PUBLIC: HackathonLink[] = [
	{ href: '/hackathon', label: 'The Northern Challenge' },
	{ href: '/hackathon#prizes', label: 'prizes' },
	{ href: '/hackathon#rules', label: 'rules' },
	{ href: '/hackathon/submit', label: 'submit' }
];

/** Staff chrome is for a signed-in owner or reviewer. Everyone else gets the public links. */
export function hackathonNav(
	status: 'in' | 'reviewer' | 'denied' | 'out',
	participant = false,
	from = '/hackathon'
) {
	const staff = status === 'in' ? ('owner' as const) : status === 'reviewer' ? ('reviewer' as const) : null;
	const origin = from === '/' ? '/' : '/hackathon';
	const signIn: HackathonLink = {
		href: `/hackathon/auth/login?from=${encodeURIComponent(origin)}`,
		label: 'sign in'
	};
	const details: HackathonLink = { href: '/hackathon/details', label: 'your details' };
	return {
		staff,
		public: participant ? [...PUBLIC, details] : [...PUBLIC, signIn]
	};
}
