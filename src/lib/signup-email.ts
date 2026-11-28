/** Waitlist addresses. Caught here, before Airtable ever sees them. */

const FORMAT =
	/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/

/** Exact domain typos. Real domains like yahoo.co.uk are not in here. */
const TYPOS: Record<string, string> = {
	'gmail.co': 'gmail.com',
	'gmail.con': 'gmail.com',
	'gmail.cm': 'gmail.com',
	'gmail.om': 'gmail.com',
	'gmial.com': 'gmail.com',
	'gmai.com': 'gmail.com',
	'gmal.com': 'gmail.com',
	'gamil.com': 'gmail.com',
	'gnail.com': 'gmail.com',
	'gmaill.com': 'gmail.com',
	'googlemail.co': 'googlemail.com',
	'hotmial.com': 'hotmail.com',
	'hotmail.co': 'hotmail.com',
	'hotmal.com': 'hotmail.com',
	'hotamil.com': 'hotmail.com',
	'hotmail.con': 'hotmail.com',
	'yahoo.co': 'yahoo.com',
	'yahoo.con': 'yahoo.com',
	'yaho.com': 'yahoo.com',
	'yahooo.com': 'yahoo.com',
	'yhaoo.com': 'yahoo.com',
	'outlook.co': 'outlook.com',
	'outloo.com': 'outlook.com',
	'outlok.com': 'outlook.com',
	'icloud.co': 'icloud.com',
	'icoud.com': 'icloud.com',
	'icloud.con': 'icloud.com'
}

const GMAIL = new Set(['gmail.com', 'googlemail.com'])

const INVISIBLE =
	/[\u0000-\u001f\u007f\u00ad\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff\u3000]/g

export type SignupEmail =
	| { ok: true; email: string }
	| { ok: false; email: string; error: string }

/** Strip whitespace and invisible characters, then lowercase the address. */
export function normalizeSignupEmail(raw: string): string {
	const cleaned = raw.replace(INVISIBLE, '').replace(/\s+/g, '')
	const at = cleaned.lastIndexOf('@')
	if (at <= 0) return cleaned.toLowerCase()
	return `${cleaned.slice(0, at).toLowerCase()}@${cleaned.slice(at + 1).toLowerCase()}`
}

export function checkSignupEmail(raw: string): SignupEmail {
	const email = normalizeSignupEmail(raw).slice(0, 254)
	if (email.length > 254 || !FORMAT.test(email)) {
		return { ok: false, email, error: "that doesn't look like an email" }
	}
	const at = email.lastIndexOf('@')
	const local = email.slice(0, at)
	const domain = email.slice(at + 1)
	const meant = TYPOS[domain]
	if (meant) return { ok: false, email, error: `did you mean ${local}@${meant}?` }
	if (GMAIL.has(domain) && !gmailLocal(local)) {
		return { ok: false, email, error: "gmail addresses can't use that" }
	}
	return { ok: true, email }
}

/** Gmail usernames are letters, numbers, dots, and plus tags. No underscores. */
function gmailLocal(local: string): boolean {
	if (local.length < 1 || local.length > 64) return false
	if (!/^[a-z0-9.+]+$/.test(local)) return false
	if (!/[a-z0-9]/.test(local)) return false
	if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
	return true
}
