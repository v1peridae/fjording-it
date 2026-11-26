export type ParticipantAddress = {
	line1: string | null;
	line2: string | null;
	city: string | null;
	state: string | null;
	postalCode: string | null;
	country: string | null;
};

export type ParticipantIdentity = {
	hackClubId: string;
	email: string;
	emailVerified: boolean;
	name: string | null;
	firstName: string | null;
	lastName: string | null;
	slackId: string | null;
	verificationStatus: string | null;
	yswsEligible: boolean | null;
	birthday: string | null;
	address: ParticipantAddress | null;
};

/**
 * Fjording it admin (HCA app 1515) is verified, so address and birthdate are requested again.
 * People who signed in while those scopes were off must consent once more so we can backfill.
 */
export const PARTICIPANT_SCOPES = 'openid profile email name slack_id verification_status address birthdate';

export function participantAfterLogin(ok: boolean): string {
	return ok ? '/hackathon' : '/hackathon?signin=failed';
}

/** Missing birthday or address is unknown. A recorded value never blocks sign-in or submission. */
export function ageCheck(birthday: string | null | undefined): 'unknown' | 'recorded' {
	return birthday ? 'recorded' : 'unknown';
}

export function addressCheck(address: ParticipantAddress | null | undefined): 'unknown' | 'recorded' {
	if (!address) return 'unknown';
	return Object.values(address).some(Boolean) ? 'recorded' : 'unknown';
}

/** Whole years in America/New_York. Missing or unreadable birthdays stay unknown. */
export function ageYears(birthday: string | null | undefined, now = new Date()): number | null {
	if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
	const [year, month, day] = birthday.split('-').map(Number);
	const [nowYear, nowMonth, nowDay] = today.split('-').map(Number);
	let age = nowYear - year;
	if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1;
	if (!Number.isFinite(age) || age < 0 || age > 120) return null;
	return age;
}

export function demographicsComplete(input: {
	birthday?: string | null;
	addressLine1?: string | null;
	city?: string | null;
	country?: string | null;
	address?: ParticipantAddress | null;
}): boolean {
	const line1 = input.addressLine1 ?? input.address?.line1;
	const city = input.city ?? input.address?.city;
	const country = input.country ?? input.address?.country;
	return Boolean(input.birthday) && Boolean(line1 || city || country);
}

export function identityFromClaims(claims: Record<string, unknown>): ParticipantIdentity | null {
	const hackClubId = text(claims.sub);
	const email = text(claims.email)?.toLowerCase() ?? text(claims.primary_email)?.toLowerCase() ?? null;
	if (!hackClubId || !email) return null;
	const firstName = text(claims.given_name) ?? text(claims.first_name);
	const lastName = text(claims.family_name) ?? text(claims.last_name);
	const name = displayName(typeof claims.name === 'string' ? claims.name : joinName(firstName, lastName));
	return {
		hackClubId,
		email,
		emailVerified: claims.email_verified === true,
		name,
		firstName,
		lastName,
		slackId: text(claims.slack_id),
		verificationStatus: text(claims.verification_status),
		yswsEligible: typeof claims.ysws_eligible === 'boolean' ? claims.ysws_eligible : null,
		...readOptionalDemographics(claims.birthdate ?? claims.birthday, addressFrom(claims.address))
	};
}

/** Merge /api/v1/me, which uses different names from the OIDC claims. */
export function identityFromMe(body: unknown, fallback: ParticipantIdentity): ParticipantIdentity {
	if (!body || typeof body !== 'object') return fallback;
	const identity = (body as { identity?: unknown }).identity;
	if (!identity || typeof identity !== 'object') return fallback;
	const row = identity as Record<string, unknown>;
	const addresses = Array.isArray(row.addresses) ? row.addresses : [];
	const primary = addresses.find((item) => item && typeof item === 'object' && (item as { primary?: unknown }).primary === true) ?? addresses[0];
	const fromMe = readOptionalDemographics(row.birthday, addressRecord(primary));
	return {
		...fallback,
		hackClubId: text(row.id) ?? fallback.hackClubId,
		email: text(row.primary_email)?.toLowerCase() ?? fallback.email,
		firstName: text(row.first_name) ?? fallback.firstName,
		lastName: text(row.last_name) ?? fallback.lastName,
		name: displayName(typeof row.name === 'string' ? row.name : null) ?? fallback.name,
		slackId: text(row.slack_id) ?? fallback.slackId,
		verificationStatus: text(row.verification_status) ?? fallback.verificationStatus,
		yswsEligible: typeof row.ysws_eligible === 'boolean' ? row.ysws_eligible : fallback.yswsEligible,
		birthday: fromMe.birthday ?? fallback.birthday,
		address: fromMe.address ?? fallback.address
	};
}

/** Userinfo may omit address and birthday. A bad shape is the same as absent. */
function readOptionalDemographics(birthday: unknown, address: ParticipantAddress | null): {
	birthday: string | null;
	address: ParticipantAddress | null;
} {
	try {
		return { birthday: dateOnly(birthday), address };
	} catch {
		return { birthday: null, address: null };
	}
}

function addressFrom(value: unknown): ParticipantAddress | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	const street = text(row.street_address);
	const [line1, line2] = street ? street.split('\n') : [null, null];
	const address = {
		line1: line1 || null,
		line2: line2 || null,
		city: text(row.locality),
		state: text(row.region),
		postalCode: text(row.postal_code),
		country: text(row.country)
	};
	return Object.values(address).some(Boolean) ? address : null;
}

function addressRecord(value: unknown): ParticipantAddress | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const address = {
		line1: text(row.line_1),
		line2: text(row.line_2),
		city: text(row.city),
		state: text(row.state),
		postalCode: text(row.postal_code),
		country: text(row.country)
	};
	return Object.values(address).some(Boolean) ? address : null;
}

function joinName(first: string | null, last: string | null): string | null {
	const name = [first, last].filter(Boolean).join(' ');
	return name || null;
}

/** The name Hack Club Auth already gave us, with surrounding space removed. */
export function displayName(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed || null;
}

function text(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed || null;
}

function dateOnly(value: unknown): string | null {
	const raw = text(value);
	if (!raw) return null;
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
	return match ? match[1] : null;
}
