import { defineEnvVars } from '@sveltejs/kit/env';

function optional(value: string | undefined) {
	return value || undefined;
}

export const variables = defineEnvVars({
	AIRTABLE_TOKEN: {},
	AIRTABLE_BASE_ID: {},
	AIRTABLE_TABLE: {},
	HACKCLUB_AUTH_CLIENT_ID: {
		description: 'OAuth client id from https://auth.hackclub.com/developer/apps. Server-side only.',
		schema: optional
	},
	HACKCLUB_AUTH_CLIENT_SECRET: {
		description: 'OAuth client secret from Hack Club Auth. Server-side only.',
		schema: optional
	},
	ADMIN_SESSION_SECRET: {
		description: 'Secret used to sign the admin session cookie. Server-side only.',
		schema: optional
	},
	ADMIN_EMAILS: {
		description: 'Comma-separated admin allowlist. Defaults to johnny@hackclub.com when unset.',
		schema: optional
	},
	HACKATIME_CLIENT_ID: {
		description: 'Hackatime OAuth client id. Server-side only. Redirect URI must be https://fjording.hackclub.com/auth/hackatime/callback.',
		schema: optional
	},
	HACKATIME_CLIENT_SECRET: {
		description: 'Hackatime OAuth client secret. Server-side only.',
		schema: optional
	},
	DATABASE_PATH: {
		description: 'SQLite file for Northern Challenge submissions. Defaults to data/fjording.sqlite.',
		schema: optional
	}
});
