import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { currentAdmin } from '#lib/server/admin.ts';
import { appDatabase, screenshotDirectory } from '#lib/server/app-db.ts';
import { screenshotNameOk } from '#lib/server/northern-store.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp'
};

export const GET: RequestHandler = async ({ cookies, url, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if ((await currentAdmin(cookies, url)) !== 'in') error(404, 'Not Found');

	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) error(404, 'Not Found');
	const row = appDatabase().prepare('SELECT screenshot_name FROM northern_submissions WHERE id = ?').get(id);
	const name = row && typeof row.screenshot_name === 'string' ? row.screenshot_name : '';
	if (!screenshotNameOk(name)) error(404, 'Not Found');

	const ext = name.slice(name.lastIndexOf('.') + 1);
	const bytes = await readFile(join(screenshotDirectory(), name));
	return new Response(new Uint8Array(bytes), {
		headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream' }
	});
};
