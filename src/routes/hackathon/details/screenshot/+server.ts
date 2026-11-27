import { error } from '@sveltejs/kit';
import { currentParticipant } from '#lib/server/participant.ts';
import { appDatabase, databaseConfigured } from '#lib/server/app-db.ts';
import { ownSubmission, submissionScreenshot } from '#lib/server/northern-store.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url }) => {
	const participant = await currentParticipant(cookies, url);
	if (!participant || !databaseConfigured()) error(404, 'Not Found');
	const submission = await ownSubmission(await appDatabase(), participant.id);
	if (!submission?.hasScreenshot) error(404, 'Not Found');
	const shot = await submissionScreenshot(await appDatabase(), submission.id);
	if (!shot) error(404, 'Not Found');
	const copy = new Uint8Array(shot.bytes.byteLength);
	copy.set(shot.bytes);
	return new Response(copy, {
		headers: { 'content-type': shot.type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
	});
};
