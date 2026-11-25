import { error } from '@sveltejs/kit';
import { appDatabase } from '#lib/server/app-db.ts';
import { currentAdminView } from '#lib/server/admin.ts';
import { submissionScreenshot } from '#lib/server/northern-store.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, url, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	const admin = await currentAdminView(cookies, url);
	if (admin.status !== 'in' && admin.status !== 'reviewer') error(404, 'Not Found');
	const shot = await submissionScreenshot(await appDatabase(), Number(params.id));
	if (!shot) error(404, 'Not Found');
	const copy = new Uint8Array(shot.bytes.byteLength);
	copy.set(shot.bytes);
	return new Response(copy, { headers: { 'content-type': shot.type } });
};
