/** Terminal review outcomes. The submission stays as sent. */
const LOCKED = new Set(['confirmed', 'rejected', 'fraud']);

export function lockReason(stage: string, status: string): string | null {
	if (status === 'confirmed' || stage === 'done') return 'HQ already confirmed this, so it stays as you sent it.';
	if (status === 'rejected') return 'this one was turned down, so it stays as you sent it.';
	if (status === 'fraud') return 'this one was flagged, so it stays as you sent it.';
	if (LOCKED.has(status)) return 'this one is finished, so it stays as you sent it.';
	return null;
}

/** A reviewer has already touched it, so an edit goes back to the start of the queue. */
export function shouldReopen(stage: string, status: string, reviewCount: number): boolean {
	if (lockReason(stage, status)) return false;
	return reviewCount > 0 || stage !== 'first_pass' || status !== 'pending';
}

/** An edit never creates an Airtable row. It only patches a record that already exists. */
export function editSyncMethod(recordId: string | null | undefined): 'PATCH' | null {
	const id = recordId?.trim();
	return id ? 'PATCH' : null;
}

export function cleanDisplayName(value: string): string | null | undefined {
	const name = value.trim().replace(/\s+/g, ' ');
	if (!name) return null;
	if (name.length > 80 || /[\u0000-\u001f]/.test(name)) return undefined;
	return name;
}

/** The project row is updated only for the signed-in participant. */
export function ownProjectUpdateSql(): string {
	return `UPDATE participant_projects
		 SET name = $2, description = $3, hackatime_project = $4
		 WHERE participant_id = $1
		 RETURNING id`;
}

/** The submission row is updated only for its owner, and never once it is locked. */
export function ownSubmissionUpdateSql(): string {
	return `UPDATE submissions
		 SET project_name = $3,
		     description = $4,
		     repo_url = $5,
		     demo_url = $6,
		     hackatime_project = $7,
		     hackatime_seconds = COALESCE($8, hackatime_seconds),
		     screenshot = CASE WHEN $9::bytea IS NULL THEN screenshot ELSE $9 END,
		     screenshot_type = CASE WHEN $9::bytea IS NULL THEN screenshot_type ELSE $10 END,
		     stage = CASE WHEN $11 THEN 'first_pass' ELSE stage END,
		     status = CASE WHEN $11 THEN 'pending' ELSE status END
		 WHERE id = $1 AND participant_id = $2
		   AND stage <> 'done'
		   AND status NOT IN ('confirmed', 'rejected', 'fraud')
		 RETURNING id, airtable_record_id`;
}
