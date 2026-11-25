export type HackathonLink = { href: string; label: string };

const PUBLIC: HackathonLink[] = [
	{ href: '/hackathon', label: 'The Northern Challenge' },
	{ href: '/hackathon#prizes', label: 'prizes' },
	{ href: '/hackathon#rules', label: 'rules' },
	{ href: '/hackathon/submit', label: 'submit' }
];

const SIGN_IN: HackathonLink = { href: '/hackathon/auth/login', label: 'sign in' };

/** Staff chrome is for a signed-in owner or reviewer. Everyone else gets the public links. */
export function hackathonNav(status: 'in' | 'reviewer' | 'denied' | 'out', participant = false) {
	const staff = status === 'in' ? ('owner' as const) : status === 'reviewer' ? ('reviewer' as const) : null;
	return {
		staff,
		public: participant ? PUBLIC : [...PUBLIC, SIGN_IN]
	};
}
