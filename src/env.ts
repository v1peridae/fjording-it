import { defineEnvVars } from '@sveltejs/kit/env';

function optional(value: string | undefined) {
	return value || undefined;
}

export const variables = defineEnvVars({
	AIRTABLE_TOKEN: {
		description: 'Sign-ups Airtable token. Read at runtime. The build does not require it.',
		schema: optional
	},
	AIRTABLE_BASE_ID: {
		description: 'Sign-ups Airtable base id. Read at runtime. The build does not require it.',
		schema: optional
	},
	AIRTABLE_TABLE: {
		description: 'Sign-ups Airtable table. Read at runtime. The build does not require it.',
		schema: optional
	},
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
	DATABASE_URL: {
		description: 'Postgres connection string. Server-side only. Required for submissions and reviews.',
		schema: optional
	},
	NORTHERN_AIRTABLE_BASE_ID: {
		description: 'Airtable base for HQ-confirmed submissions. Not the sign-ups base and not the Unified base.',
		schema: optional
	},
	NORTHERN_AIRTABLE_TABLE: {
		description: 'Existing YSWS Project Submission table in NORTHERN_AIRTABLE_BASE_ID. This app does not create tables.',
		schema: optional
	},
	GITHUB_TOKEN: {
		description: 'Optional token for review checks against the public GitHub API.',
		schema: optional
	}
});
