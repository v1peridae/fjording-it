/** The session cookie is sent on every path, so an old /admin-only cookie can be upgraded. */
export const ADMIN_COOKIE_PATH = '/';

/** Paths used before the cookie covered /reviews and /hackathon. Cleared on refresh and sign-out. */
export const LEGACY_ADMIN_COOKIE_PATHS = ['/admin', '/hackathon', '/reviews', '/auth'] as const;

const ALLOWED = ['/admin', '/reviews', '/hackathon'] as const;

/** A same-site path we are willing to send someone back to after sign-in. */
export function safeNext(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(value, 'http://fjording.local');
	} catch {
		return null;
	}
	if (url.origin !== 'http://fjording.local') return null;
	const path = url.pathname;
	if (path === '/admin' || path === '/admin/') return null;
	const allowed = ALLOWED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
	if (!allowed) return null;
	return `${path}${url.search}`;
}

export function signInLocation(returnTo: string): string {
	const next = safeNext(returnTo);
	return next ? `/admin?next=${encodeURIComponent(next)}` : '/admin';
}

export function ownerGate(status: 'in' | 'reviewer' | 'denied' | 'out', returnTo: string) {
	if (status === 'in') return { type: 'allow' as const };
	if (status === 'out') return { type: 'signin' as const, location: signInLocation(returnTo) };
	return { type: 'hide' as const };
}

export function staffGate(status: 'in' | 'reviewer' | 'denied' | 'out', returnTo: string) {
	if (status === 'in' || status === 'reviewer') return { type: 'allow' as const };
	if (status === 'out') return { type: 'signin' as const, location: signInLocation(returnTo) };
	return { type: 'hide' as const };
}

export function afterLoginPath(role: 'owner' | 'reviewer' | 'denied' | 'failed', next: string | null): string {
	if (role === 'owner') return next ?? '/admin';
	if (role === 'reviewer') {
		if (next === '/reviews' || next?.startsWith('/reviews/')) return next;
		return '/reviews';
	}
	return '/admin';
}
