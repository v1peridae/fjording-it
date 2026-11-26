/** Exact YSWS Project Submission column names on base appvTVotaimtBHIsi. */
export const AIRTABLE_FIELDS = {
	email: 'Email',
	code: 'Code URL',
	playable: 'Playable URL',
	description: 'Description',
	github: 'GitHub Username',
	firstName: 'First Name',
	lastName: 'Last Name',
	/** Date column. The YSWS table has no separate Age column; age is computed from this date. */
	birthday: 'Birthday',
	address1: 'Address (Line 1)',
	address2: 'Address (Line 2)',
	city: 'City',
	state: 'State / Province',
	country: 'Country',
	postal: 'ZIP / Postal Code',
	hackatimeId: 'Justification - Submitter Hackatime ID',
	hackatimeProjects: 'Justification - Hackatime Project Name(s) + Date Range(s)',
	lapseLinks: 'Justification - Lapse Links, comma-separated',
	technical: 'Justification - Specific Technical Features',
	deflation: 'Justification - Deflation Justification',
	alternate: 'Justification - Alternate Tracking Method',
	additional: 'Justification - Additional Justification',
	overrideHours: 'Optional - Override Hours Spent',
	overrideWhy: 'Optional - Override Hours Spent Justification',
	screenshot: 'Screenshot'
} as const;

/** The only write Johnny approved: YSWS Project Submission in the Fjording base. */
export const AIRTABLE_WRITE_ALLOWLIST = [{ baseId: 'appvTVotaimtBHIsi', tableId: 'tblrPzOp2NenfoRn2' }] as const;

const UNIFIED_AIRTABLE_BASE = 'app3A5kJwYqxMLOgh';

export function northernAirtableConfigured(env: {
	token?: string;
	baseId?: string;
	table?: string;
	signupsBaseId?: string;
	signupsTable?: string;
}): { token: string; baseId: string; table: string } | { error: string } {
	const token = env.token?.trim();
	const baseId = env.baseId?.trim();
	const table = env.table?.trim();
	if (!token || !baseId || !table) return { error: 'Airtable sync is not configured' };
	if (baseId === UNIFIED_AIRTABLE_BASE) return { error: 'refusing to write the Unified Airtable base' };
	if (env.signupsTable && table === env.signupsTable.trim()) return { error: 'refusing to write the sign-ups table' };
	const allowed = AIRTABLE_WRITE_ALLOWLIST.some((item) => item.baseId === baseId && item.tableId === table);
	if (!allowed) return { error: 'refusing to write that Airtable table' };
	return { token, baseId, table };
}

/** Airtable date columns want YYYY-MM-DD. A JS Date stringifies as "Mon Dec 10". */
export function airtableDate(value: unknown): string | null {
	if (value == null || value === '') return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const year = value.getUTCFullYear();
		const month = String(value.getUTCMonth() + 1).padStart(2, '0');
		const day = String(value.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	const text = String(value);
	const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
	return iso ? iso[1] : null;
}

export function airtableRecordFields(input: {
	email: string;
	repoUrl: string;
	demoUrl: string;
	description: string;
	githubUsername: string | null;
	hackatimeUserId: string | null;
	hackatimeProject: string;
	hackatimeSeconds: number;
	windowLabel: string | null;
	lapseLinks: string[];
	technicalFeatures: string;
	deflationJustification: string;
	alternateTracking: string;
	additionalJustification: string;
	note: string;
	overrideHours: number | null;
	firstName?: string | null;
	lastName?: string | null;
	birthday?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	country?: string | null;
	postalCode?: string | null;
}): Record<string, string | number> {
	const fields: Record<string, string | number> = {};
	const set = (name: string, value: string | number | null | undefined) => {
		if (value == null || value === '') return;
		fields[name] = value;
	};
	const hours = Math.round((input.hackatimeSeconds / 3600) * 10) / 10;
	set(AIRTABLE_FIELDS.email, input.email);
	set(AIRTABLE_FIELDS.code, input.repoUrl);
	set(AIRTABLE_FIELDS.playable, input.demoUrl);
	set(AIRTABLE_FIELDS.description, input.description);
	set(AIRTABLE_FIELDS.github, input.githubUsername);
	set(AIRTABLE_FIELDS.firstName, input.firstName);
	set(AIRTABLE_FIELDS.lastName, input.lastName);
	set(AIRTABLE_FIELDS.birthday, input.birthday);
	set(AIRTABLE_FIELDS.address1, input.addressLine1);
	set(AIRTABLE_FIELDS.address2, input.addressLine2);
	set(AIRTABLE_FIELDS.city, input.city);
	set(AIRTABLE_FIELDS.state, input.state);
	set(AIRTABLE_FIELDS.country, input.country);
	set(AIRTABLE_FIELDS.postal, input.postalCode);
	set(AIRTABLE_FIELDS.hackatimeId, input.hackatimeUserId);
	set(
		AIRTABLE_FIELDS.hackatimeProjects,
		[input.hackatimeProject, `${hours}h`, input.windowLabel].filter(Boolean).join('\n')
	);
	set(AIRTABLE_FIELDS.lapseLinks, input.lapseLinks.join(', '));
	set(AIRTABLE_FIELDS.technical, input.technicalFeatures);
	set(AIRTABLE_FIELDS.deflation, input.deflationJustification);
	set(AIRTABLE_FIELDS.alternate, input.alternateTracking);
	set(AIRTABLE_FIELDS.additional, [input.additionalJustification, input.note].filter(Boolean).join('\n\n'));
	if (input.overrideHours != null) {
		set(AIRTABLE_FIELDS.overrideHours, input.overrideHours);
		set(AIRTABLE_FIELDS.overrideWhy, input.deflationJustification || input.note);
	}
	return fields;
}
