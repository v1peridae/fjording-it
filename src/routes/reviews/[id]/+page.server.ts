import { error, fail, redirect } from '@sveltejs/kit';
import { pushOutbox } from '#lib/server/airtable-sync.ts';
import { northernAirtableConfigured } from '#lib/airtable-fields.ts';
import { addressCheck, ageYears } from '#lib/participant-identity.ts';
import { privateEnv } from '#lib/server/private-env.ts';
import { canAct } from '#lib/server/access.ts';
import { appDatabase, databaseConfigured, withTransaction } from '#lib/server/app-db.ts';
import { currentAdminView, enforceOwner, enforceStaff } from '#lib/server/admin.ts';
import { fetchHackatimeProjects, formatHours } from '#lib/server/hackatime.ts';
import { getSubmission, latestChecks, latestOutbox, listReviews, participantForSubmission, readHackatimeConnection, recordReview } from '#lib/server/northern-store.ts';
import { runSubmissionChecks } from '#lib/server/run-checks.ts';
import {
	airtableEligible,
	applyDecision,
	approvedHours,
	decisionsFor,
	isStage,
	lapseLinks,
	overrideHours,
	type Decision
} from '#lib/review-pipeline.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, setHeaders, url, params }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	enforceStaff(admin.status, url);
	if (admin.status !== 'in' && admin.status !== 'reviewer') error(404, 'Not Found');
	const id = Number(params.id);
	if (!databaseConfigured() || !Number.isInteger(id)) error(404, 'Not Found');
	const db = await appDatabase();
	const submission = await getSubmission(db, id);
	if (!submission) error(404, 'Not Found');
	const stage = isStage(submission.stage) ? submission.stage : null;
	const allowed = stage ? await canAct(admin.email, stage, privateEnv('ADMIN_EMAILS')) : false;
	const connection = await readHackatimeConnection(db, submission.email);
	let liveHours: string | null = null;
	let liveNote = '';
	if (!connection) liveNote = "couldn't check live hours: hackatime is not connected";
	else {
		const projects = await fetchHackatimeProjects(connection.accessToken);
		const match = projects?.find((project) => project.name === submission.hackatimeProject);
		if (!projects) liveNote = "couldn't load live hours";
		else if (!match) liveNote = 'that hackatime project is not on the account now';
		else liveHours = formatHours(match.totalSeconds);
	}
	const airtable = northernAirtableConfigured({
		token: privateEnv('AIRTABLE_TOKEN'),
		baseId: privateEnv('NORTHERN_AIRTABLE_BASE_ID'),
		table: privateEnv('NORTHERN_AIRTABLE_TABLE'),
		signupsBaseId: privateEnv('AIRTABLE_BASE_ID')
	});
	return {
		role: admin.status === 'in' ? ('owner' as const) : ('reviewer' as const),
		email: admin.email,
		handle: admin.handle,
		githubUsername: connection?.githubUsername ?? null,
		hackatimeUserId: connection?.hackatimeUserId ?? null,
		participant: await participantForSubmission(db, id).then((participant) =>
			participant
				? {
						...participant,
						age: ageYears(participant.birthday),
						address: addressCheck(
							participant.addressLine1 || participant.city || participant.country
								? {
										line1: participant.addressLine1,
										line2: participant.addressLine2,
										city: participant.city,
										state: participant.state,
										postalCode: participant.postalCode,
										country: participant.country
									}
								: null
						)
					}
				: null
		),
		submission,
		reviews: await listReviews(db, id),
		checks: await latestChecks(db, id),
		outbox: await latestOutbox(db, id),
		allowed,
		decisions: stage ? decisionsFor(stage) : [],
		approved: approvedHours(submission.hackatimeSeconds, submission.overrideHours),
		liveHours,
		liveNote,
		airtable: 'error' in airtable ? airtable.error : 'configured',
		hackatimeHours: formatHours(submission.hackatimeSeconds)
	};
};

export const actions: Actions = {
	review: async ({ request, cookies, url, params }) => {
		const admin = await currentAdminView(cookies, url);
		enforceStaff(admin.status, url);
		if (admin.status !== 'in' && admin.status !== 'reviewer') error(404, 'Not Found');
		const id = Number(params.id);
		const db = await appDatabase();
		const submission = await getSubmission(db, id);
		const stage = submission?.stage;
		if (!submission || !stage || !isStage(stage)) error(404, 'Not Found');
		if (!(await canAct(admin.email, stage, privateEnv('ADMIN_EMAILS')))) error(404, 'Not Found');

		const data = await request.formData();
		const decision = String(data.get('decision') ?? '') as Decision;
		const next = applyDecision(stage, decision);
		if (!next) return fail(400, { error: 'that decision does not fit this stage' });
		const note = String(data.get('note') ?? '').trim();
		const links = lapseLinks(String(data.get('lapse_links') ?? ''));
		if (!links) return fail(400, { error: 'lapse links need to be comma-separated urls' });
		const hours = overrideHours(String(data.get('override_hours') ?? ''));
		if (hours === undefined) return fail(400, { error: 'override hours must be a number' });

		await withTransaction((db) =>
			recordReview(db, {
				submissionId: id,
				stage,
				reviewerEmail: admin.email,
				decision,
				note: note || null,
				lapseLinks: links,
				technicalFeatures: text(data.get('technical_features')),
				deflationJustification: text(data.get('deflation_justification')),
				alternateTracking: text(data.get('alternate_tracking')),
				additionalJustification: text(data.get('additional_justification')),
				overrideHours: hours,
				nextStage: next.stage,
				nextStatus: next.status
			})
		);
		if (airtableEligible(next.stage, next.status)) await pushOutbox(id);
		redirect(303, `/reviews/${id}`);
	},
	recheck: async ({ cookies, url, params }) => {
		const admin = await currentAdminView(cookies, url);
		enforceStaff(admin.status, url);
		if (admin.status !== 'in' && admin.status !== 'reviewer') error(404, 'Not Found');
		await runSubmissionChecks(Number(params.id));
		redirect(303, `/reviews/${params.id}`);
	},
	sync: async ({ cookies, url, params }) => {
		const admin = await currentAdminView(cookies, url);
		enforceOwner(admin.status, url);
		if (admin.status !== 'in') error(404, 'Not Found');
		await pushOutbox(Number(params.id));
		redirect(303, `/reviews/${params.id}`);
	}
};

function text(value: FormDataEntryValue | null): string | null {
	const raw = String(value ?? '').trim();
	return raw || null;
}
