import { AIRTABLE_BASE_ID, AIRTABLE_TABLE, AIRTABLE_TOKEN, NORTHERN_AIRTABLE_BASE_ID, NORTHERN_AIRTABLE_TABLE } from '$app/env/private';
import { AIRTABLE_FIELDS, airtableRecordFields, northernAirtableConfigured } from '../airtable-fields.ts';
import { appDatabase } from './app-db.ts';
import { latestOutbox, listReviews, markOutbox, readHackatimeConnection, submissionScreenshot } from './northern-store.ts';

export async function pushOutbox(submissionId: number): Promise<void> {
	const db = await appDatabase();
	const outbox = await latestOutbox(db, submissionId);
	if (!outbox || outbox.status === 'synced') return;

	const config = northernAirtableConfigured({
		token: AIRTABLE_TOKEN,
		baseId: NORTHERN_AIRTABLE_BASE_ID,
		table: NORTHERN_AIRTABLE_TABLE,
		signupsBaseId: AIRTABLE_BASE_ID,
		signupsTable: AIRTABLE_TABLE
	});
	if ('error' in config) {
		await markOutbox(db, outbox.id, { status: 'not_configured', lastError: config.error });
		return;
	}

	try {
		const submission = await loadForSync(submissionId);
		if (!submission) throw new Error('submission missing');
		const recordId = await upsertRecord(config, outbox.airtableRecordId, submission.fields);
		const shot = await submissionScreenshot(db, submissionId);
		if (shot && shot.bytes.length > 0) await uploadScreenshot(config, recordId, shot.bytes, shot.type);
		await markOutbox(db, outbox.id, { status: 'synced', lastError: null, airtableRecordId: recordId });
	} catch (err) {
		await markOutbox(db, outbox.id, {
			status: 'error',
			lastError: err instanceof Error ? err.message.slice(0, 500) : 'airtable failed'
		});
	}
}

async function loadForSync(submissionId: number) {
	const db = await appDatabase();
	const { rows } = await db.query(
		`SELECT email, description, repo_url, demo_url, hackatime_project, hackatime_seconds, override_hours
		 FROM submissions WHERE id = $1`,
		[submissionId]
	);
	const row = rows[0];
	if (!row) return null;
	const reviews = await listReviews(db, submissionId);
	const first = [...reviews].reverse().find((review) => review.stage === 'first_pass');
	const connection = await readHackatimeConnection(db, String(row.email));
	return {
		fields: airtableRecordFields({
			email: String(row.email),
			repoUrl: String(row.repo_url),
			demoUrl: String(row.demo_url),
			description: String(row.description),
			githubUsername: connection?.githubUsername ?? null,
			hackatimeUserId: connection?.hackatimeUserId ?? null,
			hackatimeProject: String(row.hackatime_project),
			hackatimeSeconds: Number(row.hackatime_seconds),
			lapseLinks: first?.lapseLinks ?? [],
			technicalFeatures: first?.technicalFeatures ?? '',
			deflationJustification: first?.deflationJustification ?? '',
			alternateTracking: first?.alternateTracking ?? '',
			additionalJustification: first?.additionalJustification ?? '',
			note: first?.note ?? '',
			overrideHours: row.override_hours == null ? null : Number(row.override_hours)
		})
	};
}

async function upsertRecord(
	config: { token: string; baseId: string; table: string },
	recordId: string | null,
	fields: Record<string, string | number>
): Promise<string> {
	const table = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.table)}`;
	const res = await fetch(recordId ? `${table}/${recordId}` : table, {
		method: recordId ? 'PATCH' : 'POST',
		headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
		body: JSON.stringify(recordId ? { typecast: true, fields } : { typecast: true, records: [{ fields }] }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!res.ok) throw new Error(`airtable ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = (await res.json()) as { id?: string; records?: { id: string }[] };
	const id = json.id ?? json.records?.[0]?.id;
	if (!id) throw new Error('airtable response missing record id');
	return id;
}

async function uploadScreenshot(config: { token: string; baseId: string }, recordId: string, bytes: Uint8Array, type: string) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	const res = await fetch(
		`https://content.airtable.com/v0/${config.baseId}/${recordId}/${encodeURIComponent(AIRTABLE_FIELDS.screenshot)}/uploadAttachment`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
			body: JSON.stringify({
				contentType: type,
				filename: `screenshot.${type.split('/')[1] ?? 'png'}`,
				file: btoa(binary)
			}),
			signal: AbortSignal.timeout(30_000)
		}
	);
	if (!res.ok) throw new Error(`screenshot upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
