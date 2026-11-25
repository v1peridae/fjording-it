import { privateEnv } from '#lib/server/private-env.ts';
import { AIRTABLE_FIELDS, airtableRecordFields, northernAirtableConfigured } from '../airtable-fields.ts';
import { appDatabase } from './app-db.ts';
import { latestOutbox, listReviews, markOutbox, readHackatimeConnection, rememberAirtableRecord, submissionScreenshot } from './northern-store.ts';

export async function pushOutbox(submissionId: number): Promise<void> {
	const db = await appDatabase();
	const outbox = await latestOutbox(db, submissionId);
	if (!outbox || outbox.status === 'synced') return;

	const config = northernAirtableConfigured({
		token: privateEnv('NORTHERN_AIRTABLE_TOKEN') || privateEnv('AIRTABLE_TOKEN'),
		baseId: privateEnv('NORTHERN_AIRTABLE_BASE_ID'),
		table: privateEnv('NORTHERN_AIRTABLE_TABLE'),
		signupsBaseId: privateEnv('AIRTABLE_BASE_ID'),
		signupsTable: privateEnv('AIRTABLE_TABLE')
	});
	if ('error' in config) {
		await markOutbox(db, outbox.id, { status: 'not_configured', lastError: config.error });
		return;
	}

	let lastError = 'airtable failed';
	let recordId = outbox.airtableRecordId;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const submission = await loadForSync(submissionId);
			if (!submission) throw new Error('submission missing');
			recordId = await upsertRecord(config, recordId, submission.fields);
			await rememberAirtableRecord(db, submissionId, recordId);
			const shot = await submissionScreenshot(db, submissionId);
			if (shot && shot.bytes.length > 0) await uploadScreenshot(config, recordId, shot.bytes, shot.type);
			await markOutbox(db, outbox.id, { status: 'synced', lastError: null, airtableRecordId: recordId });
			return;
		} catch (err) {
			lastError = err instanceof Error ? err.message.slice(0, 500) : 'airtable failed';
		}
	}
	await markOutbox(db, outbox.id, { status: 'error', lastError });
}

function textOrEmpty(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

async function loadForSync(submissionId: number) {
	const db = await appDatabase();
	const { rows } = await db.query(
		`SELECT s.email, s.description, s.repo_url, s.demo_url, s.hackatime_project, s.hackatime_seconds, s.override_hours,
		        c.starts_at, c.ends_at,
		        p.first_name, p.last_name, p.birthday, p.address_line1, p.address_line2, p.city, p.state, p.country, p.postal_code
		 FROM submissions s
		 JOIN challenges c ON c.slug = s.challenge
		 LEFT JOIN participants p ON p.id = s.participant_id
		 WHERE s.id = $1`,
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
			overrideHours: row.override_hours == null ? null : Number(row.override_hours),
			windowLabel: `${new Date(String(row.starts_at)).toISOString().slice(0, 10)} to ${new Date(String(row.ends_at)).toISOString().slice(0, 10)}`,
			firstName: textOrEmpty(row.first_name),
			lastName: textOrEmpty(row.last_name),
			birthday: row.birthday == null ? null : String(row.birthday).slice(0, 10),
			addressLine1: textOrEmpty(row.address_line1),
			addressLine2: textOrEmpty(row.address_line2),
			city: textOrEmpty(row.city),
			state: textOrEmpty(row.state),
			country: textOrEmpty(row.country),
			postalCode: textOrEmpty(row.postal_code)
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
	if (!res.ok) {
		const detail = (await res.text()).slice(0, 300);
		if (recordId) throw new Error(`airtable ${res.status}: ${detail}`);
		throw new Error(`airtable ${res.status}: ${detail}`);
	}
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
