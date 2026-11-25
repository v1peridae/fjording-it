/** Create-only migrations. A file that drops or deletes is refused before it runs. */
export function assertCreateOnly(filename: string, sql: string): void {
	if (/\bdrop\s+table\b/i.test(sql) || /\bdelete\s+from\b/i.test(sql)) {
		throw new Error(`${filename} is not create-only`);
	}
}
