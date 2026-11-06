import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	AIRTABLE_TOKEN: {},
	AIRTABLE_BASE_ID: {},
	AIRTABLE_TABLE: {}
});
