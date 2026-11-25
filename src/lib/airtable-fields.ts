import { approvedHours } from './review-pipeline.ts';

/** Exact YSWS Project Submission column names. */
export const AIRTABLE_FIELDS = {
	email: 'Email',
	code: 'Code URL',
	playable: 'Playable URL',
	description: 'Description',
	github: 'GitHub Username',
	hackatimeId: 'Justification - Submitter Hackatime ID',
	hackatimeProjects: 'Justification - Hackatime Project Name(s) + Date Range(s)',
	lapseLinks: 'Justification - Lapse Links, comma-separated',
	technical: 'Justification - Specific Technical Features',
	deflation: 'Justification - Deflation Justification',
	alternate: 'Justification - Alternate Tracking Method',
	additional: 'Justification - Additional Justification',
	overrideHours: 'Optional - Override Hours Spent',
	screenshot: 'Screenshot'
} as const;

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
	if (env.signupsBaseId && baseId === env.signupsBaseId.trim()) {
		return { error: 'refusing to write the sign-ups Airtable base' };
	}
	if (env.signupsTable && table === env.signupsTable.trim() && env.signupsBaseId && baseId === env.signupsBaseId.trim()) {
		return { error: 'refusing to write the sign-ups table' };
	}
	return { token, baseId, table };
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
	lapseLinks: string[];
	technicalFeatures: string;
	deflationJustification: string;
	alternateTracking: string;
	additionalJustification: string;
	note: string;
	overrideHours: number | null;
}): Record<string, string | number> {
	const fields: Record<string, string | number> = {
		[AIRTABLE_FIELDS.email]: input.email,
		[AIRTABLE_FIELDS.code]: input.repoUrl,
		[AIRTABLE_FIELDS.playable]: input.demoUrl,
		[AIRTABLE_FIELDS.description]: input.description,
		[AIRTABLE_FIELDS.hackatimeProjects]: input.hackatimeProject,
		[AIRTABLE_FIELDS.lapseLinks]: input.lapseLinks.join(', '),
		[AIRTABLE_FIELDS.technical]: input.technicalFeatures,
		[AIRTABLE_FIELDS.deflation]: input.deflationJustification,
		[AIRTABLE_FIELDS.alternate]: input.alternateTracking,
		[AIRTABLE_FIELDS.additional]: [input.additionalJustification, input.note].filter(Boolean).join('\n\n'),
		'Approved Hours': approvedHours(input.hackatimeSeconds, input.overrideHours)
	};
	if (input.githubUsername) fields[AIRTABLE_FIELDS.github] = input.githubUsername;
	if (input.hackatimeUserId) fields[AIRTABLE_FIELDS.hackatimeId] = input.hackatimeUserId;
	if (input.overrideHours != null) fields[AIRTABLE_FIELDS.overrideHours] = input.overrideHours;
	return fields;
}
